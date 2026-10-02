import mongoose from 'mongoose';
const schema = new mongoose.Schema(
  {
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      required: true,
      immutable: true,
    },
    therapist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Therapist',
      required: true,
      immutable: true,
    },
    version: { type: String, required: true, immutable: true },
    text: { type: String, required: true, immutable: true },
    accepted: { type: Boolean, required: true, immutable: true, validate: (v) => v === true },
    acceptedAt: { type: Date, required: true, immutable: true },
    name: { type: String, required: true, immutable: true },
    source: { type: String, default: 'client-portal', immutable: true },
  },
  { timestamps: true },
);
schema.index({ client: 1, version: 1 }, { unique: true });
export default mongoose.model('ConsentAudit', schema);
