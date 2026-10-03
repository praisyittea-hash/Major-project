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
