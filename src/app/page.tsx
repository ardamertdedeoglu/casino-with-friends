'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { useVirtualCurrency } from '../lib/virtualCurrency';
import SignUpForm from '../components/SignUpForm';
import SignInForm from '../components/SignInForm';
import ChipDeposit from '../components/ChipDeposit';
import { useRouter } from 'next/navigation';

export default function Home() {
  const [roomId, setRoomId] = useState('');
  const [showRoomInput, setShowRoomInput] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showChipDeposit, setShowChipDeposit] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [gameType, setGameType] = useState<'blackjack' | 'bluff' | 'okey'>('blackjack');
  const router = useRouter();

  const { user, loading, signOut } = useAuth();
  const { userProfile, loading: currencyLoading } = useVirtualCurrency();

  const handleGameClick = (e: React.MouseEvent, type: 'blackjack' | 'bluff' | 'okey') => {
    e.preventDefault();

    // Kullanıcı giriş yapmamışsa uyarı göster
    if (!user) {
      setAuthMode('signin');
      setShowAuthModal(true);
      return;
    }

    if (type === 'bluff') {
      // Blöf için doğrudan /bluff adresine yönlendir
      router.push('/bluff');
    } else if (type === 'okey') {
      // Okey için doğrudan /okey adresine yönlendir
      router.push('/okey');
    } else {
      // Blackjack için oda seçimi göster
      setGameType(type);
      if (!showRoomInput) {
        setShowRoomInput(true);
      }
    }
  };

  const handleJoinRoom = () => {
    if (roomId.trim()) {
      const prefix = gameType === 'bluff' ? 'bluff_' : 'room_';
      const fullRoomId = roomId.trim().startsWith(prefix) ? roomId.trim() : `${prefix}${roomId.trim()}`;
      const path = gameType === 'bluff' ? '/bluff/' : '/blackjack/';
      router.push(`${path}${fullRoomId}`);
    }
  };

  const handleRandomRoom = () => {
    const prefix = gameType === 'bluff' ? 'bluff_' : 'room_';
    const randomId = `${prefix}${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const path = gameType === 'bluff' ? '/bluff/' : '/blackjack/';
    router.push(`${path}${randomId}`);
  };

  const handleSignOut = async () => {
    await signOut();
  };

  if (loading || currencyLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-900 via-green-800 to-green-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-yellow-400 mx-auto mb-4"></div>
          <h2 className="text-2xl font-bold text-white mb-2">🎰 Yükleniyor</h2>
          <p className="text-yellow-200">Casino deneyimine hazırlanıyoruz...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-900 via-green-800 to-green-900 flex items-center justify-center p-4">
      <div className="max-w-6xl w-full">
        {/* Auth Buttons - Top Right */}
        <div className="flex justify-end mb-8">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 text-black px-4 py-2 rounded-full font-bold text-sm shadow-lg">
                💎 {userProfile?.chips.toLocaleString() || 0} Chip
              </div>
              <button
                onClick={() => setShowChipDeposit(true)}
                className="bg-gradient-to-r from-green-600 to-green-700 text-white px-4 py-2 rounded-full font-bold text-sm hover:from-green-700 hover:to-green-800 shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300 cursor-pointer"
              >
                💰 Chip Yatır
              </button>
              <span className="text-yellow-200 font-semibold">
                Hoş geldiniz, {user.user_metadata?.username || user.email}
              </span>
              <button
                onClick={handleSignOut}
                className="bg-gradient-to-r from-red-600 to-red-700 text-white px-4 py-2 rounded-full font-bold text-sm hover:from-red-700 hover:to-red-800 shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300 cursor-pointer"
              >
                🚪 Çıkış
              </button>
            </div>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setAuthMode('signin');
                  setShowAuthModal(true);
                }}
                className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-2 rounded-full font-bold text-sm hover:from-blue-700 hover:to-blue-800 shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300"
              >
                🔑 Giriş Yap
              </button>
              <button
                onClick={() => {
                  setAuthMode('signup');
                  setShowAuthModal(true);
                }}
                className="bg-gradient-to-r from-green-600 to-green-700 text-white px-4 py-2 rounded-full font-bold text-sm hover:from-green-700 hover:to-green-800 shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300"
              >
                🎰 Kayıt Ol
              </button>
            </div>
          )}
        </div>

        {/* Header */}
        <div className="text-center mb-12">

          <h1 className="text-6xl font-bold text-yellow-400 mb-4 drop-shadow-2xl animate-pulse">
            🎰 CASINO WITH FRIENDS
          </h1>
          <p className="text-xl text-yellow-200 font-semibold">
            Arkadaşlarınla birlikte oynadığın casino deneyimi
          </p>
          <div className="w-32 h-1 bg-yellow-400 mx-auto mt-4 rounded-full"></div>
        </div>

        {/* Room Input Modal */}
        {showRoomInput && (
          <div 
            className="fixed inset-0 flex items-center justify-center z-50 p-4"
            style={{
              background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.6) 50%, rgba(0,0,0,0.9) 100%)'
            }}
          >
            <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
              <h3 className="text-2xl font-bold text-gray-800 mb-6 text-center">
                🎯 {gameType === 'bluff' ? 'Blöf' : gameType === 'okey' ? 'Okey' : 'Blackjack'} Oda Seçimi
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-800 mb-2">Oda ID</label>
                  <input
                    type="text"
                    placeholder="Örneğin: oyun123"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                    className="w-full p-4 border-3 border-gray-400 rounded-xl bg-white text-gray-900 placeholder:text-gray-500 focus:border-yellow-500 focus:ring-4 focus:ring-yellow-200 focus:outline-none transition-all duration-200 shadow-lg text-lg font-medium"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleJoinRoom}
                    disabled={!roomId.trim()}
                    className="flex-1 bg-gradient-to-r from-green-600 to-green-700 text-white p-4 rounded-xl font-bold text-lg hover:from-green-700 hover:to-green-800 disabled:from-gray-500 disabled:to-gray-600 disabled:text-gray-300 disabled:cursor-not-allowed transition-all duration-200 shadow-xl hover:shadow-2xl transform hover:-translate-y-1 cursor-pointer"
                  >
                    Odaya Katıl
                  </button>
                  <button
                    onClick={handleRandomRoom}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 rounded-xl font-bold text-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-xl hover:shadow-2xl transform hover:-translate-y-1 cursor-pointer"
                  >
                    Rastgele Oda
                  </button>
                </div>
                <button
                  onClick={() => setShowRoomInput(false)}
                  className="w-full bg-gray-500 text-white p-3 rounded-xl font-bold text-lg hover:bg-gray-600 transition-all duration-200 cursor-pointer"
                >
                  İptal
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Games Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
          {/* Blackjack */}
          <div onClick={(e) => handleGameClick(e, 'blackjack')} className="group cursor-pointer relative">
            {!user && (
              <div className="absolute inset-0 bg-black bg-opacity-50 rounded-3xl flex items-center justify-center z-10">
                <div className="text-center text-white">
                  <div className="text-4xl mb-2">🔒</div>
                  <p className="font-bold">Giriş Yapın</p>
                  <p className="text-sm">Oynamak için hesap gerekli</p>
                </div>
              </div>
            )}
            <div className="bg-gradient-to-br from-yellow-50 via-white to-yellow-100 p-8 rounded-3xl shadow-2xl border-4 border-yellow-400 hover:border-yellow-300 transform hover:-translate-y-4 transition-all duration-300 hover:shadow-3xl">
              <div className="text-center">
                <div className="text-8xl mb-4 group-hover:animate-bounce">🃏</div>
                <h2 className="text-3xl font-bold text-gray-800 mb-2">BLACKJACK</h2>
                <p className="text-gray-600 mb-4">21&apos;e ulaşmaya çalış!</p>
                <div className="bg-green-600 text-white px-6 py-3 rounded-full font-bold text-lg hover:bg-green-700 transition-colors">
                  {user ? 'OYNA' : '🔑 GİRİŞ YAP'}
                </div>
              </div>
            </div>
          </div>

          {/* Bluff */}
          <div onClick={(e) => handleGameClick(e, 'bluff')} className="group cursor-pointer relative">
            {!user && (
              <div className="absolute inset-0 bg-black bg-opacity-50 rounded-3xl flex items-center justify-center z-10">
                <div className="text-center text-white">
                  <div className="text-4xl mb-2">🔒</div>
                  <p className="font-bold">Giriş Yapın</p>
                  <p className="text-sm">Oynamak için hesap gerekli</p>
                </div>
              </div>
            )}
            <div className="bg-gradient-to-br from-purple-50 via-white to-purple-100 p-8 rounded-3xl shadow-2xl border-4 border-purple-400 hover:border-purple-300 transform hover:-translate-y-4 transition-all duration-300 hover:shadow-3xl">
              <div className="text-center">
                <div className="text-8xl mb-4 group-hover:animate-bounce">🎭</div>
                <h2 className="text-3xl font-bold text-gray-800 mb-2">BLÖF</h2>
                <p className="text-gray-600 mb-4">En iyi yalan söyleyen kazanır!</p>
                <div className="bg-purple-600 text-white px-6 py-3 rounded-full font-bold text-lg hover:bg-purple-700 transition-colors">
                  {user ? 'OYNA' : '🔑 GİRİŞ YAP'}
                </div>
              </div>
            </div>
          </div>

          {/* Okey */}
          <div onClick={(e) => handleGameClick(e, 'okey')} className="group cursor-pointer relative">
            {!user && (
              <div className="absolute inset-0 bg-black bg-opacity-50 rounded-3xl flex items-center justify-center z-10">
                <div className="text-center text-white">
                  <div className="text-4xl mb-2">🔒</div>
                  <p className="font-bold">Giriş Yapın</p>
                  <p className="text-sm">Oynamak için hesap gerekli</p>
                </div>
              </div>
            )}
            <div className="bg-gradient-to-br from-orange-50 via-white to-red-100 p-8 rounded-3xl shadow-2xl border-4 border-orange-400 hover:border-orange-300 transform hover:-translate-y-4 transition-all duration-300 hover:shadow-3xl">
              <div className="text-center">
                <div className="text-8xl mb-4 group-hover:animate-bounce">🎴</div>
                <h2 className="text-3xl font-bold text-gray-800 mb-2">101 OKEY</h2>
                <p className="text-gray-600 mb-4">Türk klasiği taş oyunu!</p>
                <div className="bg-orange-600 text-white px-6 py-3 rounded-full font-bold text-lg hover:bg-orange-700 transition-colors">
                  {user ? 'OYNA' : '🔑 GİRİŞ YAP'}
                </div>
              </div>
            </div>
          </div>

          {/* Slots - Coming Soon */}
          <div className="bg-gradient-to-br from-gray-100 via-gray-200 to-gray-300 p-8 rounded-3xl shadow-2xl border-4 border-gray-400 opacity-75">
            <div className="text-center">
              <div className="text-8xl mb-4 text-gray-500">🎰</div>
              <h2 className="text-3xl font-bold text-gray-600 mb-2">SLOTS</h2>
              <p className="text-gray-500 mb-4">Şansını dene!</p>
              <div className="bg-gray-500 text-white px-6 py-3 rounded-full font-bold text-lg">
                YAKINDA
              </div>
            </div>
          </div>

          {/* Baccarat - Coming Soon */}
          <div className="bg-gradient-to-br from-gray-100 via-gray-200 to-gray-300 p-8 rounded-3xl shadow-2xl border-4 border-gray-400 opacity-75">
            <div className="text-center">
              <div className="text-8xl mb-4 text-gray-500">🎴</div>
              <h2 className="text-3xl font-bold text-gray-600 mb-2">BACCARAT</h2>
              <p className="text-gray-500 mb-4">Banker mı Player mı?</p>
              <div className="bg-gray-500 text-white px-6 py-3 rounded-full font-bold text-lg">
                YAKINDA
              </div>
            </div>
          </div>

          {/* Craps - Coming Soon */}
          <div className="bg-gradient-to-br from-gray-100 via-gray-200 to-gray-300 p-8 rounded-3xl shadow-2xl border-4 border-gray-400 opacity-75">
            <div className="text-center">
              <div className="text-8xl mb-4 text-gray-500">🎲</div>
              <h2 className="text-3xl font-bold text-gray-600 mb-2">CRAPS</h2>
              <p className="text-gray-500 mb-4">Zarları at!</p>
              <div className="bg-gray-500 text-white px-6 py-3 rounded-full font-bold text-lg">
                YAKINDA
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center">
          <p className="text-yellow-200 text-lg">
            🎲 Çok yakında daha fazla oyun eklenecek! 🎲
          </p>
          <p className="text-yellow-300 text-sm mt-2">
            Arkadaşlarınla birlikte eğlenceli vakit geçirmek için hazır
          </p>
        </div>
      </div>

      {/* Auth Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 backdrop-blur-sm bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800">
                {authMode === 'signin' ? 'Giriş Yap' : 'Kayıt Ol'}
              </h2>
              <button
                onClick={() => setShowAuthModal(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            {authMode === 'signin' ? (
              <SignInForm
                onSuccess={() => setShowAuthModal(false)}
                onSwitchToSignUp={() => setAuthMode('signup')}
              />
            ) : (
              <SignUpForm
                onSuccess={() => setShowAuthModal(false)}
                onSwitchToSignIn={() => setAuthMode('signin')}
              />
            )}
          </div>
        </div>
      )}

      {/* Chip Deposit Modal */}
      {showChipDeposit && (
        <div className="fixed inset-0 backdrop-blur-sm bg-opacity-50 flex items-center justify-center z-50">
          <ChipDeposit onClose={() => setShowChipDeposit(false)} />
        </div>
      )}
    </div>
  );
}
