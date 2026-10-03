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
