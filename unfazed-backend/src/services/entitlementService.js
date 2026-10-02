import SubscriptionTierConfig from '../models/SubscriptionTierConfig.js';
import {defaultEntitlements} from '../config/features.js';
export async function entitlementsFor(therapist){const config=await SubscriptionTierConfig.findOne({key:therapist.subscriptionConfig}).lean();return config?{features:Object.fromEntries(config.features instanceof Map?config.features:Object.entries(config.features)),caps:Object.fromEntries(config.caps instanceof Map?config.caps:Object.entries(config.caps))}:structuredClone(defaultEntitlements);}
export async function hasFeature(therapist,feature){const access=await entitlementsFor(therapist);return access.features[feature]===true;}
