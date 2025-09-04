'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';

export default function BluffPage() {
  const [roomId, setRoomId] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const { user } = useAuth();
  const router = useRouter();

  const createRoom = async () => {
    if (!user) {
      setError('Lütfen önce giriş yapın');
      return;
    }

    setIsCreating(true);
    setError('');

    try {
      // Rastgele oda ID'si oluştur
      const randomRoomId = `bluff_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Yeni oda oluştur
      const { data: room, error: roomError } = await supabase
        .from('bluff_games')
        .insert({
          id: randomRoomId,
          game_type: 'bluff',
          house_chips: 10000,
          status: 'waiting',
          max_players: 6
        })
        .select()
        .single();

      if (roomError) throw roomError;

      // Kullanıcıyı odaya yönlendir
      router.push(`/bluff/${randomRoomId}`);
    } catch (error) {
      console.error('Oda oluşturma hatası:', error);
      setError('Oda oluşturulamadı. Lütfen tekrar deneyin.');
    } finally {
      setIsCreating(false);
    }
  };

  const joinRoom = () => {
    if (!roomId.trim()) {
      setError('Lütfen oda ID\'sini girin');
      return;
    }

    // Kullanıcı tarafından girilen ID'lere prefix ekle (çakışmayı önlemek için)
    const fullRoomId = roomId.trim().startsWith('bluff_') ? roomId.trim() : `bluff_${roomId.trim()}`;
    router.push(`/bluff/${fullRoomId}`);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-900 via-green-800 to-black flex items-center justify-center p-4">
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-8 rounded-3xl shadow-2xl border-2 border-yellow-500 max-w-md w-full text-center">
          <div className="text-6xl mb-4">🎲</div>
          <h1 className="text-3xl font-bold text-yellow-400 mb-4">Blöf Oyunu</h1>
          <p className="text-gray-300 mb-6">Blöf oynamak için lütfen giriş yapın.</p>
          <button
            onClick={() => router.push('/auth')}
            className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 rounded-xl font-bold hover:from-blue-700 hover:to-blue-800 transition-all duration-300"
          >
            Giriş Yap
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 via-green-800 to-black flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-8 rounded-3xl shadow-2xl border-2 border-yellow-500 max-w-md w-full">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🎲</div>
          <h1 className="text-3xl font-bold text-yellow-400 mb-2">Blöf Oyunu</h1>
          <p className="text-gray-300">Strateji ve blöf ustalağı ile kazan!</p>
        </div>

        {error && (
          <div className="bg-red-600 text-white p-3 rounded-xl mb-6 text-center">
            {error}
          </div>
        )}

        {/* Yeni Oda Oluştur */}
        <div className="mb-6">
          <button
            onClick={createRoom}
            disabled={isCreating}
            className="w-full bg-gradient-to-r from-green-600 to-green-700 text-white py-4 px-6 rounded-xl font-bold text-lg hover:from-green-700 hover:to-green-800 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
          >
            {isCreating ? '⏳ Oda Oluşturuluyor...' : '🆕 Yeni Oda Oluştur'}
          </button>
        </div>

        {/* Oda ID ile Katıl */}
        <div className="mb-6">
          <div className="text-center mb-4">
            <span className="text-gray-400">veya</span>
          </div>
          <input
            type="text"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            placeholder="Oda ID'sini girin"
            className="w-full p-4 rounded-xl bg-gray-700 text-white placeholder-gray-400 border-2 border-gray-600 focus:border-yellow-500 focus:outline-none mb-4"
          />
          <button
            onClick={joinRoom}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-4 px-6 rounded-xl font-bold text-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
          >
            🚪 Odaya Katıl
          </button>
        </div>

        {/* Oyun Kuralları */}
        <div className="bg-black bg-opacity-30 p-4 rounded-xl">
          <h3 className="text-yellow-400 font-bold mb-2">🎯 Oyun Kuralları</h3>
          <ul className="text-sm text-gray-300 space-y-1">
            <li>• Her oyuncu 5 zar alır</li>
            <li>• Sırayla bahis yapın</li>
            <li>• Blöf yapın veya gerçek bahis yapın</li>
            <li>• İtiraz edin ve kazanmaya çalışın</li>
            <li>• Kaybeden chip kaybeder</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
