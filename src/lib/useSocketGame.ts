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
  netWinnings?: number;
  hasDoubledDown?: boolean;
  // Split specific fields
  hands?: Array<{
    cards: Card[];
    score: number;
    bet: number;
    status: string;
    isBlackjack: boolean;
    hasDoubledDown: boolean;
  }>;
  currentHandIndex?: number;
  hasSplit?: boolean;
  // Insurance specific fields
  hasInsurance?: boolean;
  insuranceBet?: number;
}

interface BetDecision {
  playerId: string;
  amount: number;
  hasDecided: boolean;
  hasBet: boolean;
  playerName: string;
}

interface BetUpdate {
  bet: {
    playerId: string;
    amount: number;
    hasBet: boolean;
    hasDecided: boolean;
    playerName: string;
  };
}

interface BettingStatusUpdate {
  playerBets: {
    [playerId: string]: {
      amount: number;
      hasBet: boolean;
      hasDecided: boolean;
    };
  };
}

interface GameState {
  roomId: string;
  players: Player[];
  dealer: { hand: Card[]; score: number; hiddenCard: boolean; isBlackjack?: boolean; visibleScore: number };
  gameState: string;
  currentPlayer: string;
  deckCount?: number; // Destede kalan kart sayısı
  totalCards?: number; // Toplam kart sayısı
  scoreboard?: Array<{ id: string; name: string; netWinnings: number; isDealer: boolean }>;
  results?: {
    dealerBusted: boolean;
    dealerBlackjack?: boolean;
    winners: Array<{ id: string; name: string; reason: string }>;
    losers: Array<{ id: string; name: string; reason: string }>;
    ties: Array<{ id: string; name: string; reason: string }>;
    scoreboard?: Array<{ id: string; name: string; netWinnings: number; isDealer: boolean }>;
  } | null;
  settings?: GameSettings; // Ayarlar bilgilerini ekle
}

interface GameSettings {
  deckCount: number;
  roomOwner: string | null;
  totalCards: number;
}

export const useSocketGame = (
  roomId: string, 
  playerName: string, 
  joined: boolean = false, 
  onChatMessage?: (message: {id: string, name: string, message: string, timestamp: number}) => void,
  onBetUpdate?: (data: BetUpdate) => void,
  onBettingStatusUpdate?: (data: BettingStatusUpdate) => void,
  onBettingCleared?: () => void
) => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [gameSettings, setGameSettings] = useState<GameSettings | null>(null);
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

    // Chat message listener
    socket.on('chat-message', (message) => {
      if (onChatMessage) {
        onChatMessage(message);
      }
    });

    // Betting event listeners
    socket.on('bet-decision-update', (data) => {
      console.log('🎰 Received bet decision update:', data);
      if (onBetUpdate) {
        onBetUpdate(data);
      }
    });

    socket.on('betting-status-update', (data) => {
      console.log('📊 Received betting status update:', data);
      if (onBettingStatusUpdate) {
        onBettingStatusUpdate(data);
      }
    });

    socket.on('betting-cleared', () => {
      console.log('🧹 Betting decisions cleared');
      if (onBettingCleared) {
        onBettingCleared();
      }
    });

    // Settings event listeners
    socket.on('settings-updated', (settings: GameSettings) => {
      console.log('⚙️ Settings updated:', settings);
      setGameSettings(settings);
    });

    socket.on('settings-data', (settings: GameSettings) => {
      console.log('📋 Settings received:', settings);
      setGameSettings(settings);
    });

    socket.on('settings-update-denied', (error: { message: string }) => {
      console.log('❌ Settings update denied:', error.message);
      setError(error.message);
    });

    return () => {
      console.log('🧹 Cleaning up Socket.IO connection');
      socket.disconnect();
      socketRef.current = null;
    };
  }, [roomId, playerName, joined, onChatMessage]);

  // Oyuna katıl (artık socket connect event'i tarafından otomatik yapılıyor)
  const joinGame = useCallback(async (playerId: string) => {
    console.log('🎯 Join game called - handled automatically by socket connect event');
    // Socket bağlantısı kurulunca otomatik olarak join-room gönderilecek
  }, []);

  // Hamle yap
  const makeMove = useCallback(async (action: string, playerId?: string, amount?: number) => {
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
    } else if (action === 'double-down') {
      console.log('🎰 Emitting double-down event to room:', roomId);
      socketRef.current.emit('double-down', roomId);
    } else if (action === 'split') {
      console.log('🃏 Emitting split event to room:', roomId);
      socketRef.current.emit('split', roomId);
    } else if (action === 'insurance') {
      console.log('🛡️ Emitting insurance event to room:', roomId, 'with amount:', amount);
      socketRef.current.emit('insurance', { roomId, amount });
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

  // Chat mesajı gönder
  const sendChatMessage = useCallback(async (message: string) => {
    if (socketRef.current && isConnected && roomId && playerName) {
      console.log('📤 Sending chat message:', message);
      socketRef.current.emit('chat-message', {
        roomId,
        message,
        playerName
      });
    } else {
      console.error('❌ Cannot send chat message - socket not connected or missing data');
    }
  }, [isConnected, roomId, playerName]);

  // Betting decision gönder
  const sendBetDecision = useCallback(async (bet: BetDecision) => {
    if (socketRef.current && isConnected && roomId) {
      console.log('🎰 Sending bet decision:', bet);
      socketRef.current.emit('bet-decision', {
        roomId,
        bet
      });
    } else {
      console.error('❌ Cannot send bet decision - socket not connected');
    }
  }, [isConnected, roomId]);

  // Betting status iste
  const requestBettingStatus = useCallback(async () => {
    if (socketRef.current && isConnected && roomId) {
      console.log('📊 Requesting betting status');
      socketRef.current.emit('get-betting-status', { roomId });
    } else {
      console.error('❌ Cannot request betting status - socket not connected');
    }
  }, [isConnected, roomId]);

  // Ayarlar iste
  const requestSettings = useCallback(async () => {
    if (socketRef.current && isConnected && roomId) {
      console.log('⚙️ Requesting settings');
      socketRef.current.emit('get-settings', roomId);
    } else {
      console.error('❌ Cannot request settings - socket not connected');
    }
  }, [isConnected, roomId]);

  // Ayarları güncelle
  const updateSettings = useCallback(async (settings: Partial<GameSettings>) => {
    if (socketRef.current && isConnected && roomId) {
      console.log('⚙️ Updating settings:', settings);
      socketRef.current.emit('update-settings', { roomId, settings });
    } else {
      console.error('❌ Cannot update settings - socket not connected');
    }
  }, [isConnected, roomId]);

  // Odadan ayrıl
  const leaveRoom = useCallback(async () => {
    if (socketRef.current && isConnected && roomId) {
      console.log('👋 Leaving room:', roomId);
      socketRef.current.emit('leave-room', roomId);
    } else {
      console.error('❌ Cannot leave room - socket not connected');
    }
  }, [isConnected, roomId]);

  return {
    gameState,
    gameSettings,
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
    changeName,
    sendChatMessage,
    sendBetDecision,
    requestBettingStatus,
    requestSettings,
    updateSettings,
    leaveRoom
  };
};
