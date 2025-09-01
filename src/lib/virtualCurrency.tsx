'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './auth';

export interface UserChips {
  id: string;
  user_id: string;
  balance: number;
  total_earned: number;
  total_spent: number;
  total_lost: number;
  created_at: string;
  updated_at: string;
}

export interface GameSession {
  id: string;
  room_id: string;
  game_type: string;
  dealer_balance: number;
  status: 'active' | 'finished';
  created_at: string;
  updated_at: string;
}

export interface Bet {
  id: string;
  user_id: string;
  session_id: string;
  amount: number;
  game_type: string;
  room_id: string;
  status: 'active' | 'won' | 'lost' | 'pushed';
  payout_amount: number;
  created_at: string;
  updated_at: string;
}

interface VirtualCurrencyContextType {
  userChips: UserChips | null;
  gameSession: GameSession | null;
  loading: boolean;
  error: string | null;

  // User chip operations
  depositChips: (amount: number) => Promise<boolean>;
  getUserChips: () => Promise<void>;

  // Game session operations
  createGameSession: (roomId: string, gameType: string) => Promise<GameSession | null>;
  getGameSession: (roomId: string, gameType: string) => Promise<GameSession | null>;
  updateDealerBalance: (sessionId: string, newBalance: number) => Promise<boolean>;

  // Bet operations
  placeBet: (sessionId: string, amount: number, gameType: string, roomId: string) => Promise<Bet | null>;
  resolveBet: (betId: string, won: boolean, payoutAmount?: number) => Promise<boolean>;
  getActiveBets: (roomId: string, gameType: string) => Promise<Bet[]>;

  // Utility functions
  canAffordBet: (amount: number) => boolean;
  formatChips: (amount: number) => string;
}

const VirtualCurrencyContext = createContext<VirtualCurrencyContextType | undefined>(undefined);

