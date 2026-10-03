import { Router } from 'express';
import { param, query } from 'express-validator';
import { authenticate } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';
import { conversationAccess } from '../services/chatService.js';
import ChatMessage from '../models/ChatMessage.js';
const router = Router();
router.use(authenticate);
router.get(
  '/:clientId/messages',
  param('clientId').isMongoId(),
  query('before').optional().isMongoId(),
  validate,
  async (req, res) => {
    const conversation = await conversationAccess(req.auth, req.params.clientId);
    const filter = { therapist: conversation.therapist, client: conversation.client };
    if (req.query.before) filter._id = { $lt: req.query.before };
    const messages = await ChatMessage.find(filter).sort({ _id: -1 }).limit(50);
    res.json({
      messages: messages.toReversed(),
      nextCursor: messages.length === 50 ? messages.at(-1).id : null,
    });
  },
);
export default router;
