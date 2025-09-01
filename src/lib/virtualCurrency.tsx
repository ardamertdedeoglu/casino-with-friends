'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './auth';
import { supabase } from './supabase';

interface UserProfile {
  id: string;
  username: string;
  chips: number;
  total_winnings: number;
  total_losses: number;
  games_played: number;
}

interface GameRoom {
  id: string;
  game_type: string;
  house_chips: number;
  status: string;
}

interface ChipTransaction {
  id: string;
  transaction_type: 'deposit' | 'win' | 'loss' | 'bet';
  amount: number;
  balance_before: number;
  balance_after: number;
  description?: string;
  created_at: string;
}

interface VirtualCurrencyContextType {
  userProfile: UserProfile | null;
  loading: boolean;
  depositChips: (amount: number) => Promise<boolean>;
  placeBet: (roomId: string, amount: number) => Promise<string | null>;
  processWin: (roomId: string, sessionId: string, winType: 'normal' | 'blackjack') => Promise<boolean>;
  processLoss: (roomId: string, sessionId: string) => Promise<boolean>;
  getGameRoom: (roomId: string, gameType: string) => Promise<GameRoom | null>;
  getUserTransactions: (limit?: number) => Promise<ChipTransaction[]>;
  refreshProfile: () => Promise<void>;
}

const VirtualCurrencyContext = createContext<VirtualCurrencyContextType | undefined>(undefined);

