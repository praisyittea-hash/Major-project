import { assertAccess } from '../services/entitlementService.js';
export const requireFeature = (feature) => async (req, _res, next) => {
  await assertAccess(req.therapist.id, feature);
  next();
};
