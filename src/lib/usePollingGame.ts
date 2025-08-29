import { useState, useEffect, useCallback } from 'react';

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
  dealer: { hand: Card[]; score: number; hiddenCard: boolean; isBlackjack?: boolean };
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

export const usePollingGame = (roomId: string, playerName: string) => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Oyun durumunu çek
  const fetchGameState = useCallback(async () => {
    if (!roomId) return;

    try {
      const response = await fetch(`/api/game/${roomId}`);
      if (response.ok) {
        const data = await response.json();
        setGameState(data);
        setIsConnected(true);
      } else if (response.status === 404) {
        // Oda bulunamadı, yeni oda oluştur
        setGameState(null);
        setIsConnected(false);
      }
    } catch (error) {
      console.error('Game state fetch error:', error);
      setIsConnected(false);
    }
  }, [roomId]);

  // Oyuna katıl
  const joinGame = useCallback(async (playerId: string) => {
    if (!roomId || !playerName) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/game/${roomId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join', playerId, playerName })
      });

      if (response.ok) {
        await fetchGameState();
      } else {
        console.error('Failed to join game');
      }
    } catch (error) {
      console.error('Join game error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [roomId, playerName, fetchGameState]);

  // Hamle yap
  const makeMove = useCallback(async (action: string, playerId?: string) => {
    if (!roomId) return;

    try {
      const response = await fetch(`/api/game/${roomId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, playerId, playerName })
      });

      if (response.ok) {
        await fetchGameState();
      } else {
        console.error('Failed to make move');
      }
    } catch (error) {
      console.error('Move error:', error);
    }
  }, [roomId, playerName, fetchGameState]);

  // Oyundan çık
  const leaveGame = useCallback(async (playerId: string) => {
    if (!roomId || !playerId) return;

    try {
      const response = await fetch(`/api/game/${roomId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'leave', playerId })
      });

      if (response.ok) {
        await fetchGameState();
      } else {
        console.error('Failed to leave game');
      }
    } catch (error) {
      console.error('Leave game error:', error);
    }
  }, [roomId, fetchGameState]);

  // Oyunu başlat
  const startGame = useCallback(async () => {
    if (!roomId) return;

    try {
      const response = await fetch(`/api/game/${roomId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', playerName })
      });

      if (response.ok) {
        await fetchGameState();
      } else {
        console.error('Failed to start game');
      }
    } catch (error) {
      console.error('Start game error:', error);
    }
  }, [roomId, playerName, fetchGameState]);

  // Oyunu yeniden başlat
  const restartGame = useCallback(async () => {
    if (!roomId) return;

    try {
      const response = await fetch(`/api/game/${roomId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restart', playerName })
      });

      if (response.ok) {
        await fetchGameState();
      } else {
        console.error('Failed to restart game');
      }
    } catch (error) {
      console.error('Restart game error:', error);
    }
  }, [roomId, playerName, fetchGameState]);

  // Periyodik olarak oyun durumunu güncelle
  useEffect(() => {
    if (roomId) {
      // İlk yükleme
      fetchGameState();

      // Periyodik güncelleme
      const interval = setInterval(fetchGameState, 2000); // Her 2 saniyede bir güncelle
      return () => clearInterval(interval);
    }
  }, [roomId, fetchGameState]);

  return {
    gameState,
    isConnected,
    isLoading,
    joinGame,
    makeMove,
    startGame,
    restartGame,
    leaveGame,
    fetchGameState
  };
};
