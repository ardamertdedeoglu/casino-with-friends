'use client';

import { useState } from 'react';
import { useAuth } from '../lib/auth';

interface SignUpFormProps {
  onSuccess?: () => void;
  onClose?: () => void;
  onSwitchToSignIn?: () => void;
}

export default function SignUpForm({ onSuccess, onClose, onSwitchToSignIn }: SignUpFormProps) {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const { signUp } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    // Validation
    if (!email || !username || !password || !confirmPassword) {
      setMessage('Lütfen tüm alanları doldurun.');
      setLoading(false);
      return;
    }

    if (password.length < 8) {
      setMessage('Şifre en az 8 karakter olmalıdır.');
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setMessage('Şifreler eşleşmiyor.');
      setLoading(false);
      return;
    }

    if (username.length < 3) {
      setMessage('Kullanıcı adı en az 3 karakter olmalıdır.');
      setLoading(false);
      return;
    }

    try {
      const { error } = await signUp(email, password, username);

      if (error) {
        if (error.message.includes('already registered')) {
          setMessage('Bu e-posta adresi zaten kayıtlı.');
        } else {
          setMessage(error.message);
        }
      } else {
        setIsSuccess(true);
        setMessage('Kayıt başarılı! Lütfen e-posta adresinizi kontrol edin ve hesabınızı doğrulayın.');
      }
    } catch (error) {
      setMessage('Bir hata oluştu. Lütfen tekrar deneyin.');
    }

    setLoading(false);
  };

  if (isSuccess) {
    return (
      <div className="bg-gradient-to-br from-green-600 via-green-700 to-green-800 bg-opacity-95 backdrop-blur-sm rounded-2xl p-8 max-w-md w-full shadow-2xl border-4 border-green-400 pointer-events-auto animate-modal-appear">
        <div className="text-center">
          <div className="text-6xl mb-4">✅</div>
          <h3 className="text-2xl font-bold text-white mb-4">Kayıt Başarılı!</h3>
          <p className="text-green-200 mb-6">
            E-posta adresinize doğrulama bağlantısı gönderildi.
            Lütfen e-postanızı kontrol edin ve hesabınızı aktifleştirin.
          </p>
          <button
            onClick={() => onSuccess?.() || onClose?.()}
            className="bg-gradient-to-r from-green-500 to-green-600 text-white px-6 py-3 rounded-xl font-bold hover:from-green-600 hover:to-green-700 transition-all duration-200"
          >
            Tamam
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-purple-600 via-purple-700 to-purple-800 bg-opacity-95 backdrop-blur-sm rounded-2xl p-8 max-w-md w-full shadow-2xl border-4 border-purple-400 pointer-events-auto animate-modal-appear">
      <div className="text-center mb-6">
        <h3 className="text-3xl font-bold text-white mb-2 drop-shadow-lg">🎰 KAYIT OL</h3>
        <p className="text-purple-200">Casino deneyimine katılın</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-bold text-white mb-2 drop-shadow">📧 E-posta</label>
          <input
            type="email"
            placeholder="ornek@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-4 border-3 border-purple-300 rounded-xl bg-white text-gray-900 placeholder:text-gray-500 focus:border-purple-500 focus:ring-4 focus:ring-purple-200 focus:outline-none transition-all duration-200 shadow-lg text-lg font-medium"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-white mb-2 drop-shadow">👤 Kullanıcı Adı</label>
          <input
            type="text"
            placeholder="Kullanıcı adınız"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full p-4 border-3 border-purple-300 rounded-xl bg-white text-gray-900 placeholder:text-gray-500 focus:border-purple-500 focus:ring-4 focus:ring-purple-200 focus:outline-none transition-all duration-200 shadow-lg text-lg font-medium"
            minLength={3}
            required
          />
          <p className="text-xs text-purple-200 mt-1">En az 3 karakter</p>
        </div>

        <div>
          <label className="block text-sm font-bold text-white mb-2 drop-shadow">🔒 Şifre</label>
          <input
            type="password"
            placeholder="Şifreniz"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-4 border-3 border-purple-300 rounded-xl bg-white text-gray-900 placeholder:text-gray-500 focus:border-purple-500 focus:ring-4 focus:ring-purple-200 focus:outline-none transition-all duration-200 shadow-lg text-lg font-medium"
            minLength={8}
            required
          />
          <p className="text-xs text-purple-200 mt-1">En az 8 karakter</p>
        </div>

        <div>
          <label className="block text-sm font-bold text-white mb-2 drop-shadow">🔒 Şifre Tekrar</label>
          <input
            type="password"
            placeholder="Şifrenizi tekrar girin"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full p-4 border-3 border-purple-300 rounded-xl bg-white text-gray-900 placeholder:text-gray-500 focus:border-purple-500 focus:ring-4 focus:ring-purple-200 focus:outline-none transition-all duration-200 shadow-lg text-lg font-medium"
            required
          />
        </div>

        {message && (
          <div className={`p-3 rounded-lg text-center font-medium ${
            message.includes('başarılı') || message.includes('gönderildi')
              ? 'bg-green-100 text-green-800 border border-green-300'
              : 'bg-red-100 text-red-800 border border-red-300'
          }`}>
            {message}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-gradient-to-r from-green-500 to-green-600 text-white p-4 rounded-xl font-bold text-lg hover:from-green-600 hover:to-green-700 disabled:from-gray-500 disabled:to-gray-600 disabled:text-gray-300 disabled:cursor-not-allowed transition-all duration-200 shadow-xl hover:shadow-2xl transform hover:-translate-y-1 border-2 border-green-400"
          >
            {loading ? '⏳ Kaydediliyor...' : '✅ Kayıt Ol'}
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
          onClick={onSwitchToSignIn}
          className="text-purple-200 hover:text-white transition-colors duration-200 text-sm underline"
        >
          Zaten hesabınız var mı? Giriş yapın
        </button>
      </div>
    </div>
  );
}
