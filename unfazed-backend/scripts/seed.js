import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectDB } from '../src/config/db.js';
import Client from '../src/models/Client.js';
import Package from '../src/models/Package.js';
import Session from '../src/models/Session.js';
import Availability from '../src/models/Availability.js';
import { generateSlug } from '../src/utils/generateSlug.js';
import Therapist from '../src/models/Therapist.js';
import SubscriptionTierConfig from '../src/models/SubscriptionTierConfig.js';
import { defaultEntitlements } from '../src/config/features.js';
export async function seed() {
  if (process.env.SEED_DATABASE_ALLOW !== 'true')
    throw new Error(
      'Set SEED_DATABASE_ALLOW=true explicitly for a development database. Seed never deletes or updates existing records.',
    );
  if (!process.env.SEED_PASSWORD || process.env.SEED_PASSWORD.length < 10)
    throw new Error('Set SEED_PASSWORD to a development-only password (10+ characters)');
  const therapists = [
    {
      name: 'Dr Meera Sharma',
      email: 'meera@unfazed.example',
      slug: 'dr-meera-sharma',
      bio: 'I offer a warm, collaborative space to explore anxiety, life transitions and relationships. Together, we work at your pace.',
      specializations: ['Anxiety', 'Life transitions', 'Relationships'],
      languages: ['English', 'Hindi'],
    },
    {
      name: 'Dr Arjun Nair',
      email: 'arjun@unfazed.example',
      slug: 'dr-arjun-nair',
      bio: 'An evidence-informed approach to wellbeing, supporting adults navigating work stress and burnout.',
      specializations: ['Burnout', 'Stress'],
      languages: ['English', 'Malayalam'],
    },
  ];
  await SubscriptionTierConfig.updateOne(
    { key: 'default' },
    { $setOnInsert: defaultEntitlements },
    { upsert: true },
  );
  for (const data of therapists) {
    if (await Therapist.exists({ email: data.email })) continue;
    await Therapist.create({
      ...data,
      slug: await generateSlug(data.name),
      password_hash: await bcrypt.hash(process.env.SEED_PASSWORD, 12),
      services: [
        {
          name: 'Individual therapy',
          description: 'A private one-to-one session, online.',
          duration: 60,
          rate: 150000,
        },
      ],
    });
  }
  const therapist = await Therapist.findOne({ email: therapists[0].email });
  await Availability.updateOne(
    { therapist: therapist.id },
    {
      $setOnInsert: {
        timezone: 'Asia/Kolkata',
        weekly: [1, 2, 3, 4, 5].map((day) => ({
          day,
          windows: [{ start: '09:00', end: '17:00' }],
        })),
      },
    },
    { upsert: true },
  );
  for (const [i, name] of ['Ananya Rao', 'Rohan Patel', 'Priya Menon'].entries()) {
    const start = new Date();
    start.setUTCDate(start.getUTCDate() + i + 1);
    start.setUTCHours(5, 0, 0, 0);
    await Session.updateOne(
      { therapist: therapist.id, 'contact.email': `client${i + 1}@unfazed.example` },
      {
        $setOnInsert: {
          contact: { name, email: `client${i + 1}@unfazed.example` },
          start,
          end: new Date(start.getTime() + 3600000),
          duration: 60,
          serviceId: therapist.services[0].id,
          rate: therapist.services[0].rate,
          bufferMinutes: 10,
        },
      },
      { upsert: true },
    );
  }
  for (const sessionCount of [3, 6, 12])
    await Package.updateOne(
      { therapist: therapist.id, name: `${sessionCount}-session care package` },
      {
        $setOnInsert: {
          serviceId: therapist.services[0].id,
          sessionCount,
          amount: sessionCount * 140000,
          expiryDays: 90,
        },
      },
      { upsert: true },
    );
  for (const session of await Session.find({
    therapist: therapist.id,
    'contact.email': {
      $in: ['client1@unfazed.example', 'client2@unfazed.example', 'client3@unfazed.example'],
    },
  })) {
    const client = await Client.findOneAndUpdate(
      { therapist: therapist.id, email: session.contact.email },
      { $setOnInsert: { name: session.contact.name, tags: [{ label: 'Online' }] } },
      { upsert: true, new: true },
    );
    await Session.updateOne(
      { _id: session.id, client: { $exists: false } },
      { $set: { client: client.id } },
    );
  }
  console.log('Development therapists ready. Existing records preserved.');
}
if (process.argv[1] === new URL(import.meta.url).pathname) {
  try {
    await connectDB();
    await seed();
  } finally {
    await mongoose.disconnect();
  }
}
