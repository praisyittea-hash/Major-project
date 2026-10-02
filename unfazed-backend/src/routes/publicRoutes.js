import { intakeTemplate } from '../config/intake.js';
import { Router } from 'express';
import Therapist from '../models/Therapist.js';
import { HttpError } from '../middleware/errorHandler.js';
export function publicProfile(therapist) {
  const { name, slug, bio, specializations, languages, services, timezone } = therapist;
  return { name, slug, bio, specializations, languages, services, timezone };
}
const router = Router();
router.get('/:slug', async (req, res) => {
  const therapist = await Therapist.findOne({ slug: req.params.slug });
  if (!therapist) throw new HttpError(404, 'Practice not found');
  res.json({ therapist: publicProfile(therapist), intakeTemplate });
});
export default router;
