import NotificationJob from '../models/NotificationJob.js';
import { clientHistory } from '../services/clientHistoryService.js';
import { sharedNotes } from '../services/noteSerializer.js';
import { portalBook } from '../controllers/schedulingController.js';
import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate } from '../middleware/authMiddleware.js';
import { clientOnly } from '../middleware/clientAuthMiddleware.js';
import { validate } from '../middleware/validate.js';
import { intakeTemplate } from '../config/intake.js';
import { submitIntake } from '../controllers/intakeController.js';
const router = Router();
router.use(authenticate, clientOnly);
router.get('/notifications', async (req, res) =>
  res.json({
    jobs: await NotificationJob.find({ therapist: req.client.therapist, client: req.client.id })
      .select('kind channel status detail createdAt')
      .sort({ createdAt: -1 })
      .limit(100),
  }),
);
router.get('/notes', async (req, res) => res.json({ notes: await sharedNotes(req.client) }));
router.get('/history', async (req, res) =>
  res.json(await clientHistory(req.client, { sharedOnly: true })),
);
router.get('/me', (req, res) => res.json({ client: req.client, template: intakeTemplate }));
export const intakeRules = () => [
  body('consent.accepted').custom((v) => v === true),
  body('consent.version').equals(intakeTemplate.consentVersion),
  body('demographics').isObject(),
  body('demographics.age').isInt({ min: 0, max: 120 }),
  ...['pronouns', 'location', 'occupation'].map((key) =>
    body(`demographics.${key}`).optional().isString().isLength({ max: 200 }),
  ),
  body('presentingConcern').isString().trim().isLength({ min: 10, max: 5000 }),
  body('history').isObject(),
  ...['priorTherapy', 'medicalHistory', 'medications'].map((key) =>
    body(`history.${key}`).optional().isString().isLength({ max: 3000 }),
  ),
];
router.post(
  '/book',
  body('serviceId').isMongoId(),
  body('start').isISO8601({ strict: true }),
  body('clientPackage').optional().isMongoId(),
  validate,
  portalBook,
);
router.post('/intake', ...intakeRules(), validate, submitIntake);
export default router;
