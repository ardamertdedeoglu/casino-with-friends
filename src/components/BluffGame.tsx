'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth';
import { useVirtualCurrency } from '../lib/virtualCurrency';
import { useBluffGame } from '../lib/useBluffGame';
import BetPlacement from './BetPlacement';
import BluffBetPlacement from './BluffBetPlacement';
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
  showAllDice?: boolean;
}

interface PlayerJoinedData {
  name: string;
}

interface ChallengeResultData {
  message: string;
  winner?: string;
  loser?: string;
  chipAmount?: number;
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
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [allDiceVisible, setAllDiceVisible] = useState(false);
  const [showBettingInterface, setShowBettingInterface] = useState(false);
  const [betQuantity, setBetQuantity] = useState(1);
  const [betValue, setBetValue] = useState(1);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [playerScores, setPlayerScores] = useState<{[playerId: string]: number}>({});

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
    onSpotOnResult,
    onRoundEnd
  } = useBluffGame(roomId, user?.user_metadata?.username || 'Oyuncu');

  // Player score tracking function
  const updatePlayerScore = useCallback((winnerName: string, loserName: string, chipAmount: number) => {
    setPlayerScores(prevScores => {
      const newScores = { ...prevScores };
      
      // Update winner (gain chips)
      const winnerKey = players.find(p => p.name === winnerName)?.id;
      if (winnerKey) {
        newScores[winnerKey] = (newScores[winnerKey] || 0) + chipAmount;
      }
      
      // Update loser (lose chips)
      const loserKey = players.find(p => p.name === loserName)?.id;
      if (loserKey) {
        newScores[loserKey] = (newScores[loserKey] || 0) - chipAmount;
      }
      
      console.log('🏆 Updated scores:', newScores);
      return newScores;
    });
  }, [players]);

  // Oyuncuları güncelle
  const updatePlayers = useCallback((playerList: { id: string; name: string; chips: number; dice: number[]; isActive: boolean; isConnected: boolean; }[]) => {
    console.log('🎲 updatePlayers called with:', playerList?.length || 0, 'players, socketId:', socketId);
    
    if (!playerList) {
      console.warn('🎲 playerList is null/undefined, setting empty array');
      setPlayers([]);
      return;
    }
    
    console.log('🎲 Player list details:', playerList.map(p => ({ id: p.id, name: p.name, dice: p.dice?.length || 0, isActive: p.isActive })));
    
    const updatedPlayers = playerList.map((p, index) => ({
      id: p.id,
      name: p.name,
      chips: p.chips || 1000,
      dice: p.dice || [], // Server artık doğru verileri gönderiyor
      isActive: p.isActive || false,
      position: index,
      isConnected: p.isConnected !== false // Default to true if not specified
    }));
    
    console.log('🎲 Setting players state:', updatedPlayers.length, 'players');
    console.log('🎲 Final players data:', updatedPlayers.map(p => ({ id: p.id, name: p.name, dice: p.dice.length, isActive: p.isActive })));
    
    setPlayers(updatedPlayers);
  }, [socketId]);

  // Players state değişikliklerini izle
  useEffect(() => {
    console.log('🎲 Players state changed:', players.length, 'players');
    console.log('🎲 Current players:', players);
  }, [players]);

  // Oyun güncellemelerini dinle
  useEffect(() => {
    console.log('🎲 Setting up game callbacks, socketId:', socketId);
    
    // Callback'i sadece socketId hazır olduğunda kur
    if (!socketId) {
      console.log('🎲 Waiting for socketId to be available...');
      return;
    }
    
    onGameUpdate((data: BluffGameData) => {
      console.log('🎲 Game update received:', {
        playersCount: data.players?.length || 0,
        currentPlayer: data.currentPlayer,
        phase: data.phase,
        myDice: data.myDice?.length || 0,
        socketId: socketId
      });
      console.log('🎲 Full players data:', data.players);
      
      setGameRoom(data.gameRoom);
      setCurrentPlayer(data.currentPlayer);
      setCurrentBet(data.currentBet);
      setGamePhase(data.phase);
      setRoundNumber(data.roundNumber);
      
      // myDice'i önce güncelle
      if (data.myDice) {
        console.log('🎲 Setting myDice:', data.myDice);
        setMyDice(data.myDice);
      }
      
      // Sonra oyuncuları güncelle - hemen güncelle, boş olsa bile
      console.log('🎲 Calling updatePlayers with:', data.players);
      updatePlayers(data.players || []);
      
      // Sıranın kimin olduğunu kontrol et
      setIsMyTurn(socketId === data.currentPlayer);
      
      // Tüm zarları göster flag'ini kontrol et
      if (data.showAllDice) {
        setAllDiceVisible(true);
        // 5 saniye sonra gizle
        setTimeout(() => {
          setAllDiceVisible(false);
        }, 5000);
      }
      
      // Bahis arayüzünü kapat
      if (socketId !== data.currentPlayer) {
        setShowBettingInterface(false);
      }
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
      setAllDiceVisible(true); // İtiraz sonuçlarını göstermek için tüm zarları aç
      
      // Update scores for challenge result (100 chips)
      if (result.winner && result.loser && result.chipAmount) {
        updatePlayerScore(result.winner, result.loser, result.chipAmount);
      } else if (result.winner && result.loser) {
        // Fallback to 100 chips if chipAmount not provided
        updatePlayerScore(result.winner, result.loser, 100);
      }
      
      setTimeout(() => {
        setMessage('');
        setAllDiceVisible(false);
      }, 5000);
    });

    onSpotOnResult((result: ChallengeResultData) => {
      setMessage(result.message);
      setAllDiceVisible(true); // Spot On sonuçlarını göstermek için tüm zarları aç
      
      // Update scores for spot on result (always 300 chips)
      if (result.winner && result.loser && result.chipAmount) {
        updatePlayerScore(result.winner, result.loser, result.chipAmount);
      } else if (result.winner && result.loser) {
        // Fallback to 300 chips if chipAmount not provided (always 300 now)
        updatePlayerScore(result.winner, result.loser, 300);
      }
      
      setTimeout(() => {
        setMessage('');
        setAllDiceVisible(false);
      }, 5000);
    });

    onRoundEnd((result: RoundEndData) => {
      setMessage(`Tur bitti! ${result.winner} kazandı, ${result.loser} kaybetti`);
      setTimeout(() => setMessage(''), 5000);
    });
  }, [onGameUpdate, onPlayerJoined, onPlayerLeft, onBetPlaced, onChallengeResult, onSpotOnResult, onRoundEnd, updatePlayers, socketId, updatePlayerScore]);

  // Bahis yerleştirme
  const handleBetPlaced = () => {
    setShowBetPlacement(false);
    setGamePhase('playing');
    // İlk bahis için gerekli işlemler
  };

  // Bahis yapmak için yeni fonksiyon (BluffBetPlacement için)
  const handleBluffBetSubmit = (quantity: number, value: number, isBluff: boolean) => {
    if (isBluff) {
      sendBluffAction('bluff', { quantity, value });
    } else {
      sendBluffAction('raise', { quantity, value });
    }
    setShowBetPlacement(false);
  };

  // Hızlı bahis için fonksiyonlar
  const handleMakeBet = () => {
    if (betQuantity >= 1 && betValue >= 1 && betValue <= 6) {
      sendBluffAction('raise', { quantity: betQuantity, value: betValue });
      setShowBettingInterface(false);
    }
  };

  const handleMakeBluff = () => {
    if (betQuantity >= 1 && betValue >= 1 && betValue <= 6) {
      sendBluffAction('bluff', { quantity: betQuantity, value: betValue });
      setShowBettingInterface(false);
    }
  };

  // İtiraz etmek için fonksiyon
  const handleChallenge = () => {
    sendChallenge();
    setAllDiceVisible(true);
  };

  // Spot On için fonksiyon
  const handleSpotOn = () => {
    sendBluffAction('spot-on', { quantity: betQuantity, value: betValue } );
    setAllDiceVisible(true);
  };

  // Bahis geçerliliği kontrolü
  const isValidBet = (quantity: number, value: number) => {
    if (!currentBet) {
      return quantity >= 1 && value >= 1 && value <= 6;
    }
    
    if (quantity > currentBet.quantity) {
      return value >= 1 && value <= 6;
    } else if (quantity === currentBet.quantity) {
      return value > currentBet.value && value <= 6;
    }
    
    return false;
  };

  // Minimum bahis değerlerini hesapla
  const getMinBetValues = () => {
    if (!currentBet) {
      return { minQuantity: 1, minValue: 1 };
    }
    
    return {
      minQuantity: currentBet.quantity,
      minValue: currentBet.value + 1 > 6 ? 1 : currentBet.value + 1
    };
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

  // Oyuncu pozisyonları için sabit konumlar (pusula yönleri)
  const getPlayerPosition = (index: number, totalPlayers: number) => {
    // Sabit pozisyonlar - responsive için yüzde bazlı
    const positions = [
      // İlk 4 oyuncu: Ana yönler
      { left: '50%', top: '15%', transform: 'translate(-50%, -50%)', direction: 'Kuzey' },      // North
      { left: '85%', top: '50%', transform: 'translate(-50%, -50%)', direction: 'Doğu' },       // East
      { left: '50%', top: '85%', transform: 'translate(-50%, -50%)', direction: 'Güney' },      // South
      { left: '15%', top: '50%', transform: 'translate(-50%, -50%)', direction: 'Batı' },       // West
      // Sonraki 4 oyuncu: Ara yönler
      { left: '75%', top: '25%', transform: 'translate(-50%, -50%)', direction: 'Kuzeydoğu' },  // NorthEast
      { left: '75%', top: '75%', transform: 'translate(-50%, -50%)', direction: 'Güneydoğu' }, // SouthEast
      { left: '25%', top: '75%', transform: 'translate(-50%, -50%)', direction: 'Güneybatı' }, // SouthWest
      { left: '25%', top: '25%', transform: 'translate(-50%, -50%)', direction: 'Kuzeybatı' }  // NorthWest
    ];

    // İndeks sınırını kontrol et
    if (index >= positions.length) {
      console.warn(`Player index ${index} exceeds maximum positions (${positions.length})`);
      // Fallback: Dairesel pozisyon
      const angle = (index / totalPlayers) * 2 * Math.PI - Math.PI / 2;
      const radius = '35%';
      return {
        left: `${50 + Math.cos(angle) * 35}%`,
        top: `${50 + Math.sin(angle) * 35}%`,
        transform: 'translate(-50%, -50%)',
        direction: `Pos-${index + 1}`
      };
    }

    return positions[index];
  };

  // Skor tablosu için - dinamik sıralama (en yüksek puan → en düşük puan)
  const scoreboardEntries = players.map(p => ({
    id: p.id,
    name: p.name,
    netWinnings: playerScores[p.id] || 0, // Use tracked scores instead of 0
    isDealer: p.id === currentPlayer
  })).sort((a, b) => b.netWinnings - a.netWinnings); // Sort by highest score first

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
                Oyuncular: <span className="text-green-400 font-bold">{players.length}/{gameRoom.max_players}</span>
              </div>
              <div className="text-white">
                💎 <span className="text-yellow-400 font-bold">{userProfile.chips.toLocaleString()}</span>
              </div>
              <button
                onClick={() => setShowHelpModal(true)}
                className="bg-gradient-to-r from-blue-600 to-blue-700 text-white w-10 h-10 rounded-full hover:from-blue-700 hover:to-blue-800 transition-all duration-300 flex items-center justify-center text-xl font-bold shadow-lg hover:shadow-xl transform hover:scale-110"
                title="Oyun talimatları ve yardım"
              >
                ?
              </button>
            </div>
          </div>
        </div>

        {/* Oyun mesajı - Removed from top, moved to table center */}

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
                {/* Challenge result message - Center of table */}
                {message && (
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-30">
                    <div className="bg-blue-600 text-white px-6 py-4 rounded-xl border-4 border-blue-400 shadow-2xl text-center font-bold animate-pulse max-w-md">
                      {message}
                    </div>
                  </div>
                )}
                
                {/* Masanın merkezi - Bahis Kontrolleri */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
                  {/* Oyun başlatma butonu */}
                  {gamePhase === 'waiting' && players.length >= 2 && (
                    <button
                      onClick={() => sendBluffAction('start-game', {})}
                      className="bg-gradient-to-r from-green-600 to-green-700 text-white px-8 py-4 rounded-xl font-bold text-lg hover:from-green-700 hover:to-green-800 transition-all duration-300 shadow-lg transform hover:scale-105"
                    >
                      🎮 Oyunu Başlat
                    </button>
                  )}

                  {/* Bekliyor mesajı */}
                  {gamePhase === 'waiting' && players.length < 2 && (
                    <div className="text-gray-400 text-center">
                      <div className="text-3xl mb-2">💭</div>
                      <div>En az 2 oyuncu gerekli</div>
                      <div className="text-sm mt-1">Arkadaşlarınızı davet edin!</div>
                    </div>
                  )}

                  {/* Bahis Kontrolleri - Merkez (oyuncu sırasında) */}
                  {gamePhase === 'playing' && isMyTurn && (() => {
                    return (
                    <div className="bg-black bg-opacity-80 p-6 rounded-xl border-2 border-yellow-500 min-w-[280px]">
                      {/* Hızlı Bahis Arayüzü */}
                      {showBettingInterface ? (
                        <div className="space-y-4">
                          <h4 className="text-yellow-300 font-bold text-lg text-center">🎲 Hızlı Bahis</h4>
                          
                          {currentBet && (
                            <div className="text-center text-gray-300 text-sm mb-3">
                              Mevcut: {currentBet.quantity} × {currentBet.value}
                            </div>
                          )}
                          
                          {!currentBet && (
                            <div className="text-center text-yellow-400 text-sm mb-3">
                              🎆 İlk bahis! Oyunu başlatın
                            </div>
                          )}
                          
                          <div className="flex items-center justify-between mb-3">
                            <label className="text-gray-300 text-sm font-semibold">Miktar:</label>
                            <div className="flex items-center space-x-3">
                              <button
                                onClick={() => setBetQuantity(Math.max(1, betQuantity - 1))}
                                className="bg-red-600 text-white px-3 py-2 rounded-lg text-sm font-bold hover:bg-red-700 transition-all"
                              >
                                -
                              </button>
                              <span className="text-white font-bold text-lg w-12 text-center">{betQuantity}</span>
                              <button
                                onClick={() => setBetQuantity(betQuantity + 1)}
                                className="bg-green-600 text-white px-3 py-2 rounded-lg text-sm font-bold hover:bg-green-700 transition-all"
                              >
                                +
                              </button>
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between mb-4">
                            <label className="text-gray-300 text-sm font-semibold">Değer:</label>
                            <div className="flex space-x-2">
                              {[1, 2, 3, 4, 5, 6].map(value => {
                                // Zar deseni
                                const getDotPattern = (value: number) => {
                                  const patterns = {
                                    1: [[0,0,0],[0,1,0],[0,0,0]],
                                    2: [[1,0,0],[0,0,0],[0,0,1]],
                                    3: [[1,0,0],[0,1,0],[0,0,1]],
                                    4: [[1,0,1],[0,0,0],[1,0,1]],
                                    5: [[1,0,1],[0,1,0],[1,0,1]],
                                    6: [[1,0,1],[1,0,1],[1,0,1]]
                                  };
                                  return patterns[value as keyof typeof patterns] || patterns[1];
                                };
                                
                                return (
                                  <button
                                    key={value}
                                    onClick={() => setBetValue(value)}
                                    className={`relative w-12 h-12 rounded-lg border-2 transition-all ${
                                      betValue === value
                                        ? 'bg-white border-yellow-400 border-4 scale-110 shadow-lg shadow-yellow-400/50'
                                        : 'bg-white border-gray-400 hover:bg-gray-100 hover:scale-105 shadow-md'
                                    }`}
                                    title={`Zar değeri: ${value}`}
                                  >
                                    {/* Zar deseni */}
                                    <div className="grid grid-cols-3 gap-0.5 w-8 h-8 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                                      {getDotPattern(value).flat().map((dot, dotIndex) => (
                                        <div
                                          key={dotIndex}
                                          className={`w-1.5 h-1.5 rounded-full ${
                                            dot ? 'bg-gray-800' : 'bg-transparent'
                                          }`}
                                        />
                                      ))}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                          
                          <div className="flex space-x-2">
                            <button
                              onClick={handleMakeBet}
                              disabled={!isValidBet(betQuantity, betValue)}
                              className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 px-4 rounded-lg font-bold hover:from-blue-700 hover:to-blue-800 transition-all duration-300 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed"
                            >
                              💰 Bahis
                            </button>
                            
                            <button
                              onClick={handleMakeBluff}
                              disabled={!isValidBet(betQuantity, betValue)}
                              className="flex-1 bg-gradient-to-r from-red-600 to-red-700 text-white py-3 px-4 rounded-lg font-bold hover:from-red-700 hover:to-red-800 transition-all duration-300 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed"
                            >
                              🤥 Blöf
                            </button>
                          </div>
                          
                          <div className="flex justify-center">
                            <button
                              onClick={() => setShowBettingInterface(false)}
                              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-all text-sm font-semibold"
                            >
                              ✖️ Kapat
                            </button>
                          </div>
                          
                          {!isValidBet(betQuantity, betValue) && currentBet && (
                            <div className="text-red-400 text-xs text-center">
                              Bahis {currentBet.quantity} × {currentBet.value}&apos;den yüksek olmalı
                            </div>
                          )}
                        </div>
                      ) : (
                        /* Ana Bahis Butonları */
                        <div className="space-y-4">
                          {!currentBet && (
                            <div className="text-center mb-3">
                              <div className="text-yellow-400 font-bold text-lg mb-2">🎲 İlk Bahisi Yapın!</div>
                              <div className="text-gray-300 text-sm">Oyunu başlatmak için bir bahis yapın</div>
                            </div>
                          )}
                          
                          <div className="space-y-3">
                        
                            <button
                              onClick={() => {
                                console.log('💰 Hızlı Bahis clicked!', { currentBet, isMyTurn, gamePhase });
                                if (currentBet) {
                                  // Eğer mevcut bahis varsa, minimum değerleri al
                                  const minValues = getMinBetValues();
                                  console.log('Setting min values:', minValues);
                                  setBetQuantity(minValues.minQuantity);
                                  setBetValue(minValues.minValue);
                                } else {
                                  // İlk bahis için varsayılan değerler
                                  console.log('Setting default values for first bet');
                                  setBetQuantity(1);
                                  setBetValue(1);
                                }
                                setShowBettingInterface(true);
                              }}
                              className="w-full bg-gradient-to-r from-green-600 to-green-700 text-white py-4 px-2 rounded-xl font-bold text-lg hover:from-green-700 hover:to-green-800 transition-all duration-300 shadow-lg transform hover:scale-105"
                            >
                              💰 Hızlı Bahis
                            </button>

                            {currentBet && (
                              <>
                                <button
                                  onClick={handleChallenge}
                                  className="w-full bg-gradient-to-r from-orange-600 to-orange-700 text-white py-4 px-2 rounded-xl font-bold text-lg hover:from-orange-700 hover:to-orange-800 transition-all duration-300 shadow-lg transform hover:scale-105"
                                >
                                  ⚔️ İtiraz Et
                                </button>
                                
                                <button
                                  onClick={handleSpotOn}
                                  className="w-full bg-gradient-to-r from-purple-600 to-purple-700 text-white py-4 px-2 rounded-xl font-bold text-lg hover:from-purple-700 hover:to-purple-800 transition-all duration-300 shadow-lg transform hover:scale-105"
                                >
                                  🎯 SPOT ON!
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    );
                  })()}

                  {/* Oyun devam ediyor ama sıra başkasında */}
                  {gamePhase === 'playing' && !isMyTurn && (
                    <div className="bg-black bg-opacity-70 p-4 rounded-xl border-2 border-gray-500 min-w-[200px]">
                      <div className="text-white text-center">
                        <div className="text-2xl mb-2">⏳</div>
                        <div className="text-lg font-semibold mb-1">
                          {!currentBet ? 'İlk Bahis Bekleniyor' : 'Sıra Bekliyor'}
                        </div>
                        <div className="text-yellow-400 text-sm">
                          {players.find(p => p.id === currentPlayer)?.name || 'Bilinmeyen oyuncu'} 
                          {!currentBet ? ' başlayacak' : ' oynuyor'}
                        </div>
                      </div>
                    </div>
                  )}


                </div>

              {/* Oyuncular */}
              {players.map((player, index) => {
                const position = getPlayerPosition(index, players.length);
                const { direction, ...stylePosition } = position; // Separate direction from CSS style
                return (
                  <div
                    key={player.id}
                    className={`absolute p-3 rounded-xl border-2 transition-all duration-300 min-w-[120px] ${
                      player.isActive
                        ? 'bg-yellow-600 border-yellow-400 shadow-lg scale-110 z-20'
                        : 'bg-gray-700 border-gray-500 z-10'
                    }`}
                    style={stylePosition}
                    title={`${player.name} - ${direction} konumunda`}
                  >
                    {/* Pozisyon göstergesi */}
                    <div className={`absolute -top-2 -right-2 text-xs px-1 py-0.5 rounded ${
                      player.isActive ? 'bg-yellow-800 text-yellow-200' : 'bg-gray-600 text-gray-300'
                    }`}>
                      {index + 1}
                    </div>
                    
                    <div className="text-center">
                      <div className={`font-bold ${
                        player.isActive ? 'text-black' : 'text-white'
                      }`}>
                        {player.name}
                        {player.id === socketId && (
                          <span className="ml-1 text-xs">(Sen)</span>
                        )}
                      </div>
                      <div className="text-sm text-yellow-400">
                        💎 {player.chips.toLocaleString()}
                      </div>

                      {/* Zarlar (sadece kendi zarları görünür veya itiraz sonrası) */}
                      {player.id === socketId ? (
                        // Kendi zarlarımız - her zaman görülür
                        myDice.length > 0 && (
                          <div className="flex justify-center space-x-1 mt-2">
                            {myDice.map((die, i) => {
                              // Zar yüzü desenlerini göster
                              const getDotPattern = (value: number) => {
                                const patterns = {
                                  1: [[0,0,0],[0,1,0],[0,0,0]],
                                  2: [[1,0,0],[0,0,0],[0,0,1]],
                                  3: [[1,0,0],[0,1,0],[0,0,1]],
                                  4: [[1,0,1],[0,0,0],[1,0,1]],
                                  5: [[1,0,1],[0,1,0],[1,0,1]],
                                  6: [[1,0,1],[1,0,1],[1,0,1]]
                                };
                                return patterns[value as keyof typeof patterns] || patterns[1];
                              };

                              return (
                                <div
                                  key={i}
                                  className={`relative w-12 h-12 bg-gradient-to-br from-white to-gray-100 rounded-lg border-2 border-gray-800 flex flex-col justify-center items-center text-sm font-bold text-black shadow-lg transform hover:scale-110 transition-all duration-300 ${
                                    allDiceVisible && currentBet && die === currentBet.value ? 'ring-4 ring-yellow-400 ring-opacity-75' : ''
                                  }`}
                                  title={`Zar ${i + 1}: ${die}`}
                                >
                                  {/* Zar deseni */}
                                  <div className="grid grid-cols-3 gap-0.5 w-8 h-8">
                                    {getDotPattern(die).flat().map((dot, dotIndex) => (
                                      <div
                                        key={dotIndex}
                                        className={`w-1.5 h-1.5 rounded-full ${
                                          dot ? 'bg-gray-800' : 'bg-transparent'
                                        }`}
                                      />
                                    ))}
                                  </div>
                                  
                                  {/* Sayı (küçük) */}
                                  <div className="absolute bottom-0 right-0 text-xs bg-gray-800 text-white rounded-full w-4 h-4 flex items-center justify-center">
                                    {die}
                                  </div>
                                  
                                  {/* Vurgulama efekti */}
                                  {allDiceVisible && currentBet && die === currentBet.value && (
                                    <div className="absolute inset-0 bg-yellow-400 bg-opacity-30 rounded-lg animate-pulse" />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )
                      ) : (
                        // Diğer oyuncuların zarları
                        allDiceVisible && player.dice.length > 0 ? (
                          // İtiraz sonrası - tüm zarları göster
                          <div className="flex justify-center space-x-1 mt-2">
                            {player.dice.map((die, i) => {
                              const getDotPattern = (value: number) => {
                                const patterns = {
                                  1: [[0,0,0],[0,1,0],[0,0,0]],
                                  2: [[1,0,0],[0,0,0],[0,0,1]],
                                  3: [[1,0,0],[0,1,0],[0,0,1]],
                                  4: [[1,0,1],[0,0,0],[1,0,1]],
                                  5: [[1,0,1],[0,1,0],[1,0,1]],
                                  6: [[1,0,1],[1,0,1],[1,0,1]]
                                };
                                return patterns[value as keyof typeof patterns] || patterns[1];
                              };

                              return (
                                <div
                                  key={i}
                                  className={`relative w-12 h-12 bg-gradient-to-br from-white to-gray-100 rounded-lg border-2 border-gray-800 flex flex-col justify-center items-center text-sm font-bold text-black shadow-lg transform hover:scale-110 transition-all duration-300 ${
                                    currentBet && die === currentBet.value ? 'ring-4 ring-yellow-400 ring-opacity-75' : ''
                                  }`}
                                  title={`${player.name} - Zar ${i + 1}: ${die}`}
                                >
                                  {/* Zar deseni */}
                                  <div className="grid grid-cols-3 gap-0.5 w-8 h-8">
                                    {getDotPattern(die).flat().map((dot, dotIndex) => (
                                      <div
                                        key={dotIndex}
                                        className={`w-1.5 h-1.5 rounded-full ${
                                          dot ? 'bg-gray-800' : 'bg-transparent'
                                        }`}
                                      />
                                    ))}
                                  </div>
                                  
                                  {/* Sayı (küçük) */}
                                  <div className="absolute bottom-0 right-0 text-xs bg-gray-800 text-white rounded-full w-4 h-4 flex items-center justify-center">
                                    {die}
                                  </div>
                                  
                                  {/* Vurgulama efekti */}
                                  {currentBet && die === currentBet.value && (
                                    <div className="absolute inset-0 bg-yellow-400 bg-opacity-30 rounded-lg animate-pulse" />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          // Normal durum - gizli zarlar
                          <div className="flex justify-center space-x-1 mt-2">
                            {Array.from({ length: 5 }, (_, i) => (
                              <div
                                key={i}
                                className="w-8 h-8 bg-gradient-to-br from-red-600 to-red-800 rounded-lg border-2 border-red-900 flex items-center justify-center shadow-lg"
                                title={`${player.name} - Gizli zar ${i + 1}`}
                              >
                                <span className="text-white font-bold">?</span>
                              </div>
                            ))}
                          </div>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sağ panel - Kontroller */}
          <div className="w-80 p-4">
            {/* Removed ChatComponent to avoid Blackjack hook conflict */}
            {/* <ChatComponent roomId={roomId} playerName={user.user_metadata?.username || 'Oyuncu'} /> */}
            
            {/* TODO: Implement Bluff-specific chat using sendChatMessage from useBluffGame */}
            <div className="mb-4 bg-gradient-to-br from-gray-800 to-gray-900 p-4 rounded-xl shadow-2xl border-2 border-gray-600">
              <h3 className="text-yellow-400 font-bold mb-3 text-center">💬 Sohbet</h3>
              <div className="text-gray-400 text-sm text-center">
                Sohbet şu anda devre dışı
                <br />
                (Blackjack hook çakışmasını önlemek için)
              </div>
            </div>

            {/* Oyun kontrolleri */}
            <div className="mt-4 bg-gradient-to-br from-gray-800 to-gray-900 p-4 rounded-xl shadow-2xl border-2 border-gray-600">
              <h3 className="text-yellow-400 font-bold mb-3 text-center">🎲 Oyun Bilgileri</h3>

              {/* Oyun durumu */}
              <div className="mb-4 bg-black bg-opacity-50 p-3 rounded-lg">
                <div className="text-yellow-400 font-bold text-lg text-center mb-2">
                  🎲 Blöf Oyunu
                </div>
                <div className="text-white text-sm text-center">
                  Tur {roundNumber} - {gamePhase === 'waiting' ? 'Bekliyor' : gamePhase === 'playing' ? 'Devam Ediyor' : 'Bitti'}
                </div>
              </div>

              {/* Mevcut bahis bilgisi */}
              {currentBet && (
                <div className="mb-4 bg-black bg-opacity-50 p-4 rounded-lg border border-yellow-500">
                  <div className="text-yellow-400 font-bold text-sm mb-2 text-center">Mevcut Bahis</div>
                  
                  {/* Bahis detayları */}
                  <div className="flex items-center justify-center space-x-2 text-white text-lg mb-2">
                    <span className="font-bold text-xl">{currentBet.quantity}</span>
                    <span>×</span>
                    <div className="relative w-8 h-8 bg-white rounded border-2 border-gray-800">
                      {/* Zar deseni */}
                      <div className="grid grid-cols-3 gap-0.5 w-6 h-6 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                        {(() => {
                          const getDotPattern = (value: number) => {
                            const patterns = {
                              1: [[0,0,0],[0,1,0],[0,0,0]],
                              2: [[1,0,0],[0,0,0],[0,0,1]],
                              3: [[1,0,0],[0,1,0],[0,0,1]],
                              4: [[1,0,1],[0,0,0],[1,0,1]],
                              5: [[1,0,1],[0,1,0],[1,0,1]],
                              6: [[1,0,1],[1,0,1],[1,0,1]]
                            };
                            return patterns[value as keyof typeof patterns] || patterns[1];
                          };
                          return getDotPattern(currentBet.value).flat().map((dot, dotIndex) => (
                            <div
                              key={dotIndex}
                              className={`w-1 h-1 rounded-full ${
                                dot ? 'bg-gray-800' : 'bg-transparent'
                              }`}
                            />
                          ));
                        })()} 
                      </div>
                    </div>
                  </div>
                  
                  {/* Oyuncu bilgisi */}
                  <div className="text-gray-300 text-xs text-center mb-2">
                    {currentBet.playerName}
                  </div>
                  
                  {/* Bahis tipi */}
                  <div className="flex items-center justify-center">
                    {currentBet.isBluff ? (
                      <span className="text-red-400 font-semibold text-xs animate-pulse">
                        🤥 Blöf Olabilir!
                      </span>
                    ) : (
                      <span className="text-green-400 font-semibold text-xs">
                        💰 Normal Bahis
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Genel oyun durumları */}
              {gamePhase === 'waiting' && (
                <div className="text-center text-gray-400">
                  <div className="text-4xl mb-2">🎲</div>
                  <p className="font-semibold">Oyuncular bekleniyor...</p>
                  <p className="text-sm mt-2">{players.length}/{gameRoom.max_players} oyuncu</p>
                  
                  {players.length >= 2 && (
                    <div className="mt-3 text-xs text-green-400">
                      Oyun başlatmaya hazır!
                    </div>
                  )}
                  
                  {players.length < 2 && (
                    <div className="mt-3 text-xs text-gray-500">
                      En az 2 oyuncu gerekli
                    </div>
                  )}
                </div>
              )}

              {gamePhase === 'playing' && !isMyTurn && (
                <div className="text-center text-gray-400">
                  <div className="text-3xl mb-2">⏳</div>
                  <p className="font-semibold">Sıra bekleniyor...</p>
                  <p className="text-sm mt-1">
                    {players.find(p => p.id === currentPlayer)?.name || 'Bilinmeyen oyuncu'} oynuyor
                  </p>
                  
                  {/* Sade mevcut bahis gösterimi */}
                  {currentBet && (
                    <div className="mt-3 bg-gray-700 p-2 rounded-lg">
                      <div className="text-xs text-gray-400">Mevcut bahis:</div>
                      <div className="text-yellow-400 font-bold">
                        {currentBet.quantity} × 🎲 {currentBet.value}
                      </div>
                      {currentBet.isBluff && (
                        <div className="text-red-400 text-xs">Blöf olabilir! 🤥</div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {gamePhase === 'playing' && isMyTurn && (
                <div className="text-center text-yellow-400">
                  <div className="text-3xl mb-2">✨</div>
                  <p className="font-semibold text-lg">Sıra Sizde!</p>
                  <p className="text-sm mt-1 text-gray-300">Masanın merkezindeki butonları kullanın</p>
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

      {/* Yardım Modalı */}
      {showHelpModal && (
        <div className="fixed inset-0 backdrop-blur-sm bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-gray-900 to-black max-w-4xl w-full max-h-[90vh] overflow-y-auto rounded-3xl border-4 border-yellow-500 shadow-2xl">
            <div className="p-8">
              {/* Başlık */}
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-4xl font-bold text-yellow-400 flex items-center">
                  🎲 Blöf Oyunu Rehberi
                </h2>
                <button
                  onClick={() => setShowHelpModal(false)}
                  className="text-gray-400 hover:text-white text-3xl font-bold w-12 h-12 rounded-full bg-gray-800 hover:bg-gray-700 transition-all duration-300 flex items-center justify-center"
                >
                  ×
                </button>
              </div>

              {/* Ana içerik */}
              <div className="space-y-8 text-white">
                {/* Oyunun Amacı */}
                <section>
                  <h3 className="text-2xl font-bold text-green-400 mb-4 flex items-center">
                    🎯 Oyunun Amacı
                  </h3>
                  <div className="bg-gray-800 p-4 rounded-xl">
                    <p className="text-lg leading-relaxed">
                      Blöf, zarlarla oynanan bir bluff (aldatma) oyunudur. Her oyuncu 5 zar ile başlar ve amacınız 
                      diğer oyuncuları kandırarak veya doğru tahminler yaparak oyunu kazanmaktır.
                    </p>
                  </div>
                </section>

                {/* Oyun Kurulumu */}
                <section>
                  <h3 className="text-2xl font-bold text-blue-400 mb-4 flex items-center">
                    ⚙️ Oyun Kurulumu
                  </h3>
                  <div className="bg-gray-800 p-4 rounded-xl space-y-3">
                    <div className="flex items-start space-x-3">
                      <span className="text-yellow-400 font-bold">•</span>
                      <p>Her oyuncu 5 zar ile başlar (sadece kendi zarlarınızı görebilirsiniz).</p>
                    </div>
                    <div className="flex items-start space-x-3">
                      <span className="text-yellow-400 font-bold">•</span>
                      <p>Oyun saat yönünde devam eder.</p>
                    </div>
                    <div className="flex items-start space-x-3">
                      <span className="text-yellow-400 font-bold">•</span>
                      <p>Her tur bir oyuncu ile başlar ve diğerleri sırayla oynаr.</p>
                    </div>
                  </div>
                </section>

                {/* Oynanış */}
                <section>
                  <h3 className="text-2xl font-bold text-purple-400 mb-4 flex items-center">
                    🎮 Nasıl Oynanır
                  </h3>
                  <div className="bg-gray-800 p-4 rounded-xl space-y-4">
                    <div className="border-l-4 border-green-500 pl-4">
                      <h4 className="text-lg font-bold text-green-400 mb-2">💰 Bahis Yapma</h4>
                      <p>Sıranız geldiğinde bir bahis yapmalısınız. Bahis formatı: &quot;X tane Y zarı&quot; şeklindedir.</p>
                      <p className="text-yellow-300 text-sm mt-2">
                        Örnek: &quot;3 tane 4 zarı&quot; = Masada toplam <strong>EN AZ</strong> 3 tane 4 zarı olduğunu iddia ediyorsunuz.
                      </p>
                    </div>
                    
                    <div className="border-l-4 border-red-500 pl-4">
                      <h4 className="text-lg font-bold text-red-400 mb-2">🤥 Blöf Yapma</h4>
                      <p>Gerçekte olmayan bir durum hakkında bahis yapabilirsiniz. Diğer oyuncuları kandırmaya çalışın!</p>
                    </div>
                    
                    <div className="border-l-4 border-orange-500 pl-4">
                      <h4 className="text-lg font-bold text-orange-400 mb-2">⚔️ İtiraz Etme</h4>
                      <p>Bir bahsin yanlış olduğunu düşünüyorsanız &quout;itiraz et&quot; butonuna tıklayabilirsiniz.</p>
                      <p className="text-yellow-300 text-sm mt-2">
                        İtiraz sonrası tüm zarlar açılır ve gerçek kontrol edilir
                      </p>
                    </div>
                    
                    <div className="border-l-4 border-purple-500 pl-4">
                      <h4 className="text-lg font-bold text-purple-400 mb-2">🎯 SPOT ON!</h4>
                      <p>Bir önceki oyuncunun bahsinin TAM OLARAK doğru olduğunu iddia edebilirsiniz.</p>
                      <p className="text-yellow-300 text-sm mt-2">
                        Eğer doğruysa, normal chiplerinin 3 katını kazanırsınız!
                      </p>
                      <p className="text-red-300 text-sm mt-1">
                        Eğer yanlışsa, siz chip kaybedersiniz.
                      </p>
                    </div>
                  </div>
                </section>

                {/* Bahis Kuralları */}
                <section>
                  <h3 className="text-2xl font-bold text-yellow-400 mb-4 flex items-center">
                    📜 Bahis Kuralları
                  </h3>
                  <div className="bg-gray-800 p-4 rounded-xl space-y-3">
                    <div className="flex items-start space-x-3">
                      <span className="text-green-400 font-bold">1.</span>
                      <p>Her yeni bahis bir öncekinden yüksek olmalı</p>
                    </div>
                    <div className="flex items-start space-x-3">
                      <span className="text-green-400 font-bold">2.</span>
                      <p>Aynı miktar zar ile daha yüksek değer seçebilirsiniz</p>
                    </div>
                    <div className="flex items-start space-x-3">
                      <span className="text-green-400 font-bold">3.</span>
                      <p>Daha çok zar ile herhangi bir değer seçebilirsiniz</p>
                    </div>
                    <div className="bg-blue-900 p-3 rounded-lg mt-4">
                      <p className="text-blue-200 text-sm">
                        💡 <strong>Örnek:</strong> Mevcut bahis &quot;2 tane 3&quot; ise, 
                        sonraki bahis &quot;tane 4&quot; veya &quot;tane 1&quot; olabilir\r
                      </p>
                    </div>
                  </div>
                </section>

                {/* Kazanma */}
                <section>
                  <h3 className="text-2xl font-bold text-green-400 mb-4 flex items-center">
                    🏆 Kazanma Koşulları
                  </h3>
                  <div className="bg-gray-800 p-4 rounded-xl space-y-3">
                    <div className="border border-green-500 p-3 rounded-lg">
                      <h4 className="font-bold text-green-400 mb-2">✅ Doğru İtiraz</h4>
                      <p>Eğer itiraz ettiğiniz bahis gerçekten yanlışsa, bahis yapan oyuncu kaybeder.</p>
                    </div>
                    <div className="border border-red-500 p-3 rounded-lg">
                      <h4 className="font-bold text-red-400 mb-2">❌ Yanlış İtiraz</h4>
                      <p>Eğer itiraz ettiğiniz bahis gerçekten doğruysa, siz kaybedersiniz.</p>
                    </div>
                    <div className="bg-yellow-900 p-3 rounded-lg">
                      <p className="text-yellow-200 text-sm">
                        🎯 Sona kalan oyuncu oyunu kazanır!
                      </p>
                    </div>
                  </div>
                </section>

                {/* Kontroller */}
                <section>
                  <h3 className="text-2xl font-bold text-cyan-400 mb-4 flex items-center">
                    🎮 Oyun Kontrolleri
                  </h3>
                  <div className="bg-gray-800 p-4 rounded-xl grid md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div className="flex items-center space-x-3">
                        <div className="bg-green-600 px-3 py-1 rounded-lg font-bold text-sm">💰 Hızlı Bahis</div>
                        <p className="text-sm">Bahis yapmak için</p>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="bg-orange-600 px-3 py-1 rounded-lg font-bold text-sm">⚔️ İtiraz Et</div>
                        <p className="text-sm">Mevcut bahise itiraz etmek için</p>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="bg-purple-600 px-3 py-1 rounded-lg font-bold text-sm">🎯 SPOT ON!</div>
                        <p className="text-sm">Mevcut bahisin tam doğru olduğunu iddia etmek için</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-3">
                        <div className="bg-blue-600 px-3 py-1 rounded-lg font-bold text-sm">💰 Bahis</div>
                        <p className="text-sm">Normal (doğru) bahis</p>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="bg-red-600 px-3 py-1 rounded-lg font-bold text-sm">🤥 Blöf</div>
                        <p className="text-sm">Yanlış (bluff) bahis</p>
                      </div>
                    </div>
                  </div>
                </section>

                {/* İpuçları */}
                <section>
                  <h3 className="text-2xl font-bold text-pink-400 mb-4 flex items-center">
                    💡 Strateji İpuçları
                  </h3>
                  <div className="bg-gradient-to-r from-pink-900 to-purple-900 p-4 rounded-xl space-y-3">
                    <div className="flex items-start space-x-3">
                      <span className="text-pink-400">🧠</span>
                      <p>Kendi zarlarınızı iyi analiz edin - hangi sayıdan kaç tane var?</p>
                    </div>
                    <div className="flex items-start space-x-3">
                      <span className="text-pink-400">🔍</span>
                      <p>Diğer oyuncuların davranışlarını gözlemleyin.</p>
                    </div>
                    <div className="flex items-start space-x-3">
                      <span className="text-pink-400">⚖️</span>
                      <p>Risk alın ama çok agresif olmayın.</p>
                    </div>
                    <div className="flex items-start space-x-3">
                      <span className="text-pink-400">🎭</span>
                      <p>Bazen blöf yapmadan da kazanabilirsiniz!</p>
                    </div>
                  </div>
                </section>
              </div>

              {/* Kapat butonu */}
              <div className="mt-8 text-center">
                <button
                  onClick={() => setShowHelpModal(false)}
                  className="bg-gradient-to-r from-green-600 to-green-700 text-white px-8 py-4 rounded-xl font-bold text-lg hover:from-green-700 hover:to-green-800 transition-all duration-300 shadow-lg transform hover:scale-105"
                >
                  🎲 Oyuna Dön
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bahis yerleştirme modal'ı */}
      {showBetPlacement && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="max-w-2xl w-full mx-4">
            <BluffBetPlacement
              currentBet={currentBet}
              onBetSubmit={handleBluffBetSubmit}
              onClose={() => setShowBetPlacement(false)}
              myDice={myDice}
            />
          </div>
        </div>
      )}
    </div>
  );
}
