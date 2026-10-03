import mongoose from 'mongoose';
const schema = new mongoose.Schema(
  {
    therapist: { type: mongoose.Schema.Types.ObjectId, ref: 'Therapist', required: true },
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, required: true },
    senderRole: { type: String, enum: ['therapist', 'client'], required: true },
    clientMessageId: { type: String, required: true },
    text: { type: String, required: true, maxLength: 4000 },
  },
  { timestamps: true },
);
schema.index({ therapist: 1, client: 1, sender: 1, clientMessageId: 1 }, { unique: true });
schema.index({ therapist: 1, client: 1, _id: -1 });
export default mongoose.model('ChatMessage', schema);
