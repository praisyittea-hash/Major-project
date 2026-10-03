import mongoose from 'mongoose';
// Legacy fields remain readable so existing CRM records are never discarded.
const schema = new mongoose.Schema(
  {
    therapist: { type: mongoose.Schema.Types.ObjectId, ref: 'Therapist', required: true },
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
    session: { type: mongoose.Schema.Types.ObjectId, ref: 'Session' },
    type: { type: String, enum: ['private', 'shared'], default: 'private', required: true },
    format: { type: String, enum: ['freeform'], default: 'freeform' },
    title: { type: String, trim: true, maxLength: 200, default: '' },
    content: { type: mongoose.Schema.Types.Mixed, select: false },
    privateContent: { type: String, select: false },
    sharedContent: { type: String, default: '' },
  },
  { timestamps: true },
);
schema.index({ therapist: 1, client: 1 });
schema.index({ therapist: 1, client: 1, type: 1, createdAt: -1 });
export default mongoose.model('SessionNote', schema);
