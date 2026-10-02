import Therapist from '../models/Therapist.js';
import SubscriptionTierConfig from '../models/SubscriptionTierConfig.js';
import { defaultEntitlements } from '../config/features.js';
export async function entitlementsFor(therapist) {
  if (!therapist) return { features: {}, caps: { clients: 0 } };
  const account = therapist.subscriptionConfig
    ? therapist
    : await Therapist.findById(therapist.id || therapist._id).select('+subscriptionConfig');
  if (!account) return { features: {}, caps: { clients: 0 } };
  const key = account.subscriptionConfig || 'default';
  const config = await SubscriptionTierConfig.findOne({ key }).lean();
  if (!config)
    return key === 'default'
      ? structuredClone(defaultEntitlements)
      : { features: {}, caps: { clients: 0 } };
  const plain = (map) => Object.fromEntries(map instanceof Map ? map : Object.entries(map || {}));
  return { features: plain(config.features), caps: plain(config.caps) };
}
export async function hasFeature(therapist, feature) {
  const access = await entitlementsFor(therapist);
  return access.features[feature] === true;
}
