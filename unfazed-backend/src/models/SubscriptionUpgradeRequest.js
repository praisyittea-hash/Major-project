import mongoose from 'mongoose';
const schema = new mongoose.Schema(
  {
    therapist: { type: mongoose.Schema.Types.ObjectId, ref: 'Therapist', required: true },
    targetKey: { type: String, required: true },
    status: { type: String, enum: ['pending', 'completed', 'declined'], default: 'pending' },
  },
  { timestamps: true },
);
schema.index(
  { therapist: 1, targetKey: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } },
);
export default mongoose.model('SubscriptionUpgradeRequest', schema);
