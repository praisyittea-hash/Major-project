import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { authenticate, therapistOnly } from '../middleware/authMiddleware.js';
import { requireFeature } from '../middleware/entitlementMiddleware.js';
import { validate } from '../middleware/validate.js';
import {
  createClient,
  listClients,
  getClient,
  updateClient,
  archiveClient,
  history,
  portalLink,
} from '../controllers/clientController.js';
const router = Router();
router.use(authenticate, therapistOnly, requireFeature('crm'));
const input = (optional) => [
  optional
    ? body('name').optional().isString().trim().isLength({ min: 2, max: 100 })
    : body('name').isString().trim().isLength({ min: 2, max: 100 }),
  optional
    ? body('email').optional().isEmail().trim().toLowerCase()
    : body('email').isEmail().trim().toLowerCase(),
  body('phone').optional().isString().isLength({ max: 30 }),
  body('status').optional().isIn(['active', 'inactive', 'archived']),
  body('tags').optional().isArray({ max: 20 }),
  body('tags.*.label').isString().trim().isLength({ min: 1, max: 50 }),
];
router.get(
  '/',
  query('search').optional().isString().isLength({ max: 100 }),
  query('status').optional().isIn(['active', 'inactive', 'archived']),
  query('tag').optional().isString().isLength({ max: 50 }),
  query('page').optional().isInt({ min: 1, max: 10000 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('sort').optional().isIn(['name', 'lastSession', 'status', 'createdAt']),
  query('direction').optional().isIn(['asc', 'desc']),
  validate,
  listClients,
);
router.post('/', ...input(false), validate, createClient);
router.post('/:id/portal-link', param('id').isMongoId(), validate, portalLink);
router.get('/:id/history', param('id').isMongoId(), validate, history);
router.get('/:id', param('id').isMongoId(), validate, getClient);
router.patch('/:id', param('id').isMongoId(), ...input(true), validate, updateClient);
router.delete('/:id', param('id').isMongoId(), validate, archiveClient);
export default router;
