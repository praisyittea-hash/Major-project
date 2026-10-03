import { practiceAnalytics } from '../services/analyticsService.js';
import { Router } from 'express';
import { query } from 'express-validator';
import { authenticate, therapistOnly } from '../middleware/authMiddleware.js';
import { requireFeature } from '../middleware/entitlementMiddleware.js';
import { validate } from '../middleware/validate.js';
import { assertAccess } from '../services/entitlementService.js';
const router = Router();
router.use(authenticate, therapistOnly, requireFeature('analytics_basic'));
export const analyticsAccess = [
  query('depth').optional().isIn(['basic', 'advanced']),
  validate,
  async (req, _res, next) => {
    if (req.query.depth === 'advanced') await assertAccess(req.therapist.id, 'analytics_advanced');
    next();
  },
];
router.get('/access', ...analyticsAccess, (req, res) =>
  res.json({ depth: req.query.depth || 'basic', allowed: true }),
);
router.get(
  '/',
  ...analyticsAccess,
  query('from').optional().isDate({ format: 'YYYY-MM-DD' }),
  query('to').optional().isDate({ format: 'YYYY-MM-DD' }),
  validate,
  async (req, res) => res.json(await practiceAnalytics(req.therapist.id, req.query)),
);
export default router;
