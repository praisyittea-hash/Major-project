import mongoose from 'mongoose';
const schema = new mongoose.Schema(
  {
    key: { type: String, unique: true, required: true },
    kind: { type: String, required: true },
    therapist: { type: mongoose.Schema.Types.ObjectId, ref: 'Therapist', required: true },
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
    recipient: { type: String, required: true },
    payload: mongoose.Schema.Types.Mixed,
    dispatchedAt: Date,
  },
  { timestamps: true },
);
schema.index({ dispatchedAt: 1, createdAt: 1 });
export default mongoose.model('DomainEvent', schema);
