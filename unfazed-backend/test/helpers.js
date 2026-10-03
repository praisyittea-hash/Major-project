import { ensureTierConfigs } from '../src/services/subscriptionConfigService.js';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';
export async function database() {
  const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await connectDB(mongo.getUri());
  await ensureTierConfigs();
  return async () => {
    await mongoose.disconnect();
    await mongo.stop();
  };
}
