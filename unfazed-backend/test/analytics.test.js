import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { database } from './helpers.js';
import { app } from '../src/app.js';
import Therapist from '../src/models/Therapist.js';
import Client from '../src/models/Client.js';
import Payment from '../src/models/Payment.js';
import { issueToken } from '../src/services/tokenService.js';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'isolated-analytics-test-secret-not-for-production';
let close, therapist, client, auth;
before(async () => {
  close = await database();
  therapist = await Therapist.create({
    name: 'Analytics Fixture',
    email: 'analytics@example.test',
    password_hash: 'fixture',
    subscriptionConfig: 'professional',
  });
  client = await Client.create({
    therapist: therapist.id,
    name: 'Active Fixture',
    email: 'activeanalytics@example.test',
  });
  await Client.create({
    therapist: therapist.id,
    name: 'Inactive Fixture',
    email: 'inactiveanalytics@example.test',
    status: 'inactive',
  });
  auth = { Authorization: `Bearer ${issueToken(therapist.id)}` };
});
after(async () => {
  if (close) await close();
});
test('revenue trend and active clients are aggregated from persisted, tenant-scoped data', async () => {
  for (const [n, status, amount, capturedAt] of [
    [1, 'captured', 150000, '2030-01-10'],
    [2, 'captured', 200000, '2030-02-10'],
    [3, 'failed', 900000, '2030-01-10'],
    [4, 'refunded', 800000, '2030-01-10'],
  ]) {
    await Payment.create({
      therapist: therapist.id,
      client: client.id,
      purchaseKey: `analytics-${n}`,
      amount,
      platform_fee: 1000,
      net_amount: amount - 1000,
      subtotal: amount,
      status,
      capturedAt: new Date(capturedAt),
    });
  }
  const other = await Therapist.create({
    name: 'Other Analytics',
    email: 'otheranalytics@example.test',
    password_hash: 'fixture',
  });
  await Payment.create({
    therapist: other.id,
    client: client.id,
    purchaseKey: 'other-analytics',
    amount: 1000000,
    platform_fee: 0,
    net_amount: 1000000,
    subtotal: 1000000,
    status: 'captured',
    capturedAt: new Date('2030-01-10'),
  });
  const result = await request(app)
    .get('/api/analytics?from=2030-01-01&to=2030-02-28&depth=advanced')
    .set(auth)
    .expect(200);
  assert.equal(result.body.activeClients, 1);
  assert.equal(result.body.totals.revenuePaise, 350000);
  assert.deepEqual(
    result.body.revenueTrend.map(({ period, revenuePaise }) => ({ period, revenuePaise })),
    [
      { period: '2030-01', revenuePaise: 150000 },
      { period: '2030-02', revenuePaise: 200000 },
    ],
  );
  const basic = await request(app)
    .get('/api/analytics?from=2030-01-01&to=2030-01-31')
    .set(auth)
    .expect(200);
  assert.equal(basic.body.totals.revenuePaise, 150000);
  assert.equal(basic.body.revenueTrend[0].netPaise, undefined);
  await request(app).get('/api/analytics').expect(401);
  await request(app).get('/api/analytics?from=2030-02-01&to=2030-01-01').set(auth).expect(400);
  await request(app).get('/api/analytics?from=2020-01-01&to=2030-01-01').set(auth).expect(400);
});
import Session from '../src/models/Session.js';
test('no-show rate is calculated by MongoDB over finalized outcomes; cancelled and unresolved sessions are excluded', async () => {
  for (const [n, status] of [
    'completed',
    'completed',
    'no_show',
    'cancelled',
    'confirmed',
    'pending_payment',
  ].entries()) {
    await Session.create({
      therapist: therapist.id,
      client: client.id,
      contact: { name: client.name, email: client.email },
      duration: 60,
      start: new Date(`2020-01-${10 + n}T10:00:00Z`),
      end: new Date(`2020-01-${10 + n}T11:00:00Z`),
      status,
    });
  }
  const response = await request(app)
    .get('/api/analytics?from=2020-01-01&to=2020-01-31&depth=advanced')
    .set(auth)
    .expect(200);
  assert.equal(response.body.attendance.outcomes, 3);
  assert.equal(response.body.attendance.noShows, 1);
  assert.ok(Math.abs(response.body.attendance.noShowRate - 100 / 3) < 0.001);
  assert.equal(response.body.attendanceTrend[0].period, '2020-01');
  const empty = await request(app)
    .get('/api/analytics?from=2020-02-01&to=2020-02-28')
    .set(auth)
    .expect(200);
  assert.equal(empty.body.attendance.noShowRate, 0);
});
test('only the owning therapist can mark attendance after a confirmed session has ended', async () => {
  const session = await Session.create({
    therapist: therapist.id,
    client: client.id,
    contact: { name: client.name, email: client.email },
    duration: 60,
    start: new Date('2020-02-01T10:00:00Z'),
    end: new Date('2020-02-01T11:00:00Z'),
    status: 'confirmed',
  });
  const other = await Therapist.findOne({ email: 'otheranalytics@example.test' });
  await request(app)
    .post(`/api/scheduling/sessions/${session.id}/no-show`)
    .set('Authorization', `Bearer ${issueToken(other.id)}`)
    .expect(404);
  await request(app)
    .post(`/api/scheduling/sessions/${session.id}/no-show`)
    .set(
      'Authorization',
      `Bearer ${issueToken(client.id, 'client', { therapistId: therapist.id })}`,
    )
    .expect(403);
  await request(app).post(`/api/scheduling/sessions/${session.id}/no-show`).set(auth).expect(200);
  await request(app).post(`/api/scheduling/sessions/${session.id}/complete`).set(auth).expect(409);
  const future = await Session.create({
    therapist: therapist.id,
    contact: { name: client.name, email: client.email },
    duration: 60,
    start: new Date('2090-01-01T10:00:00Z'),
    end: new Date('2090-01-01T11:00:00Z'),
    status: 'confirmed',
  });
  await request(app).post(`/api/scheduling/sessions/${future.id}/no-show`).set(auth).expect(409);
});