export function VirtualCurrencyProvider({ children }: { children: React.ReactNode }) {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  // Kullanıcı profilini yükle
  const loadUserProfile = async () => {
    if (!user) {
      setUserProfile(null);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Profile yükleme hatası:', error);
        // Eğer profil yoksa oluştur
        if (error.code === 'PGRST116') {
          await createUserProfile();
        }
      } else {
        setUserProfile(data);
      }
    } catch (error) {
      console.error('Profile yükleme hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  // Kullanıcı profili oluştur
  const createUserProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .insert({
          id: user.id,
          username: user.user_metadata?.username || user.email?.split('@')[0] || 'Oyuncu',
          chips: 1000
        })
        .select()
        .single();

      if (error) {
        console.error('Profil oluşturma hatası:', error);
      } else {
        setUserProfile(data);
      }
    } catch (error) {
      console.error('Profil oluşturma hatası:', error);
    }
  };

  // Chip yatırma (ücretsiz)
  const depositChips = async (amount: number): Promise<boolean> => {
    if (!user || !userProfile) return false;

    try {
      const newBalance = userProfile.chips + amount;

      // Profili güncelle
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({ chips: newBalance })
        .eq('id', user.id);

      if (profileError) throw profileError;

      // İşlemi kaydet
      const { error: transactionError } = await supabase
        .from('chip_transactions')
        .insert({
          user_id: user.id,
          transaction_type: 'deposit',
          amount: amount,
          balance_before: userProfile.chips,
          balance_after: newBalance,
          description: `${amount} chip yatırıldı`
        });

      if (transactionError) throw transactionError;

      // Local state'i güncelle
      setUserProfile(prev => prev ? { ...prev, chips: newBalance } : null);
      return true;
    } catch (error) {
      console.error('Chip yatırma hatası:', error);
      return false;
    }
  };

  // Oyun odası al veya oluştur
  const getGameRoom = async (roomId: string, gameType: string): Promise<GameRoom | null> => {
    try {
      // Önce oda var mı kontrol et
      let { data: room, error } = await supabase
        .from('game_rooms')
        .select('*')
        .eq('id', roomId)
        .single();

      if (error && error.code === 'PGRST116') {
        // Oda yoksa oluştur
        const { data: newRoom, error: createError } = await supabase
          .from('game_rooms')
          .insert({
            id: roomId,
            game_type: gameType,
            house_chips: 10000
          })
          .select()
          .single();

        if (createError) throw createError;
        return newRoom;
      } else if (error) {
        throw error;
      }

      return room;
    } catch (error) {
      console.error('Oda alma/oluşturma hatası:', error);
      return null;
    }
  };

  // Bahis yapma
  const placeBet = async (roomId: string, amount: number): Promise<string | null> => {
    if (!user || !userProfile || userProfile.chips < amount) return null;

    try {
      const newBalance = userProfile.chips - amount;

      // Profili güncelle
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({ chips: newBalance })
        .eq('id', user.id);

      if (profileError) throw profileError;

      // Oyun seansını oluştur
      const { data: session, error: sessionError } = await supabase
        .from('game_sessions')
        .insert({
          room_id: roomId,
          user_id: user.id,
          bet_amount: amount,
          chips_before: userProfile.chips,
          chips_after: newBalance
        })
        .select()
        .single();

      if (sessionError) throw sessionError;

      // İşlemi kaydet
      const { error: transactionError } = await supabase
        .from('chip_transactions')
        .insert({
          user_id: user.id,
          transaction_type: 'bet',
          amount: -amount,
          balance_before: userProfile.chips,
          balance_after: newBalance,
          game_session_id: session.id,
          description: `${amount} chip bahis yapıldı`
        });

      if (transactionError) throw transactionError;

      // Local state'i güncelle
      setUserProfile(prev => prev ? { ...prev, chips: newBalance } : null);
      return session.id;
    } catch (error) {
      console.error('Bahis yapma hatası:', error);
      return null;
    }
  };

  // Kazanma işlemi
  const processWin = async (roomId: string, sessionId: string, winType: 'normal' | 'blackjack'): Promise<boolean> => {
    if (!user || !userProfile) return false;

    try {
      // Oyun seansını al
      const { data: session, error: sessionError } = await supabase
        .from('game_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (sessionError) throw sessionError;

      // Kazanç hesapla (normal: 2x, blackjack: 2.5x)
      const multiplier = winType === 'blackjack' ? 2.5 : 2;
      const winAmount = Math.floor(session.bet_amount * multiplier);
      const newBalance = userProfile.chips + winAmount;

      // Profili güncelle
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({ 
          chips: newBalance,
          total_winnings: userProfile.total_winnings + winAmount,
          games_played: userProfile.games_played + 1
        })
        .eq('id', user.id);

      if (profileError) throw profileError;

      // Oyun seansını güncelle
      const { error: updateSessionError } = await supabase
        .from('game_sessions')
        .update({
          result: winType,
          payout: winAmount,
          chips_after: newBalance
        })
        .eq('id', sessionId);

      if (updateSessionError) throw updateSessionError;

      // Kasa chiplerini güncelle
      const { data: roomData, error: getRoomError } = await supabase
        .from('game_rooms')
        .select('house_chips')
        .eq('id', roomId)
        .single();

      if (getRoomError) throw getRoomError;

      const { error: houseError } = await supabase
        .from('game_rooms')
        .update({
          house_chips: roomData.house_chips - winAmount
        })
        .eq('id', roomId);

      if (houseError) throw houseError;

      // İşlemi kaydet
      const { error: transactionError } = await supabase
        .from('chip_transactions')
        .insert({
          user_id: user.id,
          transaction_type: 'win',
          amount: winAmount,
          balance_before: userProfile.chips,
          balance_after: newBalance,
          game_session_id: sessionId,
          description: `${winType === 'blackjack' ? 'Blackjack' : 'Normal'} kazanç: ${winAmount} chip`
        });

      if (transactionError) throw transactionError;

      // Local state'i güncelle
      setUserProfile(prev => prev ? { 
        ...prev, 
        chips: newBalance,
        total_winnings: prev.total_winnings + winAmount,
        games_played: prev.games_played + 1
      } : null);

      return true;
    } catch (error) {
      console.error('Kazanç işlemi hatası:', error);
      return false;
    }
  };

  // Kaybetme işlemi
  const processLoss = async (roomId: string, sessionId: string): Promise<boolean> => {
    if (!user || !userProfile) return false;

    try {
      // Oyun seansını al
      const { data: session, error: sessionError } = await supabase
        .from('game_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (sessionError) throw sessionError;

      // Profili güncelle
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({ 
          total_losses: userProfile.total_losses + session.bet_amount,
          games_played: userProfile.games_played + 1
        })
        .eq('id', user.id);

      if (profileError) throw profileError;

      // Oyun seansını güncelle
      const { error: updateSessionError } = await supabase
        .from('game_sessions')
        .update({
          result: 'loss',
          payout: 0
        })
        .eq('id', sessionId);

      if (updateSessionError) throw updateSessionError;

      // Kasa chiplerini güncelle
      const { data: roomData, error: getRoomError } = await supabase
        .from('game_rooms')
        .select('house_chips')
        .eq('id', roomId)
        .single();

      if (getRoomError) throw getRoomError;

      const { error: houseError } = await supabase
        .from('game_rooms')
        .update({
          house_chips: roomData.house_chips + session.bet_amount
        })
        .eq('id', roomId);

      if (houseError) throw houseError;

      // İşlemi kaydet
      const { error: transactionError } = await supabase
        .from('chip_transactions')
        .insert({
          user_id: user.id,
          transaction_type: 'loss',
          amount: -session.bet_amount,
          balance_before: session.chips_before,
          balance_after: userProfile.chips,
          game_session_id: sessionId,
          description: `Kayıp: ${session.bet_amount} chip`
        });

      if (transactionError) throw transactionError;

      // Local state'i güncelle
      setUserProfile(prev => prev ? { 
        ...prev,
        total_losses: prev.total_losses + session.bet_amount,
        games_played: prev.games_played + 1
      } : null);

      return true;
    } catch (error) {
      console.error('Kayıp işlemi hatası:', error);
      return false;
    }
  };

  // İşlem geçmişini al
  const getUserTransactions = async (limit: number = 10): Promise<ChipTransaction[]> => {
    if (!user) return [];

    try {
      const { data, error } = await supabase
        .from('chip_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('İşlem geçmişi alma hatası:', error);
      return [];
    }
  };

  // Profili yenile
  const refreshProfile = async () => {
    await loadUserProfile();
  };

  useEffect(() => {
    loadUserProfile();
  }, [user]);

  return (
    <VirtualCurrencyContext.Provider value={{
      userProfile,
      loading,
      depositChips,
      placeBet,
      processWin,
      processLoss,
      getGameRoom,
      getUserTransactions,
      refreshProfile
    }}>
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
