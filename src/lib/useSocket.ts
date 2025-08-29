import { useEffect, useState } from 'react';
import io, { Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const useSocket = () => {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!socket) {
      // Connect to the main Next.js server (not API route)
      const socketUrl = process.env.NODE_ENV === 'production'
        ? process.env.NEXT_PUBLIC_APP_URL || window.location.origin
        : 'http://localhost:3000';

      socket = io(socketUrl, {
        transports: ['polling', 'websocket'],
        upgrade: false,
        rememberUpgrade: false,
        timeout: 20000
      });
    }

    socket.on('connect', () => {
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    return () => {
      if (socket) {
        socket.off('connect');
        socket.off('disconnect');
      }
    };
  }, []);

  return { socket, isConnected };
};
