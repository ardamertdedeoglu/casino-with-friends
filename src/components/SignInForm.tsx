'use client';

import { useState } from 'react';
import { useAuth } from '../lib/auth';

interface SignInFormProps {
  onSuccess?: () => void;
  onClose?: () => void;
  onSwitchToSignUp?: () => void;
}

export default function SignInForm({ onSuccess, onClose, onSwitchToSignUp }: SignInFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const { signIn } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    // Validation
    if (!email || !password) {
      setMessage('Lütfen e-posta ve şifrenizi girin.');
      setLoading(false);
      return;
    }

    try {
      const { error } = await signIn(email, password);

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          setMessage('E-posta veya şifre hatalı.');
        } else if (error.message.includes('Email not confirmed')) {
          setMessage('E-posta adresinizi henüz doğrulamadınız. Lütfen e-postanızı kontrol edin.');
        } else {
          setMessage(error.message);
        }
      } else {
        // Başarılı giriş - modal kapanacak
        if (onSuccess) onSuccess();
        if (onClose) onClose();
      }
    } catch {
      setMessage('Bir hata oluştu. Lütfen tekrar deneyin.');
    }

    setLoading(false);
  };

  return (
    <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 bg-opacity-95 backdrop-blur-sm rounded-2xl p-8 max-w-md w-full shadow-2xl border-4 border-blue-400 pointer-events-auto animate-modal-appear">
      <div className="text-center mb-6">
        <h3 className="text-3xl font-bold text-white mb-2 drop-shadow-lg">🎰 GİRİŞ YAP</h3>
        <p className="text-blue-200">Casino deneyimine devam edin</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-bold text-white mb-2 drop-shadow">📧 E-posta</label>
          <input
            type="email"
            placeholder="ornek@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-4 border-3 border-blue-300 rounded-xl bg-white text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:ring-4 focus:ring-blue-200 focus:outline-none transition-all duration-200 shadow-lg text-lg font-medium"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-white mb-2 drop-shadow">🔒 Şifre</label>
          <input
            type="password"
            placeholder="Şifreniz"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-4 border-3 border-blue-300 rounded-xl bg-white text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:ring-4 focus:ring-blue-200 focus:outline-none transition-all duration-200 shadow-lg text-lg font-medium"
            required
          />
        </div>

        {message && (
          <div className="p-3 rounded-lg text-center font-medium bg-red-100 text-red-800 border border-red-300">
            {message}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-gradient-to-r from-green-500 to-green-600 text-white p-4 rounded-xl font-bold text-lg hover:from-green-600 hover:to-green-700 disabled:from-gray-500 disabled:to-gray-600 disabled:text-gray-300 disabled:cursor-not-allowed transition-all duration-200 shadow-xl hover:shadow-2xl transform hover:-translate-y-1 border-2 border-green-400"
          >
            {loading ? '⏳ Giriş yapılıyor...' : '✅ Giriş Yap'}
          </button>
          <button
            type="button"
            onClick={() => onSuccess?.() || onClose?.()}
            className="flex-1 bg-gradient-to-r from-gray-600 to-gray-700 text-white p-4 rounded-xl font-bold text-lg hover:from-gray-700 hover:to-gray-800 transition-all duration-200 shadow-xl hover:shadow-2xl transform hover:-translate-y-1 border-2 border-gray-500"
          >
            ❌ İptal
          </button>
        </div>
      </form>

      <div className="text-center mt-4">
        <button
          onClick={onSwitchToSignUp}
          className="text-blue-200 hover:text-white transition-colors duration-200 text-sm underline"
        >
          Hesabınız yok mu? Kayıt olun!
        </button>
      </div>
    </div>
  );
}
