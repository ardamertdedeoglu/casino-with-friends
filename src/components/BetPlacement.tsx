'use client';

import { useState } from 'react';
import { useVirtualCurrency } from '../lib/virtualCurrency';

interface BetPlacementProps {
  roomId: string;
  gameType: string;
  onBetPlaced: (amount: number, sessionId: string) => void;
  onClose?: () => void;
  minBet?: number;
  maxBet?: number;
}

export default function BetPlacement({ 
  roomId, 
  gameType, 
  onBetPlaced, 
  onClose,
  minBet = 10,
  maxBet = 1000 
}: BetPlacementProps) {
  const [betAmount, setBetAmount] = useState<number>(minBet);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const { userProfile, placeBet, getGameRoom } = useVirtualCurrency();

  const [gameRoom, setGameRoom] = useState<any>(null);

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
    <div className="bg-gradient-to-br from-purple-700 via-purple-800 to-purple-900 p-8 rounded-3xl shadow-2xl border-4 border-yellow-400 max-w-md w-full mx-auto">
      <div className="text-center mb-6">
        <div className="text-6xl mb-4">🎯</div>
        <h2 className="text-3xl font-bold text-yellow-400 mb-2">Bahis Yap</h2>
        <div className="bg-black bg-opacity-30 rounded-xl p-4 mb-4">
          <p className="text-yellow-200 text-lg font-semibold">
            Bakiyeniz: <span className="text-yellow-400">{userProfile.chips.toLocaleString()}</span> 💎
          </p>
          {gameRoom && (
            <p className="text-purple-200 text-sm mt-2">
              Kasa: <span className="text-purple-300">{gameRoom.house_chips.toLocaleString()}</span> 💰
            </p>
          )}
        </div>
      </div>

      {/* Hızlı Bahis Butonları */}
      <div className="mb-6">
        <label className="block text-yellow-300 font-bold mb-3 text-center">Hızlı Bahis</label>
        <div className="grid grid-cols-3 gap-2">
          {quickBetAmounts.map((amount) => (
            <button
              key={amount}
              onClick={() => setBetAmount(amount)}
              disabled={amount > userProfile.chips}
              className={`p-3 rounded-xl font-bold transition-all duration-200 ${
                betAmount === amount
                  ? 'bg-yellow-500 text-black border-2 border-yellow-300'
                  : amount > userProfile.chips
                  ? 'bg-gray-600 text-gray-400 border-2 border-gray-500 cursor-not-allowed'
                  : 'bg-purple-600 text-white border-2 border-purple-500 hover:bg-purple-500'
              }`}
            >
              {amount}
            </button>
          ))}
        </div>
      </div>

      {/* Manuel Bahis Girişi */}
      <div className="mb-6">
        <label className="block text-yellow-300 font-bold mb-2">💰 Bahis Miktarı</label>
        <input
          type="number"
          min={minBet}
          max={Math.min(maxBet, userProfile.chips)}
          step="1"
          value={betAmount}
          onChange={(e) => {
            const value = parseInt(e.target.value) || minBet;
            setBetAmount(Math.min(Math.max(value, minBet), Math.min(maxBet, userProfile.chips)));
          }}
          className="w-full p-4 bg-black bg-opacity-50 border-3 border-yellow-500 rounded-xl text-yellow-100 text-xl font-bold text-center placeholder:text-gray-400 focus:border-yellow-300 focus:ring-4 focus:ring-yellow-200 focus:outline-none transition-all duration-200"
          placeholder="Bahis miktarı..."
        />
        <div className="flex justify-between text-sm text-purple-200 mt-2">
          <span>Min: {minBet}</span>
          <span>Max: {Math.min(maxBet, userProfile.chips)}</span>
        </div>
      </div>

      {/* Kazanç Hesaplaması */}
      <div className="mb-6 bg-black bg-opacity-20 rounded-xl p-4">
        <h3 className="text-yellow-300 font-bold mb-2 text-center">📈 Potansiyel Kazanç</h3>
        <div className="space-y-2 text-center">
          <p className="text-green-300">
            Normal Kazanç: <span className="font-bold">{(betAmount * 2).toLocaleString()}</span> 💎
          </p>
          <p className="text-yellow-300">
            Blackjack: <span className="font-bold">{Math.floor(betAmount * 2.5).toLocaleString()}</span> 💎
          </p>
        </div>
      </div>

      {/* Mesaj */}
      {message && (
        <div className={`mb-4 p-3 rounded-xl text-center font-semibold ${
          message.includes('başarıyla') 
            ? 'bg-green-600 text-white' 
            : 'bg-red-600 text-white'
        }`}>
          {message}
        </div>
      )}

      {/* Butonlar */}
      <div className="flex gap-3">
        <button
          onClick={handlePlaceBet}
          disabled={loading || betAmount > userProfile.chips || betAmount < minBet}
          className="flex-1 bg-gradient-to-r from-green-500 to-green-600 text-white px-6 py-4 rounded-xl font-bold text-lg hover:from-green-600 hover:to-green-700 disabled:from-gray-500 disabled:to-gray-600 disabled:text-gray-300 disabled:cursor-not-allowed transition-all duration-200 shadow-xl hover:shadow-2xl transform hover:-translate-y-1 border-2 border-green-400"
        >
          {loading ? '⏳ Bahis Yapılıyor...' : '🎯 Bahis Yap'}
        </button>
        {onClose && (
          <button
            onClick={onClose}
            className="flex-1 bg-gradient-to-r from-gray-600 to-gray-700 text-white px-6 py-4 rounded-xl font-bold text-lg hover:from-gray-700 hover:to-gray-800 transition-all duration-200 shadow-xl hover:shadow-2xl transform hover:-translate-y-1 border-2 border-gray-500"
          >
            ❌ İptal
          </button>
        )}
      </div>

      {/* Oyun Kuralları */}
      <div className="mt-6 bg-black bg-opacity-20 rounded-xl p-4">
        <h3 className="text-yellow-300 font-bold mb-2 text-center">🎮 Blackjack Kuralları</h3>
        <ul className="text-purple-200 text-sm space-y-1">
          <li>• Kazanırsan bahisinin 2 katını alırsın (1:1)</li>
          <li>• Blackjack yaparsan 2.5 katını alırsın (3:2)</li>
          <li>• Kaybedersen bahisini kaybedersin</li>
          <li>• Berabere kalırsan bahisini geri alırsın</li>
        </ul>
      </div>
    </div>
  );
}
