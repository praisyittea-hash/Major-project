import mongoose from 'mongoose';
const schema = new mongoose.Schema(
  {
    therapist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Therapist',
      required: true,
      index: true,
    },
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
    contact: {
      name: { type: String, required: true, maxLength: 100 },
      email: { type: String, required: true, lowercase: true },
    },
    start: { type: Date, required: true },
    end: { type: Date, required: true },
    bufferMinutes: { type: Number, default: 0 },
    duration: { type: Number, enum: [30, 45, 60, 90], required: true },
    serviceId: { type: mongoose.Schema.Types.ObjectId },
    rate: { type: Number, min: 0, validate: Number.isSafeInteger, default: 0 },
    status: {
      type: String,
      enum: ['confirmed', 'pending_payment', 'cancelled', 'completed'],
      default: 'confirmed',
    },
    paymentStatus: {
      type: String,
      enum: ['unpaid', 'pending', 'paid', 'failed', 'package', 'refund_required'],
      default: 'unpaid',
    },
    holdExpiresAt: Date,
    package: { type: mongoose.Schema.Types.ObjectId, ref: 'ClientPackage' },
  },
  { timestamps: true },
);
schema.index({ therapist: 1, start: 1, status: 1 });
export default mongoose.model('Session', schema);
