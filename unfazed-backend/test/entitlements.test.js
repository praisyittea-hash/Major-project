import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { database } from './helpers.js';
import SubscriptionTierConfig from '../src/models/SubscriptionTierConfig.js';
import { ensureTierConfigs } from '../src/services/subscriptionConfigService.js';
let close;
before(async () => {
  close = await database();
});
after(async () => {
  if (close) await close();
});
test('tier bootstrap inserts configuration without overwriting existing prices, caps or features', async () => {
  await ensureTierConfigs();
  await SubscriptionTierConfig.updateOne(
    { key: 'starter' },
    { $set: { 'caps.clients': 7, pricePaise: 99900, 'features.note_soap': true } },
  );
  await ensureTierConfigs();
  const config = await SubscriptionTierConfig.findOne({ key: 'starter' });
  assert.equal(config.caps.get('clients'), 7);
  assert.equal(config.pricePaise, 99900);
  assert.equal(config.features.get('note_soap'), true);
  assert.equal(await SubscriptionTierConfig.countDocuments(), 3);
  assert.ok(new SubscriptionTierConfig({ key: 'invalid', pricePaise: 1.2 }).validateSync());
  assert.ok(new SubscriptionTierConfig({ key: 'negative', caps: { clients: -1 } }).validateSync());
});
import Therapist from '../src/models/Therapist.js';
import { entitlementsFor, hasFeature } from '../src/services/entitlementService.js';
test('central entitlement resolution uses persisted configuration and fails closed for unknown subscriptions', async () => {
  const therapist = await Therapist.create({
    name: 'Entitlement Fixture',
    email: 'entitlement@example.test',
    password_hash: 'fixture',
    subscriptionConfig: 'starter',
  });
  assert.equal((await entitlementsFor(therapist.id)).caps.clients, 7);
  assert.equal(await hasFeature(therapist, 'note_soap'), true);
  await SubscriptionTierConfig.updateOne(
    { key: 'starter' },
    { $set: { 'features.note_soap': false } },
  );
  assert.equal(await hasFeature(therapist, 'note_soap'), false);
  await Therapist.updateOne({ _id: therapist.id }, { $set: { subscriptionConfig: 'unknown' } });
  assert.equal(await hasFeature(therapist, 'crm'), false);
  assert.equal((await entitlementsFor(therapist)).configured, false);
});
test('legacy default configuration gains new flags once while preserving explicitly configured values', async () => {
  await SubscriptionTierConfig.updateOne(
    { key: 'default' },
    {
      $unset: { configVersion: 1, 'features.note_dap': 1 },
      $set: { 'features.note_soap': false, 'caps.clients': 42 },
    },
  );
  await ensureTierConfigs();
  let config = await SubscriptionTierConfig.findOne({ key: 'default' });
  assert.equal(config.features.get('note_dap'), true);
  assert.equal(config.features.get('note_soap'), false);
  assert.equal(config.caps.get('clients'), 42);
  await SubscriptionTierConfig.updateOne(
    { key: 'default' },
    { $unset: { 'features.note_dap': 1 } },
  );
  await ensureTierConfigs();
  config = await SubscriptionTierConfig.findOne({ key: 'default' });
  assert.equal(config.features.get('note_dap'), undefined);
});
import request from 'supertest';
import { app } from '../src/app.js';
import { canAccess, assertAccess } from '../src/services/entitlementService.js';
import { issueToken } from '../src/services/tokenService.js';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'isolated-entitlement-test-secret-never-production';
test('canAccess is the source for feature API decisions and standardized upgrade denial', async () => {
  const therapist = await Therapist.create({
    name: 'Gate Fixture',
    email: 'gate@example.test',
    password_hash: 'fixture',
    subscriptionConfig: 'professional',
  });
  const auth = { Authorization: `Bearer ${issueToken(therapist.id)}` };
  assert.equal(await canAccess(therapist.id, 'analytics_advanced'), true);
  assert.equal(await canAccess(therapist.id, 'unknown_feature'), false);
  const decision = await request(app)
    .get('/api/therapists/entitlements/analytics_advanced')
    .set(auth)
    .expect(200);
  assert.equal(decision.body.allowed, true);
  await assert.rejects(
    assertAccess(therapist.id, 'unknown_feature'),
    (error) => error.code === 'ENTITLEMENT_REQUIRED' && error.upgradePath === '/subscription',
  );
  await request(app).get('/api/therapists/entitlements/analytics_advanced').expect(401);
  await SubscriptionTierConfig.updateOne(
    { key: 'professional' },
    { $set: { 'features.crm': false } },
  );
  const blocked = await request(app).get('/api/clients').set(auth).expect(403);
  assert.equal(blocked.body.code, 'ENTITLEMENT_REQUIRED');
  assert.equal(blocked.body.feature, 'crm');
});
test('active client cap gates concurrent creation, activation and restoration through canAccess', async () => {
  await SubscriptionTierConfig.create({
    key: 'cap-gate',
    features: { crm: true, clients_add: true },
    caps: { clients: 1 },
  });
  const therapist = await Therapist.create({
    name: 'Capacity Fixture',
    email: 'capgate@example.test',
    password_hash: 'fixture',
    subscriptionConfig: 'cap-gate',
  });
  const auth = { Authorization: `Bearer ${issueToken(therapist.id)}` };
  const results = await Promise.all(
    [0, 1, 2].map((n) =>
      request(app)
        .post('/api/clients')
        .set(auth)
        .send({ name: `Cap Client ${n}`, email: `capgate${n}@example.test` }),
    ),
  );
  assert.equal(results.filter((result) => result.status === 201).length, 1);
  assert.equal(results.filter((result) => result.status === 403).length, 2);
  assert.equal(await canAccess(therapist.id, 'clients_add'), false);
  const inactive = await request(app)
    .post('/api/clients')
    .set(auth)
    .send({ name: 'Inactive Fixture', email: 'inactivecap@example.test', status: 'inactive' })
    .expect(201);
  await request(app)
    .patch(`/api/clients/${inactive.body.client._id}`)
    .set(auth)
    .send({ status: 'active' })
    .expect(403);
  await SubscriptionTierConfig.updateOne({ key: 'cap-gate' }, { $set: { 'caps.clients': 2 } });
  assert.equal(await canAccess(therapist.id, 'clients_add'), true);
  await request(app)
    .patch(`/api/clients/${inactive.body.client._id}`)
    .set(auth)
    .send({ status: 'active' })
    .expect(200);
  await request(app).delete(`/api/clients/${inactive.body.client._id}`).set(auth).expect(200);
  await SubscriptionTierConfig.updateOne({ key: 'cap-gate' }, { $set: { 'caps.clients': 1 } });
  await request(app)
    .patch(`/api/clients/${inactive.body.client._id}`)
    .set(auth)
    .send({ status: 'active' })
    .expect(403);
});
import Client from '../src/models/Client.js';
test('note templates and analytics depth obey live configuration changes and ownership', async () => {
  await SubscriptionTierConfig.create({
    key: 'templates-gate',
    features: {
      crm: true,
      note_freeform: true,
      note_soap: false,
      note_dap: false,
      analytics_basic: true,
      analytics_advanced: false,
    },
    caps: { clients: 5 },
  });
  const therapist = await Therapist.create({
    name: 'Template Gate',
    email: 'templategate@example.test',
    password_hash: 'fixture',
    subscriptionConfig: 'templates-gate',
  });
  const client = await Client.create({
    therapist: therapist.id,
    name: 'Template Client',
    email: 'templateclient@example.test',
  });
  const auth = { Authorization: `Bearer ${issueToken(therapist.id)}` };
  const content = {
    subjective: 'Report',
    objective: 'Observed',
    assessment: 'Assessment',
    plan: 'Plan',
  };
  let response = await request(app)
    .post(`/api/notes/client/${client.id}`)
    .set(auth)
    .send({ format: 'soap', content })
    .expect(403);
  assert.equal(response.body.feature, 'note_soap');
  await request(app).get('/api/analytics/access?depth=basic').set(auth).expect(200);
  response = await request(app).get('/api/analytics/access?depth=advanced').set(auth).expect(403);
  assert.equal(response.body.feature, 'analytics_advanced');
  await SubscriptionTierConfig.updateOne(
    { key: 'templates-gate' },
    { $set: { 'features.note_soap': true, 'features.analytics_advanced': true } },
  );
  const note = await request(app)
    .post(`/api/notes/client/${client.id}`)
    .set(auth)
    .send({ format: 'soap', content })
    .expect(201);
  await request(app).get('/api/analytics/access?depth=advanced').set(auth).expect(200);
  await SubscriptionTierConfig.updateOne(
    { key: 'templates-gate' },
    { $set: { 'features.note_soap': false } },
  );
  await request(app)
    .patch(`/api/notes/${note.body.note._id}`)
    .set(auth)
    .send({ title: 'Blocked edit' })
    .expect(403);
  await request(app).get(`/api/notes/${note.body.note._id}`).set(auth).expect(200);
  await request(app).get('/api/analytics/access').expect(401);
  await request(app)
    .get('/api/analytics/access')
    .set(
      'Authorization',
      `Bearer ${issueToken(client.id, 'client', { therapistId: therapist.id })}`,
    )
    .expect(403);
});
test('upgrade requests persist without granting subscription access or accepting privileged fields', async () => {
  const therapist = await Therapist.create({
    name: 'Upgrade Fixture',
    email: 'upgrade@example.test',
    password_hash: 'fixture',
    subscriptionConfig: 'starter',
  });
  const auth = { Authorization: `Bearer ${issueToken(therapist.id)}` };
  await request(app).get('/api/subscription').set(auth).expect(200);
  const first = await request(app)
    .post('/api/subscription/upgrade-requests')
    .set(auth)
    .send({ targetKey: 'professional', therapist: '000000000000000000000001' })
    .expect(201);
  const second = await request(app)
    .post('/api/subscription/upgrade-requests')
    .set(auth)
    .send({ targetKey: 'professional' })
    .expect(201);
  assert.equal(first.body.request._id, second.body.request._id);
  assert.equal(
    (await Therapist.findById(therapist.id).select('+subscriptionConfig')).subscriptionConfig,
    'starter',
  );
  await request(app)
    .post('/api/subscription/upgrade-requests')
    .set(auth)
    .send({ targetKey: 'unknown' })
    .expect(404);
  await request(app)
    .post('/api/subscription/upgrade-requests')
    .send({ targetKey: 'professional' })
    .expect(401);
});
