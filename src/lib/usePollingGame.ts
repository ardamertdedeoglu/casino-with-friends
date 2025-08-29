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
        body: JSON.stringify({ action, playerId })
      });

      if (response.ok) {
        // Hamle yapıldıktan sonra hemen güncelleme al
        await fetchGameState();
        // Kısa bir gecikme sonrası tekrar güncelleme al (diğer oyuncular için)
        setTimeout(() => fetchGameState(), 500);
      } else {
        console.error('Failed to make move');
      }
    } catch (error) {
      console.error('Move error:', error);
    }
  }, [roomId, fetchGameState]);

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
        console.log('Player left successfully:', playerId);
        await fetchGameState();
        // Kısa bir gecikme sonrası tekrar güncelleme al
        setTimeout(() => fetchGameState(), 500);
      } else {
        console.error('Failed to leave game:', response.status);
      }
    } catch (error) {
      console.error('Leave game error:', error);
    }
  }, [roomId, fetchGameState]);

  // Oda sıfırla
  const resetRoom = useCallback(async () => {
    if (!roomId) return;

    try {
      const response = await fetch(`/api/game/${roomId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' })
      });

      if (response.ok) {
        console.log('Room reset successfully');
        await fetchGameState();
      } else {
        console.error('Failed to reset room');
      }
    } catch (error) {
      console.error('Reset room error:', error);
    }
  }, [roomId, fetchGameState]);

  // İsim değiştir
  const changeName = useCallback(async (playerId: string, newName: string) => {
    if (!roomId || !playerId) return;

    try {
      const response = await fetch(`/api/game/${roomId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'changeName', playerId, playerName: newName })
      });

      if (response.ok) {
        console.log('Name changed successfully');
        await fetchGameState();
      } else {
        console.error('Failed to change name');
      }
    } catch (error) {
      console.error('Change name error:', error);
    }
  }, [roomId, fetchGameState]);

  // Oyunu başlat
  const startGame = useCallback(async () => {
    if (!roomId) return;

    try {
      const response = await fetch(`/api/game/${roomId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' })
      });

      if (response.ok) {
        await fetchGameState();
      } else {
        console.error('Failed to start game');
      }
    } catch (error) {
      console.error('Start game error:', error);
    }
  }, [roomId, fetchGameState]);

  // Oyunu yeniden başlat
  const restartGame = useCallback(async () => {
    if (!roomId) return;

    try {
      const response = await fetch(`/api/game/${roomId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restart' })
      });

      if (response.ok) {
        console.log('Game restarted successfully');
        await fetchGameState();
        // Kısa bir gecikme sonrası tekrar güncelleme al
        setTimeout(() => fetchGameState(), 500);
      } else {
        console.error('Failed to restart game:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('Error details:', errorText);
      }
    } catch (error) {
      console.error('Restart game error:', error);
    }
  }, [roomId, fetchGameState]);

  // Periyodik olarak oyun durumunu güncelle
  useEffect(() => {
    if (roomId) {
      // İlk yükleme
      fetchGameState();

      // Periyodik güncelleme - daha sık polling
      const interval = setInterval(fetchGameState, 1000); // Her 1 saniyede bir güncelle
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
    resetRoom,
    changeName,
    fetchGameState
  };
};
