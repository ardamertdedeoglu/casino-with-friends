'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

interface ChatMessage {
  id: string;
  name: string;
  message: string;
  timestamp: number;
}

interface ChatComponentProps {
  roomId: string;
  playerName: string;
}

export default function ChatComponent({
  roomId,
  playerName
}: ChatComponentProps) {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [socketId, setSocketId] = useState<string>('');
  const socketRef = useRef<Socket | null>(null);

  // Ref for chat messages container to auto-scroll
  const chatMessagesRef = useRef<HTMLDivElement>(null);

  // Handle incoming chat messages
  const handleChatMessage = useCallback((message: ChatMessage) => {
    console.log('💬 Received chat message:', message);
    setChatMessages(prev => [...prev, message]);
  }, []);

  // Initialize socket connection for chat
  useEffect(() => {
    if (!roomId || !playerName) return;

    console.log('🔌 Initializing chat socket connection...');

    const socket = io(process.env.NODE_ENV === 'production'
      ? process.env.NEXT_PUBLIC_APP_URL || "https://casino-with-friends-production.up.railway.app"
      : "http://localhost:3000", {
      transports: ['websocket', 'polling'],
      upgrade: true,
      rememberUpgrade: true,
      timeout: 20000,
    });

    socketRef.current = socket;

    // Join room for chat
    socket.emit('joinRoom', { roomId, playerName });

    // Set socket ID
    socket.on('connect', () => {
      console.log('📡 Chat socket connected:', socket.id);
      setSocketId(socket.id || '');
    });

    // Listen for chat messages
    socket.on('chatMessage', handleChatMessage);

    // Listen for room updates to get current players
    socket.on('roomUpdate', (data) => {
      console.log('🏠 Room updated for chat:', data);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log('📡 Chat socket disconnected');
    });

    return () => {
      console.log('🔌 Cleaning up chat socket connection...');
      socket.off('chatMessage', handleChatMessage);
      socket.disconnect();
    };
  }, [roomId, playerName]);

  // Send chat message function
  const sendChatMessage = useCallback((message: string) => {
    if (socketRef.current && message.trim()) {
      console.log('📤 Sending chat message:', message);
      socketRef.current.emit('sendChatMessage', {
        roomId,
        message: message.trim(),
        playerName,
        timestamp: Date.now()
      });
    }
  }, [roomId, playerName]);

  // Set up chat message listener
  useEffect(() => {
    // Chat mesajları artık socket bağlantısı içinde dinleniyor
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Handle Enter key press for chat input
  const handleChatKeyPress = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const trimmedMessage = chatInput.trim();
      if (trimmedMessage) {
        sendChatMessage(trimmedMessage);
        setChatInput('');
      }
    }
  }, [chatInput, sendChatMessage]);

  const handleSendMessage = () => {
    const trimmedMessage = chatInput.trim();
    if (trimmedMessage) {
      sendChatMessage(trimmedMessage);
      setChatInput('');
    }
  };

  return (
    <>
      {/* Chat Toggle Button - Bottom Right */}
      <div className="fixed bottom-4 right-4 z-30">
        <button
          onClick={() => setShowChat(!showChat)}
          className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 rounded-full shadow-2xl hover:shadow-3xl transform hover:-translate-y-1 transition-all duration-300 border-2 border-blue-500"
        >
          <span className="text-2xl">💬</span>
        </button>
      </div>

      {/* Chat Panel */}
      {showChat && (
        <div className="fixed bottom-20 right-4 w-80 h-[700px] bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl shadow-2xl border-2 border-gray-600 z-40 flex flex-col">
          {/* Chat Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-4 rounded-t-2xl border-b-2 border-blue-500">
            <h3 className="text-white font-bold text-lg text-center">💬 Sohbet</h3>
          </div>

          {/* Messages Area */}
          <div ref={chatMessagesRef} className="flex-1 p-4 overflow-y-auto space-y-3">
            {chatMessages.length === 0 ? (
              <div className="text-center text-gray-400 text-sm">
                <p>Henüz mesaj yok</p>
                <p>İlk mesajı sen gönder! 🎯</p>
              </div>
            ) : (
              chatMessages.map((msg, index) => (
                <div key={index} className="space-y-1">
                  {/* Player Name */}
                  <div className={`text-xs font-bold px-2 py-1 rounded-full inline-block ${
                    msg.id === socketId
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-600 text-gray-200'
                  }`}>
                    {msg.name}
                  </div>
                  {/* Message Bubble */}
                  <div className={`p-3 rounded-2xl w-fit max-w-[70%] ${
                    msg.id === socketId
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-100'
                  }`}>
                    <p className="text-sm break-words">{msg.message}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Input Area */}
          <div className="p-4 border-t-2 border-gray-600">
            <div className="flex space-x-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value.slice(0, 100))}
                onKeyPress={handleChatKeyPress}
                placeholder="Mesajınızı yazın..."
                maxLength={100}
                className="flex-1 p-3 rounded-xl bg-gray-800 text-white placeholder-gray-400 border-2 border-gray-600 focus:border-blue-500 focus:outline-none transition-all duration-200"
              />
              <button
                onClick={handleSendMessage}
                disabled={!chatInput.trim()}
                className="bg-gradient-to-r from-green-600 to-green-700 text-white px-4 py-3 rounded-xl font-bold hover:from-green-700 hover:to-green-800 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed transition-all duration-200 border-2 border-green-500"
              >
                <span className="text-lg">📤</span>
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">{chatInput.length}/100 karakter</p>
          </div>
        </div>
      )}
    </>
  );
}
