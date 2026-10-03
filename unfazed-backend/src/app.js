import chatRoutes from './routes/chatRoutes.js';
import mongoose from 'mongoose';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import therapistRoutes from './routes/therapistRoutes.js';
import publicRoutes from './routes/publicRoutes.js';
import schedulingRoutes, { publicScheduling, bookingRoutes } from './routes/schedulingRoutes.js';
import clientRoutes from './routes/clientRoutes.js';
import portalRoutes from './routes/portalRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import packageRoutes from './routes/packageRoutes.js';
import noteRoutes from './routes/noteRoutes.js';
import { webhook } from './controllers/paymentController.js';
import { rateLimit } from 'express-rate-limit';
import authRoutes from './routes/authRoutes.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import Therapist from './models/Therapist.js';
import { profileHtml } from './services/profileHtmlService.js';
import { fileURLToPath } from 'node:url';
import { corsOrigin, proxyHops } from './config/http.js';
export const app = express();
app.set('trust proxy', proxyHops());
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        'upgrade-insecure-requests': process.env.NODE_ENV === 'production' ? [] : null,
        'script-src': ["'self'", 'https://checkout.razorpay.com'],
        'frame-src': ["'self'", 'https://api.razorpay.com', 'https://checkout.razorpay.com'],
        'connect-src': ["'self'", 'https://api.razorpay.com', 'https://checkout.razorpay.com'],
        'img-src': ["'self'", 'data:', 'https://*.razorpay.com'],
        'style-src': ["'self'", "'unsafe-inline'"],
      },
    },
  }),
);
app.use(cors({ origin: corsOrigin }));
app.post(
  '/api/payments/webhook',
  express.raw({ type: 'application/json', limit: '128kb' }),
  webhook,
);
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'private, no-store');
  next();
});
app.use(express.json({ limit: '64kb' }));
app.get('/api/ready', (_req, res) =>
  res
    .status(mongoose.connection.readyState === 1 ? 200 : 503)
    .json({ database: mongoose.connection.readyState === 1 ? 'connected' : 'unavailable' }),
);
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRoutes);
app.use('/api/therapists', therapistRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/scheduling', schedulingRoutes);
app.use(
  '/api/public',
  rateLimit({ windowMs: 60000, limit: 120, skip: () => process.env.NODE_ENV === 'test' }),
);
app.use('/api/public', publicScheduling);
app.use('/api/public', publicRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/portal', portalRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/packages', packageRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/chat', chatRoutes);
app.use(express.static(fileURLToPath(new URL('../../unfazed-frontend/dist', import.meta.url))));
app.get('/:slug', async (req, res, next) => {
  const therapist = await Therapist.findOne({ slug: req.params.slug });
  if (!therapist) return next();
  res.type('html').send(await profileHtml(therapist));
});
app.get(/^\/(?!api(?:\/|$)).*/, (_req, res) =>
  res.sendFile(fileURLToPath(new URL('../../unfazed-frontend/dist/index.html', import.meta.url))),
);
app.use(notFound);
app.use(errorHandler);
