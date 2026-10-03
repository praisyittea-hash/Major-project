import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate, therapistOnly } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';
import { entitlementsFor } from '../services/entitlementService.js';
import SubscriptionTierConfig from '../models/SubscriptionTierConfig.js';
import SubscriptionUpgradeRequest from '../models/SubscriptionUpgradeRequest.js';
import { HttpError } from '../middleware/errorHandler.js';
const router = Router();
router.use(authenticate, therapistOnly);
router.get('/', async (req, res) =>
  res.json({
    current: (await entitlementsFor(req.therapist.id)).plan,
    tiers: await SubscriptionTierConfig.find({ listed: true }).select(
      'key name features caps pricePaise currency',
    ),
    requests: await SubscriptionUpgradeRequest.find({ therapist: req.therapist.id })
      .sort({ createdAt: -1 })
      .limit(20),
  }),
);
router.post(
  '/upgrade-requests',
  body('targetKey').isString().isLength({ min: 1, max: 100 }),
  validate,
  async (req, res) => {
    if (!(await SubscriptionTierConfig.exists({ key: req.body.targetKey, listed: true })))
      throw new HttpError(404, 'Plan not available');
    const upgradeRequest = await SubscriptionUpgradeRequest.findOneAndUpdate(
      { therapist: req.therapist.id, targetKey: req.body.targetKey, status: 'pending' },
      { $setOnInsert: { status: 'pending' } },
      { upsert: true, new: true },
    );
    res.status(201).json({
      request: upgradeRequest,
      message:
        'Upgrade request saved. Your practice administrator must confirm pricing and activate the plan.',
    });
  },
);
export default router;
