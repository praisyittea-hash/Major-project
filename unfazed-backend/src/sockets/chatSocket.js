import { conversationAccess, persistMessage } from '../services/chatService.js';
import { readToken } from '../services/tokenService.js';
import Therapist from '../models/Therapist.js';
import Client from '../models/Client.js';
// A separate namespace keeps public availability subscriptions anonymous and payload-free.
export function attachChatSocket(io) {
  const chat = io.of('/chat');
  chat.use(async (socket, next) => {
    try {
      const auth = readToken(socket.handshake.auth?.token);
      if (!['therapist', 'client'].includes(auth.role)) throw new Error('Role denied');
      const exists =
        auth.role === 'therapist'
          ? await Therapist.exists({ _id: auth.sub })
          : await Client.exists({
              _id: auth.sub,
              therapist: auth.therapistId,
              status: { $ne: 'archived' },
            });
      if (!exists) throw new Error('Account unavailable');
      socket.data.auth = auth;
      next();
    } catch {
      next(new Error('Chat authentication required'));
    }
  });
  chat.on('connection', (socket) => {
    const timer = setTimeout(
      () => socket.disconnect(true),
      Math.max(0, socket.data.auth.exp * 1000 - Date.now()),
    );
    timer.unref();
    socket.on('disconnect', () => clearTimeout(timer));
    const handle = (event, action) =>
      socket.on(event, async (payload, ack) => {
        if (typeof ack !== 'function') return;
        try {
          const auth = readToken(socket.handshake.auth.token);
          const conversation = await conversationAccess(auth, payload?.clientId);
          ack({ ok: true, ...(await action(payload, conversation, auth)) });
        } catch (error) {
          ack({ ok: false, message: error.status ? error.message : 'Chat request failed' });
        }
      });
    handle('chat:join', async (_payload, conversation) => {
      if (socket.rooms.size >= 20) throw new Error('Room limit');
      await socket.join(conversation.room);
      return { room: conversation.room };
    });
    handle('chat:send', async (payload, conversation, auth) => {
      const message = await persistMessage(conversation, auth, payload);
      chat.to(conversation.room).emit('chat:message', message);
      return { message };
    });
  });
  return chat;
}
