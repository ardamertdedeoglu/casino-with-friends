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

// HTTP Polling fallback for when WebSocket fails
export const usePollingGame = (roomId: string, playerName: string) => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [playerId, setPlayerId] = useState<string | null>(null);

  const pollGameState = useCallback(async () => {
    if (!roomId || !playerId) return;

    try {
      const response = await fetch(`${process.env.NODE_ENV === 'production'
        ? process.env.NEXT_PUBLIC_APP_URL || "https://casino-with-friends-production.up.railway.app"
        : "http://localhost:3000"}/api/game/${roomId}?playerId=${playerId}`);

      if (response.ok) {
        const newGameState = await response.json();
        setGameState(newGameState);
        setIsConnected(true);
      }
    } catch (error) {
      console.error('Polling error:', error);
      setIsConnected(false);
    }
  }, [roomId, playerId]);

  const joinGame = useCallback(async (id: string) => {
    setPlayerId(id);
    setIsLoading(true);

    try {
      const response = await fetch(`${process.env.NODE_ENV === 'production'
        ? process.env.NEXT_PUBLIC_APP_URL || "https://casino-with-friends-production.up.railway.app"
        : "http://localhost:3000"}/api/game/${roomId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: id, playerName })
      });

      if (response.ok) {
        setIsConnected(true);
        // Start polling
        const interval = setInterval(pollGameState, 2000);
        return () => clearInterval(interval);
      }
    } catch (error) {
      console.error('Join game error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [roomId, playerName, pollGameState]);

  const makeMove = useCallback(async (action: 'hit' | 'stand') => {
    if (!playerId) return;

    try {
      await fetch(`${process.env.NODE_ENV === 'production'
        ? process.env.NEXT_PUBLIC_APP_URL || "https://casino-with-friends-production.up.railway.app"
        : "http://localhost:3000"}/api/game/${roomId}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, action })
      });
    } catch (error) {
      console.error('Make move error:', error);
    }
  }, [roomId, playerId]);

  const startGame = useCallback(async () => {
    try {
      await fetch(`${process.env.NODE_ENV === 'production'
        ? process.env.NEXT_PUBLIC_APP_URL || "https://casino-with-friends-production.up.railway.app"
        : "http://localhost:3000"}/api/game/${roomId}/start`, {
        method: 'POST'
      });
    } catch (error) {
      console.error('Start game error:', error);
    }
  }, [roomId]);

  return {
    gameState,
    joinGame,
    makeMove,
    startGame,
    isConnected,
    isLoading,
    playerId
  };
};
