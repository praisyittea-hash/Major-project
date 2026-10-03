import mongoose from 'mongoose';
const schema = new mongoose.Schema(
  {
    key: { type: String, unique: true, required: true },
    configVersion: Number,
    name: { type: String, trim: true, maxLength: 100 },
    pricePaise: {
      type: Number,
      min: 0,
      default: null,
      validate: { validator: (value) => value === null || Number.isSafeInteger(value) },
    },
    currency: { type: String, enum: ['INR'], default: 'INR' },
    listed: { type: Boolean, default: true },
    features: { type: Map, of: Boolean, default: {} },
    caps: {
      type: Map,
      of: {
        type: Number,
        min: 0,
        validate: { validator: (value) => value === null || Number.isSafeInteger(value) },
      },
      default: {},
    },
  },
  { timestamps: true },
);
export default mongoose.model('SubscriptionTierConfig', schema);
