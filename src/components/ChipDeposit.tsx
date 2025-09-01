'use client';

import { useState } from 'react';
import { useVirtualCurrency } from '../lib/virtualCurrency';

interface ChipDepositProps {
  onClose: () => void;
}

export default function ChipDeposit({ onClose }: ChipDepositProps) {
  const { userChips, depositChips, loading, formatChips } = useVirtualCurrency();
  const [amount, setAmount] = useState<number>(100);
  const [message, setMessage] = useState('');

  const quickAmounts = [100, 500, 1000, 2500, 5000];

  const handleDeposit = async () => {
    if (amount <= 0) {
      setMessage('Geçerli bir miktar girin');
      return;
    }

    setMessage('');
    const success = await depositChips(amount);

    if (success) {
      setMessage(`✅ ${formatChips(amount)} chip başarıyla yatırıldı!`);
      setTimeout(() => {
        onClose();
      }, 2000);
    } else {
      setMessage('❌ Chip yatırma işlemi başarısız oldu');
    }
  };

  return (
    <div className="bg-white rounded-3xl p-8 max-w-md w-full mx-4 shadow-2xl">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">💰 Chip Yatırma</h2>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700 text-2xl"
        >
          ×
        </button>
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

      {/* Quick Amount Buttons */}
      <div className="mb-6">
        <p className="text-sm font-semibold text-gray-700 mb-3">Hızlı Miktar:</p>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {quickAmounts.map((quickAmount) => (
            <button
              key={quickAmount}
              onClick={() => setAmount(quickAmount)}
              className={`p-3 rounded-xl font-bold text-sm transition-all duration-200 ${
                amount === quickAmount
                  ? 'bg-yellow-500 text-white shadow-lg transform scale-105'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {formatChips(quickAmount)}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Amount Input */}
      <div className="mb-6">
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Özel Miktar:
        </label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(Math.max(0, parseInt(e.target.value) || 0))}
          className="w-full p-4 border-2 border-gray-300 rounded-xl text-lg font-semibold focus:border-yellow-500 focus:ring-4 focus:ring-yellow-200 focus:outline-none"
          placeholder="Chip miktarı"
          min="1"
        />
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-xl mb-4 text-center font-semibold ${
          message.includes('✅')
            ? 'bg-green-100 text-green-800'
            : 'bg-red-100 text-red-800'
        }`}>
          {message}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleDeposit}
          disabled={loading || amount <= 0}
          className="flex-1 bg-gradient-to-r from-green-500 to-green-600 text-white p-4 rounded-xl font-bold text-lg hover:from-green-600 hover:to-green-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
        >
          {loading ? '⏳ Yatırılıyor...' : `💰 ${formatChips(amount)} Yatır`}
        </button>
        <button
          onClick={onClose}
          className="flex-1 bg-gradient-to-r from-gray-500 to-gray-600 text-white p-4 rounded-xl font-bold text-lg hover:from-gray-600 hover:to-gray-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
        >
          İptal
        </button>
      </div>

      {/* Info */}
      <div className="mt-4 p-3 bg-blue-50 rounded-lg">
        <p className="text-xs text-blue-700 text-center">
          💡 Şu anda ücretsiz chip yatırma aktif! Daha sonra gerçek para sistemi eklenecek.
        </p>
      </div>
    </div>
  );
}
