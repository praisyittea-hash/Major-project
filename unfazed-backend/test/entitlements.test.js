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
