import { Router } from 'express';
import { body, param } from 'express-validator';
import { authenticate, therapistOnly } from '../middleware/authMiddleware.js';
import { requireFeature } from '../middleware/entitlementMiddleware.js';
import { validate } from '../middleware/validate.js';
import SessionNote from '../models/SessionNote.js';
import { noteClient, ownedNote, noteInput } from '../services/noteService.js';
const router = Router();
router.use(authenticate, therapistOnly, requireFeature('crm'));
const input = [
  body('type').optional().isIn(['private', 'shared']),
  body('title').optional().isString().trim().isLength({ max: 200 }),
  body('format').optional().isIn(['freeform']),
  body('content').optional().isObject(),
  body('session').optional().isMongoId(),
];
router.get('/client/:clientId', param('clientId').isMongoId(), validate, async (req, res) => {
  await noteClient(req.therapist.id, req.params.clientId);
  res.json({
    notes: await SessionNote.find({ therapist: req.therapist.id, client: req.params.clientId })
      .select('+content +privateContent')
      .sort({ createdAt: -1 })
      .limit(200),
  });
});
router.post(
  '/client/:clientId',
  param('clientId').isMongoId(),
  ...input,
  body('content').exists(),
  validate,
  async (req, res) => {
    await noteClient(req.therapist.id, req.params.clientId);
    const note = await SessionNote.create({
      ...noteInput(req.body),
      therapist: req.therapist.id,
      client: req.params.clientId,
    });
    res.status(201).json({ note });
  },
);
router.get('/:id', param('id').isMongoId(), validate, async (req, res) =>
  res.json({ note: await ownedNote(req.therapist.id, req.params.id) }),
);
router.patch('/:id', param('id').isMongoId(), ...input, validate, async (req, res) => {
  const note = await ownedNote(req.therapist.id, req.params.id);
  Object.assign(note, noteInput(req.body));
  await note.save();
  res.json({ note });
});
router.delete('/:id', param('id').isMongoId(), validate, async (req, res) => {
  const note = await ownedNote(req.therapist.id, req.params.id);
  await note.deleteOne();
  res.status(204).end();
});
export default router;
