'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth';
import { useVirtualCurrency } from '../../lib/virtualCurrency';
import { v4 as uuidv4 } from 'uuid';

interface GameRoom {
  id: string;
  name: string;
  playerCount: number;
  maxPlayers: number;
  gameMode: 'folding' | 'nonfolding';
  playType: 'single' | 'paired';
  status: 'waiting' | 'playing' | 'finished';
  isPrivate: boolean;
}

export default function OkeyLobby() {
  const [rooms, setRooms] = useState<GameRoom[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [gameMode, setGameMode] = useState<'folding' | 'nonfolding'>('folding');
  const [playType, setPlayType] = useState<'single' | 'paired'>('single');
  const [isPrivate, setIsPrivate] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const { user, loading: authLoading } = useAuth();
  const { userProfile, loading: profileLoading } = useVirtualCurrency();
  const router = useRouter();

  useEffect(() => {
    // Only redirect if both auth and profile have finished loading and no user data exists
    if (!authLoading && !profileLoading && (!user || !userProfile)) {
      router.push('/');
      return;
    }
    // Load rooms only when we have user data
    if (user && userProfile && !authLoading && !profileLoading) {
      loadAvailableRooms();
    }
  }, [user, userProfile, authLoading, profileLoading, router]);

  const loadAvailableRooms = () => {
    // This will be replaced with real API call
    const mockRooms: GameRoom[] = [
      {
        id: '1',
        name: 'Hızlı Okey Masası',
        playerCount: 2,
        maxPlayers: 4,
        gameMode: 'folding',
        playType: 'single',
        status: 'waiting',
        isPrivate: false,
      },
      {
        id: '2',
        name: 'Eşli Turnuva',
        playerCount: 1,
        maxPlayers: 4,
        gameMode: 'nonfolding',
        playType: 'paired',
        status: 'waiting',
        isPrivate: false,
      },
    ];
    setRooms(mockRooms);
  };

  const createRoom = async () => {
    if (!roomName.trim()) return;
    
    setLoading(true);
    try {
      const roomId = uuidv4();
      const newRoom: GameRoom = {
        id: roomId,
        name: roomName,
        playerCount: 1,
        maxPlayers: playType === 'paired' ? 4 : 4,
        gameMode,
        playType,
        status: 'waiting',
        isPrivate,
      };

      // TODO: Send room creation to server
      console.log('Creating room:', newRoom);
      
      // Navigate to the game room
      router.push(`/okey/${roomId}`);
    } catch (error) {
      console.error('Failed to create room:', error);
    } finally {
      setLoading(false);
      setShowCreateModal(false);
    }
  };

  const joinRoom = (roomId: string) => {
    router.push(`/okey/${roomId}`);
  };

  const joinWithCode = async () => {
    if (!joinCode.trim()) return;
    
    setLoading(true);
    try {
      // TODO: Validate join code with server
      router.push(`/okey/${joinCode}`);
    } catch (error) {
      console.error('Failed to join room:', error);
    } finally {
      setLoading(false);
      setShowJoinModal(false);
    }
  };

  // Show loading screen while auth or profile is loading
  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-900 via-red-800 to-black flex items-center justify-center">
        <div className="text-center text-white">
          <div className="animate-spin text-4xl mb-4">🎴</div>
          <p>Yükleniyor...</p>
        </div>
      </div>
    );
  }

  // Show loading screen if user or userProfile is not available after loading is complete
  if (!user || !userProfile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-900 via-red-800 to-black flex items-center justify-center">
        <div className="text-center text-white">
          <div className="animate-spin text-4xl mb-4">🎴</div>
          <p>Kimlik doğrulanıyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-900 via-red-800 to-black">
      {/* Background texture */}
      <div className="absolute inset-0 bg-[url('/okey-background.jpg')] bg-cover bg-center opacity-10"></div>
      <div className="absolute inset-0 bg-gradient-to-br from-orange-900/80 via-red-800/60 to-black/80"></div>

      <div className="relative z-10 min-h-screen">
        {/* Header */}
        <header className="bg-black bg-opacity-50 p-4 border-b border-yellow-500">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/')}
                className="bg-gradient-to-r from-gray-600 to-gray-700 text-white px-4 py-2 rounded-lg hover:from-gray-700 hover:to-gray-800 transition-all duration-300"
              >
                ← Ana Sayfa
              </button>
              <div className="text-yellow-400 font-bold text-2xl">
                🎴 101 Okey
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-white">
                Merhaba, <span className="text-yellow-400 font-bold">{user.user_metadata?.username}</span>
              </div>
              <div className="text-white">
                💎 <span className="text-yellow-400 font-bold">{userProfile.chips.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto p-6">
          {/* Action Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-gradient-to-r from-green-600 to-green-700 text-white p-6 rounded-xl font-bold text-lg hover:from-green-700 hover:to-green-800 transition-all duration-300 shadow-lg transform hover:scale-105"
            >
              <div className="text-3xl mb-2">🏗️</div>
              <div>Yeni Masa Oluştur</div>
              <div className="text-sm mt-1 text-green-200">Arkadaşlarını davet et</div>
            </button>

            <button
              onClick={() => setShowJoinModal(true)}
              className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-xl font-bold text-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-300 shadow-lg transform hover:scale-105"
            >
              <div className="text-3xl mb-2">🔗</div>
              <div>Kodla Katıl</div>
              <div className="text-sm mt-1 text-blue-200">Oda kodunu gir</div>
            </button>

            <button
              onClick={loadAvailableRooms}
              className="bg-gradient-to-r from-purple-600 to-purple-700 text-white p-6 rounded-xl font-bold text-lg hover:from-purple-700 hover:to-purple-800 transition-all duration-300 shadow-lg transform hover:scale-105"
            >
              <div className="text-3xl mb-2">🎯</div>
              <div>Hızlı Eşleşme</div>
              <div className="text-sm mt-1 text-purple-200">Rastgele oyuncu bul</div>
            </button>
          </div>

          {/* Available Rooms */}
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-6 rounded-xl shadow-2xl border-2 border-gray-600">
            <h2 className="text-yellow-400 font-bold text-xl mb-4 text-center">🎴 Açık Masalar</h2>
            
            {rooms.length === 0 ? (
              <div className="text-center text-gray-400 py-8">
                <div className="text-4xl mb-4">😴</div>
                <p>Şu anda açık masa yok</p>
                <p className="text-sm mt-2">Yeni bir masa oluştur veya birazdan tekrar dene!</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {rooms.map((room) => (
                  <div
                    key={room.id}
                    className="bg-gradient-to-r from-gray-700 to-gray-600 p-4 rounded-lg border-2 border-gray-500 hover:border-yellow-500 transition-all duration-300"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="text-white font-bold text-lg">{room.name}</h3>
                        <div className="flex items-center space-x-4 text-sm text-gray-300 mt-1">
                          <span>👥 {room.playerCount}/{room.maxPlayers}</span>
                          <span className={`px-2 py-1 rounded ${
                            room.gameMode === 'folding' ? 'bg-orange-600' : 'bg-blue-600'
                          }`}>
                            {room.gameMode === 'folding' ? '📈 Katlamalı' : '📊 Katlamasız'}
                          </span>
                          <span className={`px-2 py-1 rounded ${
                            room.playType === 'single' ? 'bg-green-600' : 'bg-purple-600'
                          }`}>
                            {room.playType === 'single' ? '👤 Tekli' : '👥 Eşli'}
                          </span>
                          <span className={`px-2 py-1 rounded ${
                            room.status === 'waiting' ? 'bg-yellow-600' : 'bg-red-600'
                          }`}>
                            {room.status === 'waiting' ? '⏳ Bekliyor' : '🎮 Oyunda'}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => joinRoom(room.id)}
                        disabled={room.status !== 'waiting' || room.playerCount >= room.maxPlayers}
                        className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 rounded-lg font-bold hover:from-blue-700 hover:to-blue-800 transition-all duration-300 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed"
                      >
                        {room.status !== 'waiting' ? '🎮 Oyunda' : 
                         room.playerCount >= room.maxPlayers ? '👥 Dolu' : '🚀 Katıl'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Create Room Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 backdrop-blur-sm bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-6 rounded-xl shadow-2xl border-2 border-yellow-500 max-w-md w-full mx-4">
            <h3 className="text-yellow-400 font-bold text-xl mb-4 text-center">🏗️ Yeni Masa Oluştur</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-gray-300 text-sm font-bold mb-2">Masa Adı</label>
                <input
                  type="text"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="Masa adını girin..."
                  className="w-full p-3 rounded-lg bg-gray-700 text-white border-2 border-gray-600 focus:border-yellow-500 focus:outline-none"
                  maxLength={30}
                />
              </div>

              <div>
                <label className="block text-gray-300 text-sm font-bold mb-2">Oyun Modu</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setGameMode('folding')}
                    className={`p-3 rounded-lg font-bold transition-all ${
                      gameMode === 'folding'
                        ? 'bg-orange-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    📈 Katlamalı
                  </button>
                  <button
                    onClick={() => setGameMode('nonfolding')}
                    className={`p-3 rounded-lg font-bold transition-all ${
                      gameMode === 'nonfolding'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    📊 Katlamasız
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-gray-300 text-sm font-bold mb-2">Oyun Tipi</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setPlayType('single')}
                    className={`p-3 rounded-lg font-bold transition-all ${
                      playType === 'single'
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    👤 Tekli
                  </button>
                  <button
                    onClick={() => setPlayType('paired')}
                    className={`p-3 rounded-lg font-bold transition-all ${
                      playType === 'paired'
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    👥 Eşli
                  </button>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="private"
                  checked={isPrivate}
                  onChange={(e) => setIsPrivate(e.target.checked)}
                  className="w-4 h-4"
                />
                <label htmlFor="private" className="text-gray-300 text-sm">
                  🔒 Özel masa (sadece kodla giriş)
                </label>
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 bg-gradient-to-r from-gray-600 to-gray-700 text-white py-3 rounded-lg font-bold hover:from-gray-700 hover:to-gray-800 transition-all duration-300"
              >
                ❌ İptal
              </button>
              <button
                onClick={createRoom}
                disabled={!roomName.trim() || loading}
                className="flex-1 bg-gradient-to-r from-green-600 to-green-700 text-white py-3 rounded-lg font-bold hover:from-green-700 hover:to-green-800 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed transition-all duration-300"
              >
                {loading ? '⏳ Oluşturuluyor...' : '🚀 Oluştur'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Join with Code Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 backdrop-blur-sm bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-6 rounded-xl shadow-2xl border-2 border-blue-500 max-w-md w-full mx-4">
            <h3 className="text-blue-400 font-bold text-xl mb-4 text-center">🔗 Kodla Katıl</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-gray-300 text-sm font-bold mb-2">Oda Kodu</label>
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  placeholder="Oda kodunu buraya yapıştırın..."
                  className="w-full p-3 rounded-lg bg-gray-700 text-white border-2 border-gray-600 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => setShowJoinModal(false)}
                className="flex-1 bg-gradient-to-r from-gray-600 to-gray-700 text-white py-3 rounded-lg font-bold hover:from-gray-700 hover:to-gray-800 transition-all duration-300"
              >
                ❌ İptal
              </button>
              <button
                onClick={joinWithCode}
                disabled={!joinCode.trim() || loading}
                className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 rounded-lg font-bold hover:from-blue-700 hover:to-blue-800 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed transition-all duration-300"
              >
                {loading ? '⏳ Katılıyor...' : '🚀 Katıl'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}