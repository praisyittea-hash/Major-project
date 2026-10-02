import mongoose from 'mongoose';
export default mongoose.model(
  'NotificationJob',
  new mongoose.Schema(
    {
      key: { type: String, unique: true, required: true },
      kind: { type: String, required: true },
      recipient: String,
      payload: mongoose.Schema.Types.Mixed,
      status: { type: String, enum: ['stubbed', 'queued', 'sent', 'failed'], default: 'stubbed' },
    },
    { timestamps: true },
  ),
);
