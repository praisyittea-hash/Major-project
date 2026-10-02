import mongoose from 'mongoose';
import { paymentConfig } from '../config/payments.js';
const schema = new mongoose.Schema(
  {
    therapist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Therapist',
      required: true,
      index: true,
    },
    name: { type: String, required: true, maxLength: 100 },
    serviceId: { type: mongoose.Schema.Types.ObjectId, required: true },
    sessionCount: {
      type: Number,
      required: true,
      validate: (v) => paymentConfig().packageCounts.includes(v),
    },
    amount: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
    expiryDays: {
      type: Number,
      default: () => paymentConfig().packageExpiryDays,
      min: 1,
      max: 730,
    },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);
export default mongoose.model('Package', schema);
