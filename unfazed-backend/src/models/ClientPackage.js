import mongoose from 'mongoose';
const schema = new mongoose.Schema(
  {
    therapist: { type: mongoose.Schema.Types.ObjectId, ref: 'Therapist', required: true },
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
    package: { type: mongoose.Schema.Types.ObjectId, ref: 'Package', required: true },
    payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', required: true, unique: true },
    name: String,
    serviceId: { type: mongoose.Schema.Types.ObjectId, required: true },
    sessionCount: { type: Number, required: true, min: 1 },
    amount: { type: Number, required: true },
    perSessionRate: { type: Number, required: true },
    baseRate: { type: Number, required: true },
    rateRemainder: { type: Number, default: 0 },
    usedSessions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Session' }],
    expiresAt: { type: Date, required: true },
    status: { type: String, enum: ['active', 'refunded'], default: 'active' },
  },
  { timestamps: true },
);
schema.index({ therapist: 1, client: 1 });
export default mongoose.model('ClientPackage', schema);
