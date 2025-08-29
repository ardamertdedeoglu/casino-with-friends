'use client';

import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export default function SocketTest() {
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);

  useEffect(() => {
    console.log('🔌 Initializing Socket.IO test connection...');

    const socket = io("http://localhost:3000", {
      path: '/api/socket',
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      console.log('✅ Test connection successful!');
      setIsConnected(true);
      setMessages(prev => [...prev, 'Connected to Socket.IO server']);
    });

    socket.on('disconnect', () => {
      console.log('❌ Test connection disconnected');
      setIsConnected(false);
      setMessages(prev => [...prev, 'Disconnected from Socket.IO server']);
    });

    socket.on('connect_error', (error) => {
      console.error('🚨 Test connection error:', error);
      setMessages(prev => [...prev, `Connection error: ${error.message}`]);
    });

    // Test event
    socket.on('game-update', (data) => {
      console.log('🎮 Test received game-update:', data);
      setMessages(prev => [...prev, `Game update received: ${JSON.stringify(data)}`]);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Socket.IO Test</h1>
      <div className="mb-4">
        <span className={`px-3 py-1 rounded ${isConnected ? 'bg-green-500' : 'bg-red-500'} text-white`}>
          {isConnected ? 'Connected' : 'Disconnected'}
        </span>
      </div>
      <div className="bg-gray-100 p-4 rounded max-h-96 overflow-y-auto">
        <h2 className="font-semibold mb-2">Messages:</h2>
        {messages.map((msg, index) => (
          <div key={index} className="text-sm mb-1">{msg}</div>
        ))}
      </div>
    </div>
  );
}
