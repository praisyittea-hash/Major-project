import Therapist from '../models/Therapist.js';
import SubscriptionTierConfig from '../models/SubscriptionTierConfig.js';
const denied = () => ({ features: {}, caps: {}, configured: false });
const plain = (map) => Object.fromEntries(map instanceof Map ? map : Object.entries(map || {}));
export async function entitlementsFor(therapist, { session = null } = {}) {
  const id = therapist?.id || therapist?._id || therapist;
  if (!id) return denied();
  const account = await Therapist.findById(id).select('+subscriptionConfig').session(session);
  if (!account) return denied();
  const config = await SubscriptionTierConfig.findOne({ key: account.subscriptionConfig })
    .session(session)
    .lean();
  if (!config) return denied();
  return {
    features: plain(config.features),
    caps: plain(config.caps),
    configured: true,
    plan: {
      key: config.key,
      name: config.name || config.key,
      pricePaise: config.pricePaise,
      currency: config.currency,
    },
  };
}
export async function hasFeature(therapist, feature) {
  const access = await entitlementsFor(therapist);
  return access.features[feature] === true;
}
export const EntitlementService = { entitlementsFor, hasFeature };
