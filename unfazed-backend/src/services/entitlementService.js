import Client from '../models/Client.js';
import { HttpError } from '../middleware/errorHandler.js';
import Therapist from '../models/Therapist.js';
import SubscriptionTierConfig from '../models/SubscriptionTierConfig.js';
const denied = () => ({ features: {}, caps: {}, configured: false });
const plain = (map) => Object.fromEntries(map instanceof Map ? map : Object.entries(map || {}));
export async function entitlementsFor(therapist, { session = null } = {}) {
  const id = typeof therapist === 'string' ? therapist : therapist?._id || therapist?.id;
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

export async function canAccess(therapistId, featureKey, options = {}) {
  const access = await entitlementsFor(therapistId, options);
  if (!access.configured) return false;
  if (featureKey === 'clients_add') {
    if (
      access.features.crm !== true ||
      (access.features.clients_add ?? access.features.crm) !== true
    )
      return false;
    const cap = access.caps.clients;
    if (cap === null) return true;
    if (!Number.isSafeInteger(cap) || cap < 0) return false;
    const id = typeof therapistId === 'string' ? therapistId : therapistId?._id || therapistId?.id;
    const active = await Client.countDocuments({ therapist: id, status: 'active' }).session(
      options.session || null,
    );
    return active < cap;
  }
  return access.features[featureKey] === true;
}
export async function hasFeature(therapist, feature) {
  return canAccess(
    typeof therapist === 'string' ? therapist : String(therapist?._id || therapist?.id || ''),
    feature,
  );
}
export async function assertAccess(therapistId, featureKey, options = {}) {
  if (!(await canAccess(therapistId, featureKey, options))) {
    const error = new HttpError(
      403,
      'This feature is unavailable for your current subscription. Review upgrade options.',
    );
    error.code = 'ENTITLEMENT_REQUIRED';
    error.feature = featureKey;
    error.upgradePath = '/subscription';
    throw error;
  }
}
export const EntitlementService = { entitlementsFor, canAccess, hasFeature, assertAccess };
