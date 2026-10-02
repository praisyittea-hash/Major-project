import { Server } from 'socket.io';
import Therapist from '../models/Therapist.js';
let io;
export function attachSchedulingSocket(server) {
  io = new Server(server, {
    cors: { origin: process.env.FRONTEND_URL || 'http://localhost:5173' },
  });
  io.on('connection', (socket) => {
    socket.on('watch-availability', async (slug, ack) => {
      try {
        const valid =
          socket.rooms.size < 20 &&
          typeof slug === 'string' &&
          slug.length <= 63 &&
          (await Therapist.exists({ slug }));
        if (valid) await socket.join(`availability:${slug}`);
        if (typeof ack === 'function') ack({ watching: Boolean(valid) });
      } catch {
        if (typeof ack === 'function') ack({ watching: false });
      }
    });
  });
  return io;
}
export function availabilityChanged(slug) {
  io?.to(`availability:${slug}`).emit('availability-changed');
} // no clinical/client payloads
