import SubscriptionTierConfig from '../models/SubscriptionTierConfig.js';
import { tierDefaults } from '../config/subscriptionTiers.js';
export async function ensureTierConfigs() {
  await SubscriptionTierConfig.init();
  for (const config of tierDefaults)
    await SubscriptionTierConfig.updateOne(
      { key: config.key },
      { $setOnInsert: config },
      { upsert: true, runValidators: true },
    );
}
