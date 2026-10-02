import mongoose from 'mongoose';
const schema = new mongoose.Schema(
  {
    therapist: { type: mongoose.Schema.Types.ObjectId, ref: 'Therapist', required: true },
    email: { type: String, required: true, lowercase: true },
    name: { type: String, required: true },
    date: { type: String, required: true },
    duration: { type: Number, enum: [30, 45, 60, 90] },
    notificationQueuedAt: Date,
  },
  { timestamps: true },
);
schema.index({ therapist: 1, email: 1, date: 1, duration: 1 }, { unique: true });
export default mongoose.model('Waitlist', schema);
