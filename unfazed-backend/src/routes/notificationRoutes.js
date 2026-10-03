import { Router } from 'express';
import { authenticate, therapistOnly } from '../middleware/authMiddleware.js';
import DomainEvent from '../models/DomainEvent.js';
import NotificationJob from '../models/NotificationJob.js';
const router = Router();
router.use(authenticate, therapistOnly);
router.get('/', async (req, res) =>
  res.json({
    events: await DomainEvent.find({ therapist: req.therapist.id })
      .sort({ createdAt: -1 })
      .limit(100),
    jobs: await NotificationJob.find({ therapist: req.therapist.id })
      .sort({ createdAt: -1 })
      .limit(200),
  }),
);
export default router;
