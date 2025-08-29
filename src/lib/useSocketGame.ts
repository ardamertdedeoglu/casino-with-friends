import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

interface Card {
  suit: string;
  value: string;
}

interface Player {
  id: string;
  name: string;
  hand: Card[];
  score: number;
  bet: number;
  status: string;
  isBlackjack?: boolean;
}

interface GameState {
  roomId: string;
  players: Player[];
  dealer: { hand: Card[]; score: number; hiddenCard: boolean; isBlackjack?: boolean; visibleScore: number };
  gameState: string;
  currentPlayer: string;
  results?: {
    dealerBusted: boolean;
    dealerBlackjack?: boolean;
    winners: Array<{ id: string; name: string; reason: string }>;
    losers: Array<{ id: string; name: string; reason: string }>;
    ties: Array<{ id: string; name: string; reason: string }>;
  } | null;
}

export const useSocketGame = (roomId: string, playerName: string, joined: boolean = false) => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [socketId, setSocketId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  // Socket.IO bağlantısını başlat
  useEffect(() => {
    if (!roomId || !playerName || !joined) return;

    console.log('🔌 Initializing Socket.IO connection...');

    const socket = io(process.env.NODE_ENV === 'production'
      ? process.env.NEXT_PUBLIC_APP_URL || "https://casino-with-friends-production.up.railway.app"
      : "http://localhost:3000", {
      path: '/api/socket',
      transports: ['websocket', 'polling'],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 20000,
      upgrade: true,
      rememberUpgrade: true
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('✅ Connected to Socket.IO server');
      console.log('Socket ID:', socket.id);
      setIsConnected(true);
      setSocketId(socket.id || null);

      // Socket bağlantısı kurulduktan sonra otomatik olarak odaya katıl
      console.log('🎯 Auto-emitting join-room event after connection:', { roomId, playerName });
      socket.emit('join-room', { roomId, playerName });
    });

    socket.on('disconnect', () => {
      console.log('❌ Disconnected from Socket.IO server');
      setIsConnected(false);
    });

    socket.on('game-update', (newGameState: GameState) => {
      console.log('🎮 Game state updated:', newGameState);
      console.log('Players in game:', newGameState.players?.length || 0);
      console.log('Current game state:', newGameState.gameState);
      console.log('Current player (server):', newGameState.currentPlayer);
      console.log('My socket ID:', socket.id);
      console.log('Is it my turn?', newGameState.currentPlayer === socket.id);
      setGameState(newGameState);

      // Game state güncellendiğinde her zaman loading'i kapat
      setIsLoading(false);
    });

    socket.on('join-error', (errorData) => {
      console.error('🚨 Join room error:', errorData.message);
      setError(errorData.message);
      setIsLoading(false);
    });

    socket.on('connect_error', (error) => {
      console.error('🚨 Socket.IO connection error:', error.message);
      console.error('Error name:', error.name);
      console.error('Error stack:', error.stack);
      console.error('Full error object:', error);
      console.error('Connection URL:', process.env.NODE_ENV === 'production'
        ? process.env.NEXT_PUBLIC_APP_URL || "https://casino-with-friends-production.up.railway.app"
        : "http://localhost:3000");
      setIsConnected(false);
    });

    socket.on('connect_failed', (error) => {
      console.error('🚨 Socket.IO connection failed:', error);
      console.error('This usually means the server is not reachable or WebSocket is blocked');
      setIsConnected(false);
    });

    socket.on('reconnect', (attemptNumber) => {
      console.log('🔄 Reconnected to Socket.IO server, attempt:', attemptNumber);
      setIsConnected(true);
    });

    socket.on('reconnect_error', (error) => {
      console.error('🚨 Socket.IO reconnection error:', error);
    });

    socket.on('reconnect_failed', () => {
      console.error('🚨 Socket.IO reconnection failed');
    });

    return () => {
      console.log('🧹 Cleaning up Socket.IO connection');
      socket.disconnect();
      socketRef.current = null;
    };
  }, [roomId, playerName, joined]);

  // Oyuna katıl (artık socket connect event'i tarafından otomatik yapılıyor)
  const joinGame = useCallback(async (playerId: string) => {
    console.log('🎯 Join game called - handled automatically by socket connect event');
    // Socket bağlantısı kurulunca otomatik olarak join-room gönderilecek
  }, []);

  // Hamle yap
  const makeMove = useCallback(async (action: string, playerId?: string) => {
    if (!socketRef.current || !isConnected) {
      console.error('🚨 Socket not connected');
      return;
    }

    console.log('🎲 Making move:', action, 'for player:', playerId);
    console.log('Current socket ID:', socketRef.current.id);

    if (action === 'hit') {
      console.log('🎯 Emitting hit event to room:', roomId);
      socketRef.current.emit('hit', roomId);
    } else if (action === 'stand') {
      console.log('🛑 Emitting stand event to room:', roomId);
      socketRef.current.emit('stand', roomId);
    }
  }, [roomId, isConnected]);

  // Oyunu başlat
  const startGame = useCallback(async () => {
    if (!socketRef.current || !isConnected) {
      console.error('🚨 Socket not connected');
      return;
    }

    console.log('🎰 Starting game for room:', roomId);
    setIsLoading(true);

    socketRef.current.emit('start-game', roomId);

    // Loading'i game-update event'i geldiğinde kapatacağız
  }, [roomId, isConnected]);

  // Oyunu yeniden başlat
  const restartGame = useCallback(async () => {
    if (!socketRef.current || !isConnected) {
      console.error('🚨 Socket not connected');
      return;
    }

    console.log('🔄 Restarting game for room:', roomId);
    setIsLoading(true);

    // Restart için start-game event'ini kullan
    socketRef.current.emit('start-game', roomId);

    setTimeout(() => setIsLoading(false), 1000);
  }, [roomId, isConnected]);

  // Oyundan çık
  const leaveGame = useCallback(async (playerId: string) => {
    if (!socketRef.current) return;

    console.log('👋 Leaving game, player:', playerId);
    console.log('Disconnecting socket:', socketRef.current.id);

    // Socket.IO otomatik olarak disconnect event'ini handle eder
    socketRef.current.disconnect();
    setGameState(null);
    setIsConnected(false);
    setSocketId(null);
  }, []);

  // Oda sıfırla
  const resetRoom = useCallback(async () => {
    if (!socketRef.current || !isConnected) {
      console.error('� Socket not connected');
      return;
    }

    console.log('🔧 Resetting room:', roomId);
    setIsLoading(true);

    socketRef.current.emit('reset-room', roomId);

    setTimeout(() => setIsLoading(false), 1000);
  }, [roomId, isConnected]);

  // İsim değiştir
  const changeName = useCallback(async (playerId: string, newName: string) => {
    console.log('✏️ Change name functionality not implemented in Socket.IO version');
    // Bu özellik Socket.IO server'ında implement edilmemiş
  }, []);

  return {
    gameState,
    isConnected,
    isLoading,
    socketId,
    error,
    joinGame,
    makeMove,
    startGame,
    restartGame,
    leaveGame,
    resetRoom,
    changeName
  };
};
