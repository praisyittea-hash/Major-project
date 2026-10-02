import { Router } from 'express';
import { body, param } from 'express-validator';
import { authenticate, therapistOnly } from '../middleware/authMiddleware.js';
import { clientOnly } from '../middleware/clientAuthMiddleware.js';
import { requireFeature } from '../middleware/entitlementMiddleware.js';
import { validate } from '../middleware/validate.js';
import { paymentConfig } from '../config/payments.js';
import {
  listPackages,
  createPackage,
  archivePackage,
  portalPackages,
  purchasePackage,
} from '../controllers/packageController.js';
const router = Router();
router.use(authenticate);
router.get('/portal', clientOnly, portalPackages);
router.post(
  '/:id/orders',
  clientOnly,
  param('id').isMongoId(),
  body('idempotencyKey').isUUID(),
  validate,
  purchasePackage,
);
router.use(therapistOnly, requireFeature('packages'));
router.get('/', listPackages);
router.post(
  '/',
  body('name').isString().trim().isLength({ min: 2, max: 100 }),
  body('serviceId').isMongoId(),
  body('sessionCount').custom((v) => paymentConfig().packageCounts.includes(v)),
  body('amount').isInt({ min: 1, max: 100000000 }),
  body('expiryDays').optional().isInt({ min: 1, max: 730 }),
  validate,
  createPackage,
);
router.delete('/:id', param('id').isMongoId(), validate, archivePackage);
export default router;
