'use client';

import { useState } from 'react';
import { useVirtualCurrency } from '../lib/virtualCurrency';

interface BetPlacementProps {
  onBetPlaced: (betAmount: number) => void;
  onCancel: () => void;
  minBet?: number;
  maxBet?: number;
}

export default function BetPlacement({
  onBetPlaced,
  onCancel,
  minBet = 10,
  maxBet = 1000
}: BetPlacementProps) {
  const { userChips, canAffordBet, formatChips } = useVirtualCurrency();
  const [betAmount, setBetAmount] = useState<number>(minBet);
  const [error, setError] = useState('');

  const quickAmounts = [10, 25, 50, 100, 250, 500];

  const handleBetAmountChange = (amount: number) => {
    setError('');

    if (amount < minBet) {
      setError(`Minimum bahis: ${formatChips(minBet)} chip`);
      return;
    }

    if (amount > maxBet) {
      setError(`Maksimum bahis: ${formatChips(maxBet)} chip`);
      return;
    }

    if (!canAffordBet(amount)) {
      setError('Yetersiz bakiye!');
      return;
    }

    setBetAmount(amount);
  };

  const handlePlaceBet = () => {
    if (betAmount < minBet || betAmount > maxBet) {
      setError(`Bahis miktarı ${formatChips(minBet)} - ${formatChips(maxBet)} arasında olmalı`);
      return;
    }

    if (!canAffordBet(betAmount)) {
      setError('Yetersiz bakiye!');
      return;
    }

    onBetPlaced(betAmount);
  };

  const maxPossibleBet = Math.min(maxBet, userChips?.balance || 0);

  return (
    <div className="bg-white rounded-3xl p-8 max-w-md w-full mx-4 shadow-2xl">
      <div className="text-center mb-6">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">🎯 Bahis Yap</h2>
        <p className="text-gray-600">Oyun başlamadan önce bahis miktarınızı belirleyin</p>
      </div>

      {/* Current Balance */}
      <div className="bg-gradient-to-r from-yellow-100 to-yellow-200 p-4 rounded-xl mb-6">
        <div className="text-center">
          <p className="text-sm text-gray-600 mb-1">Mevcut Bakiye</p>
          <p className="text-2xl font-bold text-yellow-800">
            {userChips ? formatChips(userChips.balance) : '0'} 💰
          </p>
        </div>
      </div>

      {/* Bet Amount Display */}
      <div className="text-center mb-6">
        <p className="text-sm text-gray-600 mb-2">Bahis Miktarı</p>
        <div className="text-4xl font-bold text-green-600">
          {formatChips(betAmount)} 💰
        </div>
      </div>

      {/* Quick Amount Buttons */}
      <div className="mb-6">
        <p className="text-sm font-semibold text-gray-700 mb-3">Hızlı Bahis:</p>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {quickAmounts.map((amount) => (
            <button
              key={amount}
              onClick={() => handleBetAmountChange(amount)}
              disabled={!canAffordBet(amount) || amount > maxBet}
              className={`p-3 rounded-xl font-bold text-sm transition-all duration-200 ${
                betAmount === amount
                  ? 'bg-green-500 text-white shadow-lg transform scale-105'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:bg-gray-300 disabled:text-gray-400 disabled:cursor-not-allowed'
              }`}
            >
              {formatChips(amount)}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Bet Input */}
      <div className="mb-6">
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Özel Bahis Miktarı:
        </label>
        <input
          type="number"
          value={betAmount}
          onChange={(e) => handleBetAmountChange(parseInt(e.target.value) || 0)}
          className="w-full p-4 border-2 border-gray-300 rounded-xl text-lg font-semibold focus:border-green-500 focus:ring-4 focus:ring-green-200 focus:outline-none"
          placeholder="Bahis miktarı"
          min={minBet}
          max={maxPossibleBet}
        />
        <p className="text-xs text-gray-500 mt-1">
          Min: {formatChips(minBet)} - Max: {formatChips(maxPossibleBet)}
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl mb-4 text-center font-semibold">
          {error}
        </div>
      )}

      {/* Potential Winnings */}
      <div className="bg-blue-50 p-4 rounded-xl mb-6">
        <div className="text-center">
          <p className="text-sm text-blue-700 mb-1">Potansiyel Kazanç</p>
          <p className="text-xl font-bold text-blue-800">
            {formatChips(betAmount * 2)} 💰
          </p>
          <p className="text-xs text-blue-600">Blackjack&apos;de kazanç 2 katıdır</p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={handlePlaceBet}
          disabled={!!error || !canAffordBet(betAmount)}
          className="flex-1 bg-gradient-to-r from-green-500 to-green-600 text-white p-4 rounded-xl font-bold text-lg hover:from-green-600 hover:to-green-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
        >
          🎯 Bahis Yap
        </button>
        <button
          onClick={onCancel}
          className="flex-1 bg-gradient-to-r from-gray-500 to-gray-600 text-white p-4 rounded-xl font-bold text-lg hover:from-gray-600 hover:to-gray-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
        >
          İptal
        </button>
      </div>
    </div>
  );
}
