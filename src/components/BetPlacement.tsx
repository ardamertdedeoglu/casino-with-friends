'use client';

import { useState } from 'react';
import { useVirtualCurrency } from '../lib/virtualCurrency';

interface BetPlacementProps {
  roomId: string;
  gameType: string;
  onBetPlaced: (amount: number, sessionId: string) => void;
  onNoBet?: () => void;
  onClose?: () => void;
  minBet?: number;
  maxBet?: number;
}

interface GameRoom {
  id: string;
  game_type: string;
  house_chips: number;
  status: string;
}

export default function BetPlacement({ 
  roomId, 
  gameType, 
  onBetPlaced, 
  onNoBet,
  onClose,
  minBet = 10,
  maxBet = 1000 
}: BetPlacementProps) {
  const [betAmount, setBetAmount] = useState<number>(minBet);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const { userProfile, placeBet, getGameRoom } = useVirtualCurrency();

  const [gameRoom, setGameRoom] = useState<GameRoom | null>(null);

  // Oyun odasını yükle
  useState(() => {
    const loadRoom = async () => {
      const room = await getGameRoom(roomId, gameType);
      setGameRoom(room);
    };
    loadRoom();
  });

  const quickBetAmounts = [minBet, 25, 50, 100, 250, 500];

  const handlePlaceBet = async () => {
    if (!userProfile) {
      setMessage('Kullanıcı bilgileri yüklenemedi');
      return;
    }

    if (betAmount < minBet || betAmount > maxBet) {
      setMessage(`Bahis ${minBet}-${maxBet} chip arasında olmalıdır`);
      return;
    }

    if (betAmount > userProfile.chips) {
      setMessage('Yetersiz bakiye! Daha fazla chip yatırın.');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      // Bahis yap ve session ID'yi al
      const sessionId = await placeBet(roomId, betAmount);
      
      if (sessionId) {
        setMessage('Bahis başarıyla yerleştirildi! 🎯');
        onBetPlaced(betAmount, sessionId);
      } else {
        setMessage('Bahis yerleştirilemedi. Lütfen tekrar deneyin.');
      }
    } catch (error) {
      setMessage('Bir hata oluştu. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };

  const handleNoBet = () => {
    if (onNoBet) {
      onNoBet();
    }
  };

  if (!userProfile) {
    return (
      <div className="bg-gradient-to-br from-red-700 via-red-800 to-red-900 p-8 rounded-3xl shadow-2xl border-4 border-red-400 max-w-md w-full mx-auto text-center">
        <div className="text-6xl mb-4">⚠️</div>
        <h2 className="text-2xl font-bold text-red-200 mb-4">Profil Yüklenemedi</h2>
        <p className="text-red-300">Lütfen sayfayı yenileyin veya tekrar giriş yapın.</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl bg-gradient-to-br from-purple-900 via-purple-800 to-purple-900 bg-opacity-95 backdrop-blur-sm rounded-3xl p-8 shadow-2xl border-4 border-purple-400 animate-modal-appear">
      {/* Header */}
      <div className="text-center mb-8">
        <h2 className="text-4xl font-bold text-white mb-2 drop-shadow-lg">💲 BAHIS YAP</h2>
        <div className="w-32 h-1 bg-gradient-to-r from-yellow-400 to-yellow-600 mx-auto rounded-full"></div>
      </div>

      {/* Bakiye Bilgileri */}
      <div className="text-center mb-8 bg-black bg-opacity-30 rounded-2xl p-6">
        <div className="flex justify-center items-center space-x-8">
          <div className="text-center">
            <p className="text-yellow-200 text-lg font-semibold">
              💎 Bakiyeniz
            </p>
            <p className="text-yellow-400 text-3xl font-bold">
              {userProfile.chips.toLocaleString()}
            </p>
          </div>
          {gameRoom && (
            <div className="text-center">
              <p className="text-purple-200 text-lg font-semibold">
                🏠 Kasa
              </p>
              <p className="text-purple-300 text-3xl font-bold">
                {gameRoom.house_chips.toLocaleString()}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Chip-like Betting Options */}
      <div className="mb-8">
        <h3 className="text-yellow-300 font-bold text-2xl mb-6 text-center">💰 Bahis Çipleri</h3>
        <div className="flex flex-wrap justify-center gap-4">
          {quickBetAmounts.map((amount) => (
            <button
              key={amount}
              onClick={() => setBetAmount(amount)}
              disabled={amount > userProfile.chips}
              className={`relative w-20 h-20 rounded-full font-bold text-lg transition-all duration-300 transform hover:scale-110 hover:-translate-y-2 shadow-2xl ${
                betAmount === amount
                  ? 'bg-gradient-to-br from-yellow-400 via-yellow-500 to-yellow-600 text-black border-4 border-yellow-300 animate-pulse shadow-yellow-400/50'
                  : amount > userProfile.chips
                  ? 'bg-gradient-to-br from-gray-600 to-gray-700 text-gray-400 border-4 border-gray-500 cursor-not-allowed opacity-50'
                  : amount <= 50 
                  ? 'bg-gradient-to-br from-red-500 via-red-600 to-red-700 text-white border-4 border-red-400 hover:shadow-red-400/50'
                  : amount <= 100
                  ? 'bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 text-white border-4 border-blue-400 hover:shadow-blue-400/50'
                  : amount <= 250
                  ? 'bg-gradient-to-br from-green-500 via-green-600 to-green-700 text-white border-4 border-green-400 hover:shadow-green-400/50'
                  : 'bg-gradient-to-br from-purple-500 via-purple-600 to-purple-700 text-white border-4 border-purple-400 hover:shadow-purple-400/50'
              } ${amount > userProfile.chips ? '' : 'hover:shadow-2xl'}`}
            >
              <div className="absolute inset-1 rounded-full border-2 border-white border-opacity-30"></div>
              <div className="flex flex-col items-center justify-center h-full">
                <div className="text-xs font-bold opacity-80">💎</div>
                <div className="text-sm font-bold">{amount}</div>
              </div>
            </button>
          ))}
        </div>
        <p className="text-center text-purple-200 text-sm mt-4">
          Seçili Bahis: <span className="text-yellow-400 font-bold text-lg">{betAmount.toLocaleString()} 💎</span>
        </p>
      </div>

      {/* Kazanç Hesaplaması */}
      <div className="mb-8 bg-black bg-opacity-30 rounded-2xl p-6">
        <h3 className="text-yellow-300 font-bold text-xl mb-4 text-center">🎯 Potansiyel Kazanç</h3>
        <div className="flex justify-center space-x-8">
          <div className="text-center">
            <p className="text-green-300 text-lg">
              <span className="text-sm opacity-80">Normal</span><br/>
              <span className="font-bold text-xl">{(betAmount * 2).toLocaleString()}</span> 💎
            </p>
          </div>
          <div className="text-center">
            <p className="text-yellow-300 text-lg">
              <span className="text-sm opacity-80">Blackjack</span><br/>
              <span className="font-bold text-xl">{Math.floor(betAmount * 2.5).toLocaleString()}</span> 💎
            </p>
          </div>
        </div>
      </div>

      {/* Mesaj */}
      {message && (
        <div className={`mb-6 p-4 rounded-2xl text-center font-semibold text-lg ${
          message.includes('başarıyla') 
            ? 'bg-green-600 text-white' 
            : 'bg-red-600 text-white'
        }`}>
          {message}
        </div>
      )}

      {/* Butonlar */}
      <div className="flex gap-4">
        <button
          onClick={handlePlaceBet}
          disabled={loading || betAmount > userProfile.chips || betAmount < minBet}
          className="flex-1 bg-gradient-to-r from-green-500 to-green-600 text-white px-6 py-5 rounded-2xl font-bold text-xl hover:from-green-600 hover:to-green-700 disabled:from-gray-500 disabled:to-gray-600 disabled:text-gray-300 disabled:cursor-not-allowed transition-all duration-300 shadow-2xl hover:shadow-3xl transform hover:-translate-y-2 border-4 border-green-400"
        >
          {loading ? '⏳ Bahis Yapılıyor...' : '🎯 Bahis Yap'}
        </button>
        
        {onNoBet && (
          <button
            onClick={handleNoBet}
            disabled={loading}
            className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 text-white px-6 py-5 rounded-2xl font-bold text-xl hover:from-orange-600 hover:to-orange-700 disabled:from-gray-500 disabled:to-gray-600 disabled:text-gray-300 disabled:cursor-not-allowed transition-all duration-300 shadow-2xl hover:shadow-3xl transform hover:-translate-y-2 border-4 border-orange-400"
          >
            🚫 Bahis Yapmam
          </button>
        )}
        
        {onClose && (
          <button
            onClick={onClose}
            className="flex-1 bg-gradient-to-r from-gray-600 to-gray-700 text-white px-6 py-5 rounded-2xl font-bold text-xl hover:from-gray-700 hover:to-gray-800 transition-all duration-300 shadow-2xl hover:shadow-3xl transform hover:-translate-y-2 border-4 border-gray-500"
          >
            ❌ İptal
          </button>
        )}
      </div>
    </div>
  );
}
