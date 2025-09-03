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
  const [betMultiplier, setBetMultiplier] = useState<number>(1);
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
  const betMultipliers = [1, 2, 3, 4, 5, 10];

  // Toplam bahis hesaplaması
  const totalBetAmount = betAmount * betMultiplier;

  // Maksimum çarpan hesaplaması (bakiyeye göre)
  const maxMultiplier = Math.floor(userProfile ? userProfile.chips / betAmount : 1);

  const handlePlaceBet = async () => {
    if (!userProfile) {
      setMessage('Kullanıcı bilgileri yüklenemedi');
      return;
    }

    if (totalBetAmount < minBet || totalBetAmount > maxBet) {
      setMessage(`Bahis ${minBet}-${maxBet} chip arasında olmalıdır`);
      return;
    }

    if (totalBetAmount > userProfile.chips) {
      setMessage('Yetersiz bakiye! Daha fazla chip yatırın.');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      // Bahis yap ve session ID'yi al
      const sessionId = await placeBet(roomId, totalBetAmount);
      
      if (sessionId) {
        setMessage(`Bahis başarıyla yerleştirildi! (${totalBetAmount.toLocaleString()} 💎) 🎯`);
        onBetPlaced(totalBetAmount, sessionId);
      } else {
        setMessage('Bahis yerleştirilemedi. Lütfen tekrar deneyin.');
      }
    } catch (error) {
      setMessage('Bir hata oluştu. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };

  // Çarpan değiştiğinde bakiye kontrolü
  const handleMultiplierChange = (multiplier: number) => {
    const newTotalBet = betAmount * multiplier;
    if (newTotalBet > (userProfile?.chips || 0)) {
      setMessage(`Yetersiz bakiye! Bu çarpan için maksimum ${Math.floor((userProfile?.chips || 0) / betAmount)}x çarpan kullanabilirsiniz.`);
      return;
    }
    setBetMultiplier(multiplier);
    setMessage('');
  };

  const handleNoBet = () => {
    if (onNoBet) {
      onNoBet();
    }
  };

  // Bahis miktarı değiştiğinde çarpanı kontrol et ve mesajı temizle
  const handleBetAmountChange = (amount: number) => {
    setBetAmount(amount);
    const newTotalBet = amount * betMultiplier;
    if (newTotalBet > (userProfile?.chips || 0)) {
      // Otomatik olarak çarpanı düşür
      const maxMult = Math.floor((userProfile?.chips || 0) / amount);
      if (maxMult >= 1) {
        setBetMultiplier(Math.min(betMultiplier, maxMult));
      } else {
        setBetMultiplier(1);
      }
    }
    setMessage('');
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
    <div className="w-full max-w-5xl bg-gradient-to-br from-purple-900 via-purple-800 to-purple-900 bg-opacity-95 backdrop-blur-sm rounded-3xl p-4 sm:p-6 lg:p-8 shadow-2xl border-4 border-purple-400 animate-modal-appear">
      {/* Header */}
      <div className="text-center mb-6">
        <h2 className="text-3xl sm:text-4xl font-bold text-white mb-2 drop-shadow-lg">💲 BAHIS YAP</h2>
        <div className="w-32 h-1 bg-gradient-to-r from-yellow-400 to-yellow-600 mx-auto rounded-full"></div>
      </div>

      {/* Bakiye Bilgileri */}
      <div className="text-center mb-6 bg-black bg-opacity-30 rounded-2xl p-4">
        <div className="flex justify-center items-center space-x-6 sm:space-x-8">
          <div className="text-center">
            <p className="text-yellow-200 text-sm sm:text-lg font-semibold">
              💎 Bakiyeniz
            </p>
            <p className="text-yellow-400 text-2xl sm:text-3xl font-bold">
              {userProfile.chips.toLocaleString()}
            </p>
          </div>
          {gameRoom && (
            <div className="text-center">
              <p className="text-purple-200 text-sm sm:text-lg font-semibold">
                🏠 Kasa
              </p>
              <p className="text-purple-300 text-2xl sm:text-3xl font-bold">
                {gameRoom.house_chips.toLocaleString()}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Chip-like Betting Options with Multiplier */}
      <div className="mb-6">
        <h3 className="text-yellow-300 font-bold text-xl sm:text-2xl mb-4 text-center">💰 Bahis Çipleri</h3>
        <div className="flex flex-wrap justify-center items-center gap-2 sm:gap-3 max-w-4xl mx-auto">
          {quickBetAmounts.map((amount) => (
            <button
              key={amount}
              onClick={() => handleBetAmountChange(amount)}
              disabled={amount > userProfile.chips}
              className={`relative w-16 h-16 sm:w-20 sm:h-20 rounded-full font-bold text-sm sm:text-lg transition-all duration-300 transform hover:scale-110 hover:-translate-y-2 shadow-2xl ${
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
                <div className="text-xs sm:text-sm font-bold">{amount}</div>
              </div>
            </button>
          ))}

          {/* Çarpan Kontrolü */}
          <div className="flex flex-col items-center ml-2 sm:ml-4">
            <div className="flex items-center bg-gradient-to-r from-orange-600 to-orange-700 rounded-lg p-1 shadow-lg border border-orange-400">
              <button
                onClick={() => handleMultiplierChange(Math.max(1, betMultiplier - 1))}
                disabled={betMultiplier <= 1}
                className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-orange-500 hover:bg-orange-400 disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center text-white font-bold text-sm sm:text-lg transition-all duration-200 hover:scale-105"
              >
                ▼
              </button>
              <div className="mx-1 sm:mx-2 text-center min-w-6 sm:min-w-8">
                <div className="text-orange-200 text-xs font-bold hidden sm:block">x</div>
                <div className="text-white text-sm sm:text-lg font-bold">{betMultiplier}</div>
              </div>
              <button
                onClick={() => handleMultiplierChange(Math.min(maxMultiplier, betMultiplier + 1))}
                disabled={betMultiplier >= maxMultiplier}
                className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-orange-500 hover:bg-orange-400 disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center text-white font-bold text-sm sm:text-lg transition-all duration-200 hover:scale-105"
              >
                ▲
              </button>
            </div>
          </div>
        </div>
        <p className="text-center text-purple-200 text-xs sm:text-sm mt-3">
          Seçili Bahis: <span className="text-yellow-400 font-bold text-sm sm:text-lg">{betAmount.toLocaleString()} 💎</span> × <span className="text-orange-400 font-bold text-sm sm:text-lg">{betMultiplier}</span> = <span className="text-green-400 font-bold text-sm sm:text-lg">{totalBetAmount.toLocaleString()} 💎</span>
        </p>
      </div>

      {/* Kazanç Hesaplaması */}
      <div className="mb-6 bg-black bg-opacity-30 rounded-2xl p-3">
        <div className="flex justify-center items-center space-x-4 sm:space-x-6">
          <div className="text-center">
            <p className="text-green-300 text-xs sm:text-sm font-bold">
              Normal Kazanç
            </p>
            <p className="text-green-400 text-sm sm:text-lg font-bold">
              {(totalBetAmount * 2).toLocaleString()} 💎
            </p>
          </div>
          <div className="text-center">
            <p className="text-yellow-300 text-xs sm:text-sm font-bold">
              Blackjack
            </p>
            <p className="text-yellow-400 text-sm sm:text-lg font-bold">
              {Math.floor(totalBetAmount * 2.5).toLocaleString()} 💎
            </p>
          </div>
        </div>
      </div>

      {/* Mesaj */}
      {message && (
        <div className={`mb-4 p-3 rounded-2xl text-center font-semibold text-sm sm:text-lg ${
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
          className="flex-1 bg-gradient-to-r from-green-500 to-green-600 text-white px-4 sm:px-6 py-3 sm:py-5 rounded-2xl font-bold text-lg sm:text-xl hover:from-green-600 hover:to-green-700 disabled:from-gray-500 disabled:to-gray-600 disabled:text-gray-300 disabled:cursor-not-allowed transition-all duration-300 shadow-2xl hover:shadow-3xl transform hover:-translate-y-2 border-4 border-green-400"
        >
          {loading ? '⏳ Bahis Yapılıyor...' : `🎯 ${totalBetAmount.toLocaleString()} 💎 Bahis Yap`}
        </button>
        
        {onNoBet && (
          <button
            onClick={handleNoBet}
            disabled={loading}
            className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 text-white px-4 sm:px-6 py-3 sm:py-5 rounded-2xl font-bold text-lg sm:text-xl hover:from-orange-600 hover:to-orange-700 disabled:from-gray-500 disabled:to-gray-600 disabled:text-gray-300 disabled:cursor-not-allowed transition-all duration-300 shadow-2xl hover:shadow-3xl transform hover:-translate-y-2 border-4 border-orange-400"
          >
            🚫 Bahis Yapmam
          </button>
        )}
        
        {onClose && (
          <button
            onClick={onClose}
            className="flex-1 bg-gradient-to-r from-gray-600 to-gray-700 text-white px-4 sm:px-6 py-3 sm:py-5 rounded-2xl font-bold text-lg sm:text-xl hover:from-gray-700 hover:to-gray-800 transition-all duration-300 shadow-2xl hover:shadow-3xl transform hover:-translate-y-2 border-4 border-gray-500"
          >
            ❌ İptal
          </button>
        )}
      </div>
    </div>
  );
}