export function VirtualCurrencyProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [userChips, setUserChips] = useState<UserChips | null>(null);
  const [gameSession, setGameSession] = useState<GameSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get user chips
  const getUserChips = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_chips')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error;
      }

      if (data) {
        setUserChips(data);
      } else {
        // Create initial chips for new user
        const { data: newChips, error: insertError } = await supabase
          .from('user_chips')
          .insert([{ user_id: user.id, balance: 1000 }])
          .select()
          .single();

        if (insertError) throw insertError;
        setUserChips(newChips);
      }
    } catch (err) {
      console.error('Error getting user chips:', err);
      setError('Chip bilgileri alınamadı');
    } finally {
      setLoading(false);
    }
  };

  // Deposit chips (free for now)
  const depositChips = async (amount: number): Promise<boolean> => {
    if (!user || !userChips) return false;

    try {
      setLoading(true);
      const newBalance = userChips.balance + amount;

      const { data, error } = await supabase
        .from('user_chips')
        .update({
          balance: newBalance,
          total_earned: userChips.total_earned + amount
        })
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;

      setUserChips(data);

      // Record transaction
      await supabase.from('transactions').insert([{
        user_id: user.id,
        type: 'deposit',
        amount: amount,
        balance_before: userChips.balance,
        balance_after: newBalance,
        description: `Free chip deposit: ${amount} chips`
      }]);

      return true;
    } catch (err) {
      console.error('Error depositing chips:', err);
      setError('Chip yatırma işlemi başarısız');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Create game session
  const createGameSession = async (roomId: string, gameType: string): Promise<GameSession | null> => {
    try {
      setLoading(true);

      // Check if session already exists
      const { data: existingSession } = await supabase
        .from('game_sessions')
        .select('*')
        .eq('room_id', roomId)
        .eq('game_type', gameType)
        .eq('status', 'active')
        .single();

      if (existingSession) {
        setGameSession(existingSession);
        return existingSession;
      }

      // Create new session
      const { data, error } = await supabase
        .from('game_sessions')
        .insert([{
          room_id: roomId,
          game_type: gameType,
          dealer_balance: 10000
        }])
        .select()
        .single();

      if (error) throw error;

      setGameSession(data);
      return data;
    } catch (err) {
      console.error('Error creating game session:', err);
      setError('Oyun oturumu oluşturulamadı');
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Get game session
  const getGameSession = async (roomId: string, gameType: string): Promise<GameSession | null> => {
    try {
      const { data, error } = await supabase
        .from('game_sessions')
        .select('*')
        .eq('room_id', roomId)
        .eq('game_type', gameType)
        .eq('status', 'active')
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setGameSession(data);
        return data;
      }

      return null;
    } catch (err) {
      console.error('Error getting game session:', err);
      return null;
    }
  };

  // Update dealer balance
  const updateDealerBalance = async (sessionId: string, newBalance: number): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('game_sessions')
        .update({ dealer_balance: newBalance })
        .eq('id', sessionId);

      if (error) throw error;

      if (gameSession) {
        setGameSession({ ...gameSession, dealer_balance: newBalance });
      }

      return true;
    } catch (err) {
      console.error('Error updating dealer balance:', err);
      return false;
    }
  };

  // Place bet
  const placeBet = async (sessionId: string, amount: number, gameType: string, roomId: string): Promise<Bet | null> => {
    if (!user || !userChips || userChips.balance < amount) return null;

    try {
      setLoading(true);

      // Deduct from user balance
      const newBalance = userChips.balance - amount;
      const { error: updateError } = await supabase
        .from('user_chips')
        .update({
          balance: newBalance,
          total_spent: userChips.total_spent + amount
        })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      // Create bet record
      const { data: bet, error: betError } = await supabase
        .from('bets')
        .insert([{
          user_id: user.id,
          session_id: sessionId,
          amount: amount,
          game_type: gameType,
          room_id: roomId
        }])
        .select()
        .single();

      if (betError) throw betError;

      // Update local state
      setUserChips({ ...userChips, balance: newBalance });

      // Record transaction
      await supabase.from('transactions').insert([{
        user_id: user.id,
        type: 'bet',
        amount: -amount,
        balance_before: userChips.balance,
        balance_after: newBalance,
        game_type: gameType,
        room_id: roomId,
        description: `Bet placed: ${amount} chips`
      }]);

      return bet;
    } catch (err) {
      console.error('Error placing bet:', err);
      setError('Bahis yerleştirilemedi');
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Resolve bet
  const resolveBet = async (betId: string, won: boolean, payoutAmount: number = 0): Promise<boolean> => {
    if (!user || !userChips) return false;

    try {
      setLoading(true);

      // Get the bet details to know the original bet amount
      const { data: betData, error: betFetchError } = await supabase
        .from('bets')
        .select('amount, room_id')
        .eq('id', betId)
        .single();

      if (betFetchError) throw betFetchError;

      const originalBetAmount = betData?.amount || 0;
      const roomId = betData?.room_id || '';
      let newBalance = userChips.balance;

      if (won) {
        // Kazanırsa kazanç eklenir (bahis zaten düşülmüş)
        newBalance = userChips.balance + payoutAmount;
      } else {
        // Kaybederse bahis zaten düşülmüş, hiçbir şey yapılmaz
        // Beraberlik durumunda bahis geri verilir
        const isTie = payoutAmount === originalBetAmount;
        if (isTie) {
          newBalance = userChips.balance + originalBetAmount;
        }
      }

      // Update bet status
      const { error: betError } = await supabase
        .from('bets')
        .update({
          status: won ? 'won' : 'lost',
          payout_amount: payoutAmount
        })
        .eq('id', betId);

      if (betError) throw betError;

      // Update user balance
      const { error: updateError } = await supabase
        .from('user_chips')
        .update({
          balance: newBalance,
          total_earned: won ? userChips.total_earned + payoutAmount : userChips.total_earned,
          total_lost: !won ? userChips.total_lost + originalBetAmount : userChips.total_lost
        })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      setUserChips({
        ...userChips,
        balance: newBalance,
        total_earned: won ? userChips.total_earned + payoutAmount : userChips.total_earned,
        total_lost: !won ? userChips.total_lost + originalBetAmount : userChips.total_lost
      });

      // Record transaction
      await supabase.from('transactions').insert([{
        user_id: user.id,
        type: won ? 'win' : 'loss',
        amount: won ? payoutAmount : -originalBetAmount,
        balance_before: userChips.balance,
        balance_after: newBalance,
        game_type: 'blackjack',
        room_id: roomId,
        description: won ? `Bet won: ${payoutAmount} chips` : `Bet lost: ${originalBetAmount} chips`
      }]);

      return true;
    } catch (err) {
      console.error('Error resolving bet:', err);
      setError('Bahis sonucu işlenemedi');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Get active bets
  const getActiveBets = async (roomId: string, gameType: string): Promise<Bet[]> => {
    if (!user) return [];

    try {
      const { data, error } = await supabase
        .from('bets')
        .select('*')
        .eq('user_id', user.id)
        .eq('room_id', roomId)
        .eq('game_type', gameType)
        .eq('status', 'active');

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Error getting active bets:', err);
      return [];
    }
  };

  // Utility functions
  const canAffordBet = (amount: number): boolean => {
    return userChips ? userChips.balance >= amount : false;
  };

  const formatChips = (amount: number): string => {
    return new Intl.NumberFormat('tr-TR').format(amount);
  };

  // Load user chips when user changes
  useEffect(() => {
    if (user) {
      getUserChips();
    } else {
      setUserChips(null);
    }
  }, [user]);

  const value: VirtualCurrencyContextType = {
    userChips,
    gameSession,
    loading,
    error,
    depositChips,
    getUserChips,
    createGameSession,
    getGameSession,
    updateDealerBalance,
    placeBet,
    resolveBet,
    getActiveBets,
    canAffordBet,
    formatChips
  };

  return (
    <VirtualCurrencyContext.Provider value={value}>
      {children}
    </VirtualCurrencyContext.Provider>
  );
}

export function useVirtualCurrency() {
  const context = useContext(VirtualCurrencyContext);
  if (context === undefined) {
    throw new Error('useVirtualCurrency must be used within a VirtualCurrencyProvider');
  }
  return context;
}
