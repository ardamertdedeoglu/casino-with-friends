'use client';

import { useState } from 'react';

interface BluffBetPlacementProps {
  currentBet: {
    quantity: number;
    value: number;
    playerName: string;
    isBluff: boolean;
  } | null;
  onBetSubmit: (quantity: number, value: number, isBluff: boolean) => void;
  onClose: () => void;
  myDice: number[];
}

export default function BluffBetPlacement({ 
  currentBet, 
  onBetSubmit, 
  onClose,
  myDice
}: BluffBetPlacementProps) {
  const [quantity, setQuantity] = useState(currentBet ? currentBet.quantity + 1 : 1);
  const [value, setValue] = useState(currentBet ? currentBet.value : 1);
  const [isBluffBet, setIsBluffBet] = useState(false);

  // Bahis geçerliliğini kontrol et
  const isValidBet = (q: number, v: number) => {
    if (!currentBet) {
      return q >= 1 && v >= 1 && v <= 6;
    }
    
    if (q > currentBet.quantity) {
      return v >= 1 && v <= 6;
    } else if (q === currentBet.quantity) {
      return v > currentBet.value && v <= 6;
    }
    
    return false;
  };

  // Zarlarımda bu değerden kaç tane var
  const getMyDiceCount = (diceValue: number) => {
    return myDice.filter(die => die === diceValue).length;
  };

  // Tavsiye edilen bahisleri hesapla
  const getSuggestedBets = () => {
    const diceCounts = [1, 2, 3, 4, 5, 6].map(value => ({
      value,
      count: getMyDiceCount(value),
      // Güvenli tahmin: kendi zarlarındakiler + diğer oyunculardan tahmin
      safeQuantity: Math.max(1, getMyDiceCount(value))
    }));

    return diceCounts.filter(dc => dc.count > 0).sort((a, b) => b.count - a.count);
  };

  const handleSubmit = () => {
    if (isValidBet(quantity, value)) {
      onBetSubmit(quantity, value, isBluffBet);
    }
  };

  const suggestedBets = getSuggestedBets();

  return (
    <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-6 rounded-3xl shadow-2xl border-2 border-yellow-500 max-w-lg mx-auto">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-yellow-400 mb-2">🎲 Blöf Bahisi</h2>
        
        {currentBet && (
          <div className="text-gray-300 text-sm mb-4 bg-gray-700 p-3 rounded-lg">
            <div className="mb-1">Mevcut Bahis:</div>
            <div className="text-yellow-400 font-bold text-lg">
              {currentBet.quantity} × 🎲 {currentBet.value}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              {currentBet.playerName} tarafından
            </div>
          </div>
        )}
      </div>

      {/* Kendi Zarlarımız */}
      <div className="mb-6">
        <h3 className="text-yellow-300 font-semibold mb-3 text-center">Zarlarınız</h3>
        <div className="flex justify-center space-x-2 mb-3">
          {myDice.map((die, i) => (
            <div
              key={i}
              className="w-10 h-10 bg-gradient-to-br from-white to-gray-100 rounded-lg border-2 border-gray-800 flex items-center justify-center text-sm font-bold text-black shadow-lg"
            >
              {die}
            </div>
          ))}
        </div>
        
        {/* Zar sayıları */}
        <div className="grid grid-cols-6 gap-1 text-center text-xs">
          {[1, 2, 3, 4, 5, 6].map(v => (
            <div key={v} className="text-gray-400">
              {v}: {getMyDiceCount(v)}x
            </div>
          ))}
        </div>
      </div>

      {/* Bahis Ayarları */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <label className="text-gray-300 font-semibold">Miktar:</label>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 transition-colors"
            >
              -
            </button>
            <span className="text-white font-bold text-xl w-12 text-center">{quantity}</span>
            <button
              onClick={() => setQuantity(quantity + 1)}
              className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 transition-colors"
            >
              +
            </button>
          </div>
        </div>

        <div className="mb-4">
          <label className="text-gray-300 font-semibold mb-2 block">Değer:</label>
          <div className="grid grid-cols-6 gap-2">
            {[1, 2, 3, 4, 5, 6].map(v => (
              <button
                key={v}
                onClick={() => setValue(v)}
                className={`h-12 rounded border-2 text-sm font-bold transition-all relative ${
                  value === v
                    ? 'bg-yellow-500 border-yellow-300 text-black'
                    : 'bg-gray-600 border-gray-500 text-white hover:bg-gray-500'
                }`}
              >
                {v}
                {getMyDiceCount(v) > 0 && (
                  <div className="absolute -top-1 -right-1 bg-green-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
                    {getMyDiceCount(v)}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Blöf Seçeneği */}
        <div className="mb-4">
          <label className="flex items-center space-x-2 text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={isBluffBet}
              onChange={(e) => setIsBluffBet(e.target.checked)}
              className="w-4 h-4 text-red-600 bg-gray-700 border-gray-600 rounded focus:ring-red-500"
            />
            <span>🤥 Bu bir blöf</span>
          </label>
          {isBluffBet && (
            <div className="text-red-400 text-xs mt-1">
              Dikkat! Blöf yapıyorsanız itiraz edilirse kaybedebilirsiniz.
            </div>
          )}
        </div>
      </div>

      {/* Tavsiye Edilen Bahisler */}
      {suggestedBets.length > 0 && (
        <div className="mb-6">
          <h4 className="text-yellow-300 font-semibold mb-2 text-sm">💡 Güvenli Bahisler:</h4>
          <div className="space-y-1">
            {suggestedBets.slice(0, 3).map(bet => (
              <button
                key={bet.value}
                onClick={() => {
                  setQuantity(bet.safeQuantity);
                  setValue(bet.value);
                  setIsBluffBet(false);
                }}
                className="w-full text-left bg-gray-700 hover:bg-gray-600 p-2 rounded text-sm transition-colors"
              >
                <span className="text-white">
                  {bet.safeQuantity} × 🎲 {bet.value}
                </span>
                <span className="text-gray-400 ml-2">
                  (Elinizde {bet.count} adet)
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Geçerlilik Uyarısı */}
      {!isValidBet(quantity, value) && currentBet && (
        <div className="bg-red-900 bg-opacity-50 border border-red-500 p-3 rounded-lg mb-4">
          <div className="text-red-400 text-sm text-center">
            ⚠️ Bahis {currentBet.quantity} × {currentBet.value}&apos;den yüksek olmalı
          </div>
        </div>
      )}

      {/* Butonlar */}
      <div className="flex space-x-3">
        <button
          onClick={onClose}
          className="flex-1 bg-gray-600 text-white py-3 px-4 rounded-lg font-bold hover:bg-gray-700 transition-colors"
        >
          İptal
        </button>
        
        <button
          onClick={handleSubmit}
          disabled={!isValidBet(quantity, value)}
          className={`flex-2 py-3 px-6 rounded-lg font-bold transition-colors ${
            isValidBet(quantity, value)
              ? isBluffBet
                ? 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white'
                : 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white'
              : 'bg-gray-500 text-gray-300 cursor-not-allowed'
          }`}
        >
          {isBluffBet ? '🤥 Blöf Yap' : '💰 Bahis Yap'}
        </button>
      </div>

      {/* İpucu */}
      <div className="mt-4 text-xs text-gray-400 text-center">
        💡 İpucu: Elinizde çok olan zarlarla güvenli bahis yapın veya blöf yaparak rakiplerinizi şaşırtın!
      </div>
    </div>
  );
}