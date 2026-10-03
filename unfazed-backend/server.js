import { attachChatSocket } from './src/sockets/chatSocket.js';
import './src/config/loadEnv.js';
import { app } from './src/app.js';
import { connectDB } from './src/config/db.js';
import { validateEnv } from './src/config/env.js';
import { attachSchedulingSocket } from './src/sockets/schedulingSocket.js';
import mongoose from 'mongoose';
import { startReservationWorker } from './src/services/reservationService.js';
validateEnv();
await connectDB();
await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
const server = app.listen(process.env.PORT || 5000, '0.0.0.0', () =>
  console.log('Unfazed API listening; MongoDB connected'),
);
const io = attachSchedulingSocket(server);
attachChatSocket(io);
const stopWorker = startReservationWorker();
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    stopWorker();
    io.close();
    server.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    });
  });
