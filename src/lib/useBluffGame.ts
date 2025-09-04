'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

interface BluffGameData {
  gameRoom: any;
  players: any[];
  currentPlayer: string;
  currentBet: any;
  phase: 'waiting' | 'betting' | 'playing' | 'finished';
  roundNumber: number;
  myDice?: number[];
}

interface BluffAction {
  type: 'raise' | 'bluff' | 'challenge';
  data?: any;
}

export function useBluffGame(roomId: string, playerName: string, enableChat: boolean = false, onChatMessageCallback?: (message: any) => void) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [socketId, setSocketId] = useState<string>('');
  const [isConnected, setIsConnected] = useState(false);
  const [gameData, setGameData] = useState<BluffGameData | null>(null);

  // Callback referansları
  const onGameUpdateRef = useRef<((data: BluffGameData) => void) | null>(null);
  const onPlayerJoinedRef = useRef<((player: any) => void) | null>(null);
  const onPlayerLeftRef = useRef<((player: any) => void) | null>(null);
  const onBetPlacedRef = useRef<((bet: any) => void) | null>(null);
  const onChallengeResultRef = useRef<((result: any) => void) | null>(null);
  const onRoundEndRef = useRef<((result: any) => void) | null>(null);
  const onChatMessageRef = useRef<((message: any) => void) | null>(null);

  // Socket bağlantısı
  useEffect(() => {
    const socketInstance = process.env.NODE_ENV === 'production'
      ? io(process.env.NEXT_PUBLIC_APP_URL || window.location.origin, {
        transports: ['websocket', 'polling'],
        path: '/api/socket'
      })
      : io('http://localhost:3000', {
          transports: ['websocket', 'polling'],
          path: '/api/socket'
        });

    socketInstance.on('connect', () => {
      console.log('🔌 Blöf oyununa bağlandı:', socketInstance.id);
      setSocketId(socketInstance.id || '');
      setIsConnected(true);

      // Odaya katıl
      socketInstance.emit('join-bluff-room', {
        roomId,
        playerName,
        enableChat
      });
    });

    socketInstance.on('disconnect', () => {
      console.log('🔌 Blöf oyunundan bağlantı kesildi');
      setIsConnected(false);
    });

    // Oyun güncellemeleri
    socketInstance.on('bluff-game-update', (data: BluffGameData) => {
      console.log('🔌 Bluff game update received:', data);
      console.log('🔌 Players in update:', data.players?.length || 0);
      setGameData(data);
      if (onGameUpdateRef.current) {
        console.log('🔌 Calling onGameUpdate callback');
        onGameUpdateRef.current(data);
      } else {
        console.log('🔌 onGameUpdate callback not set');
      }
    });

    // Oyuncu olayları
    socketInstance.on('bluff-player-joined', (player) => {
      if (onPlayerJoinedRef.current) {
        onPlayerJoinedRef.current(player);
      }
    });

    socketInstance.on('bluff-player-left', (player) => {
      if (onPlayerLeftRef.current) {
        onPlayerLeftRef.current(player);
      }
    });

    // Bahis olayları
    socketInstance.on('bluff-bet-placed', (bet) => {
      if (onBetPlacedRef.current) {
        onBetPlacedRef.current(bet);
      }
    });

    // İtiraz sonuçları
    socketInstance.on('bluff-challenge-result', (result) => {
      if (onChallengeResultRef.current) {
        onChallengeResultRef.current(result);
      }
    });

    // Tur sonu
    socketInstance.on('bluff-round-end', (result) => {
      if (onRoundEndRef.current) {
        onRoundEndRef.current(result);
      }
    });

    // Chat mesajları
    if (enableChat) {
      socketInstance.on('bluff-chat-message', (message) => {
        if (onChatMessageRef.current) {
          onChatMessageRef.current(message);
        }
      });
    }

    // Hata yönetimi
    socketInstance.on('bluff-error', (error) => {
      console.error('Blöf oyunu hatası:', error);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [roomId, playerName, enableChat]);

  // Callback setter'ları
  const onGameUpdate = useCallback((callback: (data: BluffGameData) => void) => {
    onGameUpdateRef.current = callback;
  }, []);

  const onPlayerJoined = useCallback((callback: (player: any) => void) => {
    onPlayerJoinedRef.current = callback;
  }, []);

  const onPlayerLeft = useCallback((callback: (player: any) => void) => {
    onPlayerLeftRef.current = callback;
  }, []);

  const onBetPlaced = useCallback((callback: (bet: any) => void) => {
    onBetPlacedRef.current = callback;
  }, []);

  const onChallengeResult = useCallback((callback: (result: any) => void) => {
    onChallengeResultRef.current = callback;
  }, []);

  const onRoundEnd = useCallback((callback: (result: any) => void) => {
    onRoundEndRef.current = callback;
  }, []);

  const onChatMessage = useCallback((callback: (message: any) => void) => {
    onChatMessageRef.current = callback;
  }, []);

  // Aksiyon gönderme
  const sendBluffAction = useCallback((actionType: 'raise' | 'bluff', betData: { quantity: number; value: number }) => {
    if (!socket || !isConnected) return;

    socket.emit('bluff-action', {
      roomId,
      actionType,
      betData
    });
  }, [socket, isConnected, roomId]);

  // İtiraz gönderme
  const sendChallenge = useCallback(() => {
    if (!socket || !isConnected) return;

    socket.emit('bluff-challenge', {
      roomId
    });
  }, [socket, isConnected, roomId]);

  // Chat mesajı gönderme
  const sendChatMessage = useCallback((message: string) => {
    if (!socket || !isConnected || !enableChat) return;

    socket.emit('bluff-chat-message', {
      roomId,
      message: message.trim()
    });
  }, [socket, isConnected, roomId, enableChat]);

  return {
    socket,
    socketId,
    isConnected,
    gameData,
    sendBluffAction,
    sendChallenge,
    sendChatMessage,
    onGameUpdate,
    onPlayerJoined,
    onPlayerLeft,
    onBetPlaced,
    onChallengeResult,
    onRoundEnd,
    onChatMessage
  };
}
