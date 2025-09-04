'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth';
import { useVirtualCurrency } from '../lib/virtualCurrency';
import { useBluffGame } from '../lib/useBluffGame';
import BetPlacement from './BetPlacement';
import ChatComponent from './ChatComponent';
import SoundVolumeControl from './SoundVolumeControl';
import Scoreboard from './Scoreboard';

interface GameRoom {
  id: string;
  game_type: string;
  house_chips?: number;
  status: string;
  max_players: number;
  current_round: number;
}

interface BluffGameProps {
  roomId: string;
  gameRoom: GameRoom;
}

interface Player {
  id: string;
  name: string;
  chips: number;
  dice: number[];
  isActive: boolean;
  position: number;
  isConnected: boolean;
}

interface Bet {
  id: string;
  playerId: string;
  playerName: string;
  quantity: number;
  value: number;
  isBluff: boolean;
}

interface BluffGameData {
  gameRoom: GameRoom;
  players: { id: string; name: string; chips: number; dice: number[]; isActive: boolean; isConnected: boolean; }[];
  currentPlayer: string;
  currentBet: Bet | null;
  phase: 'waiting' | 'betting' | 'playing' | 'finished';
  roundNumber: number;
  myDice?: number[];
}

interface PlayerJoinedData {
  name: string;
}

interface ChallengeResultData {
  message: string;
}

interface RoundEndData {
  winner: string;
  loser: string;
}

interface ChallengeResultData {
  message: string;
}

interface RoundEndData {
  winner: string;
  loser: string;
}

