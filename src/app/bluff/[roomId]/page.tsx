'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '../../../lib/auth';
import { supabase } from '../../../lib/supabase';
import BluffGame from '../../../components/BluffGame';

interface GameRoom {
  id: string;
  game_type: string;
  house_chips: number;
  status: string;
  max_players: number;
  current_round: number;
}

export default function BluffRoomPage() {
  const params = useParams();
  const roomId = params.roomId as string;
  const [gameRoom, setGameRoom] = useState<GameRoom | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.push('/auth');
      return;
    }

    loadGameRoom();
  }, [user, roomId]);

  const loadGameRoom = async () => {
    try {
      const { data: room, error } = await supabase
        .from('bluff_games')
        .select('*')
        .eq('id', roomId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          setError('Oda bulunamadı');
        } else {
          throw error;
        }
      } else {
        setGameRoom(room);
      }
    } catch (error) {
      console.error('Oda yükleme hatası:', error);
      setError('Oda yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-900 via-green-800 to-black flex items-center justify-center">
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-8 rounded-3xl shadow-2xl border-2 border-yellow-500">
          <div className="text-center">
            <div className="animate-spin text-4xl mb-4">🎲</div>
            <p className="text-yellow-400 font-bold">Oda yükleniyor...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !gameRoom) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-900 via-green-800 to-black flex items-center justify-center p-4">
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-8 rounded-3xl shadow-2xl border-2 border-red-500 max-w-md w-full text-center">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-red-400 mb-4">Hata</h1>
          <p className="text-gray-300 mb-6">{error || 'Oda bulunamadı'}</p>
          <button
            onClick={() => router.push('/bluff')}
            className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 rounded-xl font-bold hover:from-blue-700 hover:to-blue-800 transition-all duration-300"
          >
            Ana Sayfaya Dön
          </button>
        </div>
      </div>
    );
  }

  return <BluffGame roomId={roomId} gameRoom={gameRoom} />;
}
