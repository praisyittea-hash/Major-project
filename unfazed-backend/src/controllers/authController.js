import { issueToken } from '../services/tokenService.js';
import { HttpError } from '../middleware/errorHandler.js';
import { generateSlug } from '../utils/generateSlug.js';
import bcrypt from 'bcryptjs';
import Therapist from '../models/Therapist.js';
export async function register(req, res) {
  const { name, email, password } = req.body;
  const therapist = await Therapist.create({
    name,
    email,
    slug: await generateSlug(name),
    password_hash: await bcrypt.hash(password, 12),
  });
  res.status(201).json({ therapist, token: issueToken(therapist.id) });
}

export async function login(req, res) {
  const therapist = await Therapist.findOne({ email: req.body.email }).select('+password_hash');
  if (!therapist || !(await bcrypt.compare(req.body.password, therapist.password_hash)))
    throw new HttpError(401, 'Email or password is incorrect');
  res.json({ therapist, token: issueToken(therapist.id) });
}