export default function BluffGame({ roomId, gameRoom: initialGameRoom }: BluffGameProps) {
  const [gameRoom, setGameRoom] = useState(initialGameRoom);
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<string>('');
  const [currentBet, setCurrentBet] = useState<Bet | null>(null);
  const [gamePhase, setGamePhase] = useState<'waiting' | 'betting' | 'playing' | 'finished'>('waiting');
  const [showBetPlacement, setShowBetPlacement] = useState(false);
  const [myDice, setMyDice] = useState<number[]>([]);
  const [roundNumber, setRoundNumber] = useState(1);
  const [message, setMessage] = useState('');

  const { user } = useAuth();
  const { userProfile } = useVirtualCurrency();
  const router = useRouter();

  // Socket bağlantısı için hook
  const {
    socketId,
    sendBluffAction,
    sendChallenge,
    onGameUpdate,
    onPlayerJoined,
    onPlayerLeft,
    onBetPlaced,
    onChallengeResult,
    onRoundEnd
  } = useBluffGame(roomId, user?.user_metadata?.username || 'Oyuncu');

  // Oyuncuları güncelle
  const updatePlayers = useCallback((playerList: { id: string; name: string; chips: number; dice: number[]; isActive: boolean; isConnected: boolean; }[]) => {
    console.log('🎲 Updating players:', playerList.length, 'players, socketId:', socketId);
    const updatedPlayers = playerList.map((p, index) => ({
      id: p.id,
      name: p.name,
      chips: p.chips,
      dice: socketId && p.id === socketId ? myDice : [], // Sadece kendi zarlarını göster
      isActive: p.id === currentPlayer,
      position: index,
      isConnected: p.isConnected
    }));
    console.log('🎲 Setting players state:', updatedPlayers.length, 'players');
    setPlayers(updatedPlayers);
  }, [socketId, myDice, currentPlayer]);

  // Players state değişikliklerini izle
  useEffect(() => {
    console.log('🎲 Players state changed:', players.length, 'players');
    console.log('🎲 Current players:', players);
  }, [players]);

  // Oyun güncellemelerini dinle
  useEffect(() => {
    console.log('🎲 Setting up game callbacks, socketId:', socketId);
    onGameUpdate((data: BluffGameData) => {
      console.log('🎲 Game update received:', data);
      console.log('🎲 Players in data:', data.players?.length || 0);
      setGameRoom(data.gameRoom);
      setCurrentPlayer(data.currentPlayer);
      setCurrentBet(data.currentBet);
      setGamePhase(data.phase);
      setRoundNumber(data.roundNumber);
      updatePlayers(data.players);
      if (data.myDice) setMyDice(data.myDice);
    });

    onPlayerJoined((player: PlayerJoinedData) => {
      setMessage(`${player.name} odaya katıldı`);
      setTimeout(() => setMessage(''), 3000);
    });

    onBetPlaced((bet: { playerName: string; quantity: number; value: number; isBluff: boolean }) => {
      setCurrentBet(bet as Bet);
      setMessage(`${bet.playerName}: ${bet.quantity} tane ${bet.value}${bet.isBluff ? ' (Blöf!)' : ''}`);
    });

    onChallengeResult((result: ChallengeResultData) => {
      setMessage(result.message);
      setTimeout(() => setMessage(''), 5000);
    });

    onRoundEnd((result: RoundEndData) => {
      setMessage(`Tur bitti! ${result.winner} kazandı, ${result.loser} kaybetti`);
      setTimeout(() => setMessage(''), 5000);
    });
  }, [onGameUpdate, onPlayerJoined, onPlayerLeft, onBetPlaced, onChallengeResult, onRoundEnd, updatePlayers, socketId]);

  // Bahis yerleştirme
  const handleBetPlaced = () => {
    setShowBetPlacement(false);
    setGamePhase('playing');
    // İlk bahis için gerekli işlemler
  };

  // Oda ID'sini kopyalama fonksiyonu
  const copyRoomId = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      setMessage('Oda ID kopyalandı! 📋');
      setTimeout(() => {
        setMessage('');
      }, 3000);
    } catch {
      setMessage('Kopyalama başarısız oldu');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  // Oyuncu pozisyonları için
  const getPlayerPosition = (index: number, totalPlayers: number) => {
    const angle = (index / totalPlayers) * 2 * Math.PI - Math.PI / 2;
    const radius = 200;
    const centerX = 400;
    const centerY = 300;

    return {
      left: centerX + Math.cos(angle) * radius,
      top: centerY + Math.sin(angle) * radius,
      transform: 'translate(-50%, -50%)'
    };
  };

  // Skor tablosu için
  const scoreboardEntries = players.map(p => ({
    id: p.id,
    name: p.name,
    netWinnings: 0, // Hesaplanacak
    isDealer: p.id === currentPlayer
  }));

  if (!user || !userProfile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-900 via-green-800 to-black flex items-center justify-center">
        <div className="text-center text-white">
          <div className="animate-spin text-4xl mb-4">🎲</div>
          <p>Yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 via-green-800 to-black relative overflow-hidden">
      {/* Arka plan efekti */}
      <div className="absolute inset-0 bg-[url('/casino-table.jpg')] bg-cover bg-center opacity-10"></div>
      <div className="absolute inset-0 bg-gradient-to-br from-green-900/80 via-green-800/60 to-black/80"></div>

      {/* Ana oyun alanı */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Üst bar */}
        <div className="bg-black bg-opacity-50 p-4 border-b border-yellow-500">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/bluff')}
                className="bg-gradient-to-r from-gray-600 to-gray-700 text-white px-4 py-2 rounded-lg hover:from-gray-700 hover:to-gray-800 transition-all duration-300"
              >
                ← Ana Sayfa
              </button>
              <div className="flex items-center space-x-3">
                <div className="text-yellow-400 font-bold">
                  🎲 Blöf Oyunu - Oda: {roomId.slice(0, 8)}...
                </div>
                <button
                  onClick={copyRoomId}
                  className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-3 py-1 rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-300 text-sm font-bold flex items-center space-x-1"
                  title="Oda ID'sini kopyala"
                >
                  <span>📋</span>
                  <span>Kopyala</span>
                </button>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-white">
                Tur: <span className="text-yellow-400 font-bold">{roundNumber}</span>
              </div>
              <div className="text-white">
                💎 <span className="text-yellow-400 font-bold">{userProfile.chips.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Oyun mesajı */}
        {message && (
          <div className="bg-blue-600 text-white p-3 text-center font-bold animate-pulse">
            {message}
          </div>
        )}

        {/* Ana oyun içeriği */}
        <div className="flex-1 flex">
          {/* Sol panel - Skor tablosu */}
          <div className="w-80 p-4">
            <Scoreboard scoreboard={scoreboardEntries} />
            <div className="mt-4">
              <SoundVolumeControl />
            </div>
          </div>

          {/* Orta alan - Masa */}
          <div className="flex-1 relative">
            {/* Masa */}
            <div className="absolute inset-4 bg-gradient-to-br from-green-800 to-green-900 rounded-full shadow-2xl border-8 border-yellow-600">
              {/* Masanın merkezi */}
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
                {currentBet && (
                  <div className="bg-black bg-opacity-70 p-4 rounded-xl border-2 border-yellow-500">
                    <div className="text-yellow-400 font-bold text-lg mb-2">Mevcut Bahis</div>
                    <div className="text-white text-xl">
                      {currentBet.quantity} × 🎲 {currentBet.value}
                    </div>
                    <div className="text-gray-300 text-sm">
                      {currentBet.playerName}
                      {currentBet.isBluff && <span className="text-red-400 ml-2">🤥</span>}
                    </div>
                  </div>
                )}

                {gamePhase === 'betting' && (
                  <div className="mt-4">
                    <button
                      onClick={() => setShowBetPlacement(true)}
                      className="bg-gradient-to-r from-green-600 to-green-700 text-white px-6 py-3 rounded-xl font-bold hover:from-green-700 hover:to-green-800 transition-all duration-300"
                    >
                      💰 Bahis Yap
                    </button>
                  </div>
                )}
              </div>

              {/* Oyuncular */}
              {players.map((player, index) => {
                const position = getPlayerPosition(index, players.length);
                return (
                  <div
                    key={player.id}
                    className={`absolute p-3 rounded-xl border-2 transition-all duration-300 ${
                      player.isActive
                        ? 'bg-yellow-600 border-yellow-400 shadow-lg scale-110'
                        : 'bg-gray-700 border-gray-500'
                    }`}
                    style={position}
                  >
                    <div className="text-center">
                      <div className={`font-bold ${player.isActive ? 'text-black' : 'text-white'}`}>
                        {player.name}
                      </div>
                      <div className="text-sm text-yellow-400">
                        💎 {player.chips.toLocaleString()}
                      </div>

                      {/* Zarlar (sadece kendi zarları görünür) */}
                      {player.id === socketId && player.dice.length > 0 && (
                        <div className="flex justify-center space-x-1 mt-2">
                          {player.dice.map((die, i) => (
                            <div
                              key={i}
                              className="w-6 h-6 bg-white rounded border-2 border-gray-800 flex items-center justify-center text-xs font-bold text-black"
                            >
                              {die}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Diğer oyuncular için zar sayısı */}
                      {player.id !== socketId && (
                        <div className="flex justify-center space-x-1 mt-2">
                          {Array.from({ length: 5 }, (_, i) => (
                            <div
                              key={i}
                              className="w-6 h-6 bg-gray-600 rounded border-2 border-gray-500 flex items-center justify-center"
                            >
                              <span className="text-xs">🎲</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sağ panel - Kontroller */}
          <div className="w-80 p-4">
            <ChatComponent roomId={roomId} playerName={user.user_metadata?.username || 'Oyuncu'} />

            {/* Oyun kontrolleri */}
            <div className="mt-4 bg-gradient-to-br from-gray-800 to-gray-900 p-4 rounded-xl shadow-2xl border-2 border-gray-600">
              <h3 className="text-yellow-400 font-bold mb-3 text-center">🎮 Kontroller</h3>

              {gamePhase === 'playing' && currentPlayer === socketId && (
                <div className="space-y-3">
                  <button
                    onClick={() => sendBluffAction('raise', { quantity: (currentBet?.quantity || 0) + 1, value: currentBet?.value || 1 })}
                    className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 px-4 rounded-lg font-bold hover:from-blue-700 hover:to-blue-800 transition-all duration-300"
                  >
                    📈 Bahis Yükselt
                  </button>

                  <button
                    onClick={() => sendBluffAction('bluff', { quantity: (currentBet?.quantity || 0) + 2, value: currentBet?.value || 1 })}
                    className="w-full bg-gradient-to-r from-red-600 to-red-700 text-white py-3 px-4 rounded-lg font-bold hover:from-red-700 hover:to-red-800 transition-all duration-300"
                  >
                    🤥 Blöf Yap
                  </button>

                  <button
                    onClick={() => sendChallenge()}
                    className="w-full bg-gradient-to-r from-orange-600 to-orange-700 text-white py-3 px-4 rounded-lg font-bold hover:from-orange-700 hover:to-orange-800 transition-all duration-300"
                  >
                    ⚔️ İtiraz Et
                  </button>
                </div>
              )}

              {gamePhase === 'waiting' && (
                <div className="text-center text-gray-400">
                  <p>Oyuncular bekleniyor...</p>
                  <p className="text-sm mt-2">{players.length}/{gameRoom.max_players} oyuncu</p>
                </div>
              )}

              {(gamePhase === 'playing' || gamePhase === 'betting') && (
                <div className="text-center text-gray-400">
                  <p>Oyun devam ediyor...</p>
                  <p className="text-sm mt-2">{players.length}/{gameRoom.max_players} oyuncu</p>
                </div>
              )}

              {gamePhase === 'finished' && (
                <div className="text-center">
                  <div className="text-4xl mb-2">🏆</div>
                  <p className="text-yellow-400 font-bold">Oyun Bitti!</p>
                  <button
                    onClick={() => router.push('/bluff')}
                    className="mt-3 bg-gradient-to-r from-green-600 to-green-700 text-white px-4 py-2 rounded-lg font-bold hover:from-green-700 hover:to-green-800 transition-all duration-300"
                  >
                    Yeni Oyun
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bahis yerleştirme modal'ı */}
      {showBetPlacement && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gradient-to-br from-purple-900 to-purple-800 p-6 rounded-3xl max-w-2xl w-full mx-4">
            <BetPlacement
              roomId={roomId}
              gameType="bluff"
              onBetPlaced={handleBetPlaced}
              onClose={() => setShowBetPlacement(false)}
              minBet={10}
              maxBet={1000}
            />
          </div>
        </div>
      )}
    </div>
  );
}
