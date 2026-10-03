import mongoose from 'mongoose';
export default mongoose.model(
  'NotificationJob',
  new mongoose.Schema(
    {
      key: { type: String, unique: true, required: true },
      kind: { type: String, required: true },
      recipient: String,
      event: { type: mongoose.Schema.Types.ObjectId, ref: 'DomainEvent' },
      therapist: { type: mongoose.Schema.Types.ObjectId, ref: 'Therapist' },
      client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
      payload: mongoose.Schema.Types.Mixed,
      status: { type: String, enum: ['stubbed', 'queued', 'sent', 'failed'], default: 'stubbed' },
    },
    { timestamps: true },
  ),
);
