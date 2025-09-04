'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '../../../lib/auth';
import Link from 'next/link';

export default function AuthCallback() {
  const { user, loading } = useAuth();
  const [message, setMessage] = useState('E-posta adresiniz doğrulanıyor...');

  useEffect(() => {
    if (!loading) {
      if (user?.email_confirmed_at) {
        setMessage('✅ E-posta adresiniz başarıyla doğrulandı! Yönlendiriliyorsunuz...');
        // Redirect after showing success message
        setTimeout(() => {
          window.location.href = '/';
        }, 2000);
      } else if (user) {
        setMessage('⚠️ E-posta adresiniz henüz doğrulanmamış. Lütfen e-postanızı kontrol edin.');
      } else {
        setMessage('❌ Doğrulama başarısız oldu. Lütfen tekrar deneyin.');
      }
    }
  }, [user, loading]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-900 via-green-800 to-green-900 flex items-center justify-center p-4">
        <div className="bg-gradient-to-br from-yellow-50 via-white to-yellow-100 p-8 rounded-2xl shadow-2xl border-4 border-yellow-400 max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-yellow-400 mx-auto mb-4"></div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">⏳ Doğrulanıyor</h2>
          <p className="text-gray-700">{message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-900 via-green-800 to-green-900 flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-yellow-50 via-white to-yellow-100 p-8 rounded-2xl shadow-2xl border-4 border-yellow-400 max-w-md w-full text-center">
        <div className="text-6xl mb-4">
          {user?.email_confirmed_at ? '✅' : user ? '⚠️' : '❌'}
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          {user?.email_confirmed_at ? 'Doğrulama Başarılı!' : user ? 'Doğrulama Gerekli' : 'Doğrulama Başarısız'}
        </h2>
        <p className="text-gray-700 mb-6">{message}</p>

        <div className="space-y-3">
          <Link
            href="/"
            className="block bg-gradient-to-r from-green-600 to-green-700 text-white px-6 py-3 rounded-xl font-bold hover:from-green-700 hover:to-green-800 transition-all duration-200 shadow-lg"
          >
            🏠 Ana Sayfaya Dön
          </Link>

          {!user?.email_confirmed_at && (
            <button
              onClick={() => window.location.reload()}
              className="block w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 rounded-xl font-bold hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-lg"
            >
              🔄 Tekrar Dene
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
