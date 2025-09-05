'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

interface BluffGameData {
  gameRoom: {
    id: string;
    game_type: string;
    status: string;
    current_round: number;
    max_players: number;
  };
  players: {
    id: string;
    name: string;
    chips: number;
    dice: number[];
    isActive: boolean;
    isConnected: boolean;
  }[];
  currentPlayer: string;
  currentBet: {
    id: string;
    playerId: string;
    playerName: string;
    quantity: number;
    value: number;
    isBluff: boolean;
  } | null;
  phase: 'waiting' | 'betting' | 'playing' | 'finished';
  roundNumber: number;
  myDice?: number[];
  showAllDice?: boolean; // Yeni alan
}

export function useBluffGame(roomId: string, playerName: string, enableChat: boolean = false) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [socketId, setSocketId] = useState<string>('');
  const [isConnected, setIsConnected] = useState(false);
  const [gameData, setGameData] = useState<BluffGameData | null>(null);

  // Callback referansları
  const onGameUpdateRef = useRef<((data: BluffGameData) => void) | null>(null);
  const onPlayerJoinedRef = useRef<((player: { name: string }) => void) | null>(null);
  const onPlayerLeftRef = useRef<((player: { name: string }) => void) | null>(null);
  const onBetPlacedRef = useRef<((bet: { playerName: string; quantity: number; value: number; isBluff: boolean }) => void) | null>(null);
  const onChallengeResultRef = useRef<((result: { message: string }) => void) | null>(null);
  const onRoundEndRef = useRef<((result: { winner: string; loser: string }) => void) | null>(null);
  const onChatMessageRef = useRef<((message: { id: string; name: string; message: string; timestamp: number }) => void) | null>(null);

  // Socket bağlantısı
  useEffect(() => {
    console.log('🔌 Creating socket connection for room:', roomId, 'player:', playerName);
    
    const socket = io(process.env.NODE_ENV === 'production'
      ? process.env.NEXT_PUBLIC_APP_URL || "https://casino-with-friends-production.up.railway.app"
      : "http://localhost:3000", {
      path: '/api/socket',
      transports: ['websocket', 'polling'],
      forceNew: true, // Force new connection to avoid issues
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 20000,
      upgrade: true,
      rememberUpgrade: true
    });

    socket.on('connect', () => {
      console.log('🔌 Blöf oyununa bağlandı:', socket.id);
      console.log('🔌 Socket connected status:', socket.connected);
      setSocketId(socket.id || '');
      setIsConnected(true);

      // Odaya katıl
      console.log('🔌 Joining bluff room:', { roomId, playerName, enableChat });
      socket.emit('join-bluff-room', {
        roomId,
        playerName,
        enableChat
      });
    });

    socket.on('disconnect', () => {
      console.log('🔌 Blöf oyunundan bağlantı kesildi');
      setIsConnected(false);
    });

    // Oyun güncellemeleri
    socket.on('bluff-game-update', (data: BluffGameData) => {
      console.log('🔌 Bluff game update received:', {
        playersCount: data.players?.length || 0,
        currentPlayer: data.currentPlayer,
        phase: data.phase,
        myDice: data.myDice?.length || 0,
        gameRoomId: data.gameRoom?.id
      });
      console.log('🔌 Full game data:', data);
      setGameData(data);
      if (onGameUpdateRef.current) {
        console.log('🔌 Calling onGameUpdate callback');
        onGameUpdateRef.current(data);
      } else {
        console.log('🔌 onGameUpdate callback not set');
      }
    });

    // Oyuncu olayları
    socket.on('bluff-player-joined', (player) => {
      if (onPlayerJoinedRef.current) {
        onPlayerJoinedRef.current(player);
      }
    });

    socket.on('bluff-player-left', (player) => {
      if (onPlayerLeftRef.current) {
        onPlayerLeftRef.current(player);
      }
    });

    // Bahis olayları
    socket.on('bluff-bet-placed', (bet) => {
      if (onBetPlacedRef.current) {
        onBetPlacedRef.current(bet);
      }
    });

    // İtiraz sonuçları
    socket.on('bluff-challenge-result', (result) => {
      if (onChallengeResultRef.current) {
        onChallengeResultRef.current(result);
      }
    });

    // Tüm zarları göster (itiraz sonrası)
    socket.on('bluff-show-all-dice', (gameStateWithAllDice) => {
      console.log('🎲 Showing all dice after challenge:', gameStateWithAllDice);
      if (onGameUpdateRef.current) {
        onGameUpdateRef.current({
          ...gameStateWithAllDice,
          showAllDice: true
        });
      }
    });

    // Tur sonu
    socket.on('bluff-round-end', (result) => {
      if (onRoundEndRef.current) {
        onRoundEndRef.current(result);
      }
    });

    // Chat mesajları
    if (enableChat) {
      socket.on('bluff-chat-message', (message) => {
        if (onChatMessageRef.current) {
          onChatMessageRef.current(message);
        }
      });
    }

    // Hata yönetimi
    socket.on('bluff-error', (error) => {
      console.error('Blöf oyunu hatası:', error);
    });

    // Oda join hatası
    socket.on('join-error', (error) => {
      console.error('Odaya katılma hatası:', error);
    });

    setSocket(socket);

    return () => {
      socket.disconnect();
    };
  }, [roomId, playerName, enableChat]);

  // Callback setter'ları
  const onGameUpdate = useCallback((callback: (data: BluffGameData) => void) => {
    onGameUpdateRef.current = callback;
  }, []);

  const onPlayerJoined = useCallback((callback: (player: { name: string }) => void) => {
    onPlayerJoinedRef.current = callback;
  }, []);

  const onPlayerLeft = useCallback((callback: (player: { name: string }) => void) => {
    onPlayerLeftRef.current = callback;
  }, []);

  const onBetPlaced = useCallback((callback: (bet: { playerName: string; quantity: number; value: number; isBluff: boolean }) => void) => {
    onBetPlacedRef.current = callback;
  }, []);

  const onChallengeResult = useCallback((callback: (result: { message: string }) => void) => {
    onChallengeResultRef.current = callback;
  }, []);

  const onRoundEnd = useCallback((callback: (result: { winner: string; loser: string }) => void) => {
    onRoundEndRef.current = callback;
  }, []);

  const onChatMessage = useCallback((callback: (message: { id: string; name: string; message: string; timestamp: number }) => void) => {
    onChatMessageRef.current = callback;
  }, []);

  // Aksiyon gönderme
  const sendBluffAction = useCallback((actionType: 'raise' | 'bluff' | 'start-game', betData?: { quantity?: number; value?: number }) => {
    if (!socket || !isConnected) return;

    socket.emit('bluff-action', {
      roomId,
      actionType,
      betData: betData || {}
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
