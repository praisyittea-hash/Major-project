import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import api from '../api/axiosInstance.js';
export default function useChat(clientId, role) {
  const socketRef = useRef(null);
  const [messages, setMessages] = useState([]),
    [connected, setConnected] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    const origin =
      import.meta.env.VITE_SOCKET_URL || new URL(api.defaults.baseURL, location.origin).origin;
    const socket = io(`${origin}/chat`, {
      auth: {
        token: sessionStorage.getItem(role === 'client' ? 'unfazed-client-token' : 'unfazed-token'),
      },
    });
    socketRef.current = socket;
    const append = (message) =>
      setMessages((items) =>
        items.some((item) => item._id === message._id) ? items : [...items, message],
      );
    socket.on('connect', async () => {
      try {
        const result = await socket.timeout(5000).emitWithAck('chat:join', { clientId });
        if (!result.ok) throw new Error(result.message);
        setConnected(true);
        setError('');
      } catch (e) {
        setError(e.message);
      }
    });
    socket.on('chat:message', append);
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', (e) => setError(e.message));
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [clientId, role]);
  async function send(text, clientMessageId) {
    const result = await socketRef.current
      .timeout(5000)
      .emitWithAck('chat:send', { clientId, text, clientMessageId });
    if (!result.ok) throw new Error(result.message);
    setMessages((items) =>
      items.some((item) => item._id === result.message._id) ? items : [...items, result.message],
    );
  }
  return { messages, connected, error, send };
}
