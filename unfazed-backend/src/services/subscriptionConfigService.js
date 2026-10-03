import SubscriptionTierConfig from '../models/SubscriptionTierConfig.js';
import { tierDefaults } from '../config/subscriptionTiers.js';
export async function ensureTierConfigs() {
  await SubscriptionTierConfig.init();
  for (const config of tierDefaults)
    await SubscriptionTierConfig.updateOne(
      { key: config.key },
      { $setOnInsert: { ...config, configVersion: 2 } },
      { upsert: true, runValidators: true },
    );
  await backfillLegacyDefaultConfig();
}

export async function backfillLegacyDefaultConfig() {
  const baseline = tierDefaults.find((config) => config.key === 'default');
  const legacy = await SubscriptionTierConfig.findOne({
    key: baseline.key,
    configVersion: { $exists: false },
  }).lean();
  if (!legacy) return;
  const updates = { configVersion: 2 };
  if (!legacy.name) updates.name = baseline.name;
  for (const [key, value] of Object.entries(baseline.features))
    if (legacy.features?.[key] === undefined) updates[`features.${key}`] = value;
  await SubscriptionTierConfig.updateOne(
    { _id: legacy._id, configVersion: { $exists: false } },
    { $set: updates },
  );
}
