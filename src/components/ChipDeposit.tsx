'use client';

import { useState } from 'react';
import { useVirtualCurrency } from '../lib/virtualCurrency';

interface ChipDepositProps {
  onClose?: () => void;
}

export default function ChipDeposit({ onClose }: ChipDepositProps) {
  const [amount, setAmount] = useState<number>(1000);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const { userProfile, depositChips, refreshProfile } = useVirtualCurrency();

  const predefinedAmounts = [500, 1000, 2500, 5000, 10000, 25000];

  const handleDeposit = async () => {
    if (amount <= 0) {
      setMessage('Geçerli bir miktar girin');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const success = await depositChips(amount);
      if (success) {
        setMessage(`${amount.toLocaleString()} chip başarıyla hesabınıza eklendi! 🎉`);
        await refreshProfile();
        setTimeout(() => {
          onClose?.();
        }, 2000);
      } else {
        setMessage('Chip yatırma işlemi başarısız oldu. Lütfen tekrar deneyin.');
      }
    } catch {
      setMessage('Bir hata oluştu. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-green-700 via-green-800 to-green-900 p-8 rounded-3xl shadow-2xl border-4 border-yellow-400 max-w-md w-full mx-auto">
      <div className="text-center mb-6">
        <div className="text-6xl mb-4">💰</div>
        <h2 className="text-3xl font-bold text-yellow-400 mb-2">Chip Yatır</h2>
        <div className="bg-black bg-opacity-30 rounded-xl p-4 mb-4">
          <p className="text-yellow-200 text-lg font-semibold">
            Mevcut Bakiye: <span className="text-yellow-400">{userProfile?.chips.toLocaleString() || 0}</span> 💎
          </p>
        </div>
        <p className="text-green-200 text-sm">
          💡 Şu an için ücretsiz! Dilediğiniz kadar chip alabilirsiniz.
        </p>
      </div>

      {/* Hızlı Seçim Butonları */}
      <div className="mb-6">
        <label className="block text-yellow-300 font-bold mb-3 text-center">Hızlı Seçim</label>
        <div className="grid grid-cols-3 gap-2">
          {predefinedAmounts.map((preset) => (
            <button
              key={preset}
              onClick={() => setAmount(preset)}
              className={`p-3 rounded-xl font-bold transition-all duration-200 ${
                amount === preset
                  ? 'bg-yellow-500 text-black border-2 border-yellow-300'
                  : 'bg-green-600 text-white border-2 border-green-500 hover:bg-green-500'
              }`}
            >
              {preset.toLocaleString()}
            </button>
          ))}
        </div>
      </div>

      {/* Manuel Miktar Girişi */}
      <div className="mb-6">
        <label className="block text-yellow-300 font-bold mb-2">💎 Chip Miktarı</label>
        <input
          type="number"
          min="1"
          step="1"
          value={amount}
          onChange={(e) => setAmount(Math.max(1, parseInt(e.target.value) || 0))}
          className="w-full p-4 bg-black bg-opacity-50 border-3 border-yellow-500 rounded-xl text-yellow-100 text-xl font-bold text-center placeholder:text-gray-400 focus:border-yellow-300 focus:ring-4 focus:ring-yellow-200 focus:outline-none transition-all duration-200"
          placeholder="Miktar girin..."
        />
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
          onClick={handleDeposit}
          disabled={loading || amount <= 0}
          className="flex-1 bg-gradient-to-r from-yellow-500 to-yellow-600 text-black px-6 py-4 rounded-xl font-bold text-lg hover:from-yellow-400 hover:to-yellow-500 disabled:from-gray-500 disabled:to-gray-600 disabled:text-gray-300 disabled:cursor-not-allowed transition-all duration-200 shadow-xl hover:shadow-2xl transform hover:-translate-y-1 border-2 border-yellow-400"
        >
          {loading ? '⏳ Ekleniyor...' : '💰 Chip Yatır'}
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

      {/* Açıklama */}
      <div className="mt-6 bg-black bg-opacity-20 rounded-xl p-4">
        <h3 className="text-yellow-300 font-bold mb-2 text-center">ℹ️ Bilgi</h3>
        <ul className="text-green-200 text-sm space-y-1">
          <li>• Chip&apos;ler sadece oyun içinde kullanılabilir</li>
          <li>• Kazandığınız chip&apos;ler hesabınızda kalıcı olarak durur</li>
          <li>• Bahis yaparken mevcut bakiyenizi kontrol edin</li>
          <li>• Blackjack&apos;te kazanırsan bahisinin 2 katını alırsın!</li>
        </ul>
      </div>
    </div>
  );
}
