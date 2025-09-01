'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useSocketGame } from '../lib/useSocketGame';
import { useVirtualCurrency } from '../lib/virtualCurrency';
import Scoreboard from './Scoreboard';
import ChatComponent from './ChatComponent';
import SoundVolumeControl from './SoundVolumeControl';
import BetPlacement from './BetPlacement';

interface Card {
  suit: string;
  value: string;
}

interface BetUpdate {
  bet: {
    playerId: string;
    amount: number;
    hasBet: boolean;
    hasDecided: boolean;
    playerName: string;
  };
}

interface BettingStatusUpdate {
  playerBets: {
    [playerId: string]: {
      amount: number;
      hasBet: boolean;
      hasDecided: boolean;
    };
  };
}

interface GameRoom {
  id: string;
  game_type: string;
  house_chips: number;
  status: string;
}


interface Player {
  id: string;
  name: string;
  hand: Card[];
  score: number;
  bet: number;
  status: string;
  isBlackjack?: boolean;
  winnings?: number;
  hasDoubledDown?: boolean;
}

interface ScoreboardEntry {
  id: string;
  name: string;
  winnings: number;
  isDealer: boolean;
}

interface GameResults {
  dealerBusted: boolean;
  dealerBlackjack?: boolean;
  winners: Array<{ id: string; name: string; reason: string }>;
  losers: Array<{ id: string; name: string; reason: string }>;
  ties: Array<{ id: string; name: string; reason: string }>;
  scoreboard?: Array<ScoreboardEntry>;
}

export default function BlackjackGame() {
  const params = useParams();
  const roomId = params.roomId as string;
  const [playerName, setPlayerName] = useState('');
  const [joined, setJoined] = useState(false);
  const [playerId, setPlayerId] = useState('');
  const [showNameChangeModal, setShowNameChangeModal] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState('');
  
  // Bahis sistemi için yeni state'ler
  const [showBetModal, setShowBetModal] = useState(false);
  const [currentBet, setCurrentBet] = useState<number>(0);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [gameResult, setGameResult] = useState<'win' | 'loss' | 'tie' | null>(null);
  const [resultMessage, setResultMessage] = useState('');
  const [gameRoom, setGameRoom] = useState<GameRoom | null>(null);
  const [hasBet, setHasBet] = useState<boolean>(false);
  const [betDecision, setBetDecision] = useState<'bet' | 'no-bet' | null>(null);
  
  // Tüm oyuncuların bahis durumlarını takip et
  const [playerBets, setPlayerBets] = useState<{[playerId: string]: {decision: 'bet' | 'no-bet' | null, amount: number}}>({});

  // Virtual currency hook'u
  const { userProfile, processWin, processLoss, processTie, getGameRoom } = useVirtualCurrency();

  // Kullanıcı profili yüklendiğinde playerName'i otomatik ayarla
  useEffect(() => {
    if (userProfile?.username && !playerName) {
      setPlayerName(userProfile.username);
    }
  }, [userProfile, playerName]);

  // Oyun odasını yükle
  useEffect(() => {
    const loadGameRoom = async () => {
      if (roomId) {
        const room = await getGameRoom(roomId, 'blackjack');
        setGameRoom(room);
      }
    };
    loadGameRoom();
  }, [roomId, getGameRoom]);

  // Ref for turn notification sound
  const turnSoundRef = useRef<HTMLAudioElement | null>(null);

  // Ref for blackjack sound
  const blackjackSoundRef = useRef<HTMLAudioElement | null>(null);

  // Ref to track which players have already played blackjack sound
  const playedBlackjackSoundRef = useRef<Set<string>>(new Set());

  // Ref to prevent turn sound during blackjack sound
  const isBlackjackSoundPlayingRef = useRef(false);

  // Betting callback functions
  const handleBetUpdate = useCallback((data: BetUpdate) => {
    console.log('🎰 Received bet update:', data);
    if (data.bet) {
      setPlayerBets(prev => ({
        ...prev,
        [data.bet.playerId]: {
          decision: data.bet.hasBet ? 'bet' : 'no-bet',
          amount: data.bet.amount || 0
        }
      }));
    }
  }, []);

  const handleBettingStatusUpdate = useCallback((data: BettingStatusUpdate) => {
    console.log('📊 Received betting status update:', data);
    if (data.playerBets) {
      const formattedBets: {[playerId: string]: {decision: 'bet' | 'no-bet', amount: number}} = {};
      Object.entries(data.playerBets).forEach(([playerId, bet]) => {
        formattedBets[playerId] = {
          decision: bet.hasBet ? 'bet' : 'no-bet',
          amount: bet.amount || 0
        };
      });
      setPlayerBets(formattedBets);
    }
  }, []);

  const handleBettingCleared = useCallback(() => {
    console.log('🧹 Betting cleared');
    setPlayerBets({});
  }, []);

  const { gameState, joinGame, makeMove, startGame, restartGame, leaveGame, resetRoom, changeName, isLoading, socketId, error, sendBetDecision, requestBettingStatus } = useSocketGame(
    roomId, 
    playerName, 
    joined,
    undefined, // onChatMessage
    handleBetUpdate,
    handleBettingStatusUpdate,
    handleBettingCleared
  );

  // Otomatik olarak oyuna katıl
  useEffect(() => {
    if (userProfile?.username && playerName && !joined && !isLoading) {
      joinRoom();
    }
  }, [userProfile, playerName, joined, isLoading]);

  // Calculate turn status before any conditional logic
  const isMyTurn = gameState ? gameState.currentPlayer === socketId : false;
  const currentPlayerData = gameState ? gameState.players.find((p: Player) => p.id === socketId) : null;

  // Game state değiştiğinde loading'i kapat
  useEffect(() => {
    if (gameState && gameState.gameState !== 'waiting' && isLoading) {
      // Kısa bir gecikme ile loading'i kapat ki UI daha stabil görünsün
      const timer = setTimeout(() => {
        // Bu kısım useSocketGame'da zaten hallediliyor
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [gameState, isLoading]);

  // Yeni oyun başladığında bahisleri sıfırla
  useEffect(() => {
    if (gameState?.gameState === 'waiting') {
      resetBetForNewGame();
    }
  }, [gameState?.gameState]);

  // Demo amaçlı: Diğer oyuncuların bahis kararlarını simüle et
  // Request betting status when game starts or when joining
  useEffect(() => {
    if (gameState?.gameState === 'waiting' && joined && requestBettingStatus) {
      requestBettingStatus();
    }
  }, [gameState?.gameState, joined, requestBettingStatus]);

  // Oyun bittiğinde bahisleri sıfırla (biraz gecikme ile)
  useEffect(() => {
    if (gameState?.gameState === 'finished') {
      // 3 saniye sonra bahisleri sıfırla ki oyuncular sonuçları görebilsin
      const timer = setTimeout(() => {
        resetBetForNewGame();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [gameState?.gameState]);

  // Play turn notification sound when it's player's turn (but not during blackjack sound)
  useEffect(() => {
    if (isMyTurn && turnSoundRef.current && gameState?.gameState === 'playing' && !isBlackjackSoundPlayingRef.current) {
      console.log('🎯 Playing turn sound for current player');
      turnSoundRef.current.play().catch(err => {
        console.log('Ses çalma hatası:', err);
      });
    } else if (isMyTurn && isBlackjackSoundPlayingRef.current) {
      console.log('🎯 Turn sound blocked - blackjack sound is playing');
    }
  }, [isMyTurn, gameState?.gameState]);

  // Play blackjack sound when any player gets blackjack (except dealer)
  useEffect(() => {
    if (gameState?.players && blackjackSoundRef.current) {
      gameState.players.forEach(player => {
        // Check if player has blackjack and we haven't played sound for them yet
        if (player.isBlackjack && player.id !== 'dealer' && !playedBlackjackSoundRef.current.has(player.id)) {
          console.log(`🎉 Blackjack detected for ${player.name}! Playing blackjack sound...`);
          playedBlackjackSoundRef.current.add(player.id); // Mark as played
          isBlackjackSoundPlayingRef.current = true; // Prevent turn sound

          const audioElement = blackjackSoundRef.current;
          if (audioElement) {
            audioElement.currentTime = 0; // Reset to beginning

            // Add a small delay to ensure audio is ready
            setTimeout(() => {
              audioElement.play().then(() => {
                console.log(`🎵 Blackjack sound started playing for ${player.name}`);
              }).catch(err => {
                console.log('Blackjack ses çalma hatası:', err);
                playedBlackjackSoundRef.current.delete(player.id); // Remove from played set on error
                isBlackjackSoundPlayingRef.current = false; // Allow turn sound
              });

              // Wait for blackjack sound to finish, then allow turn to pass
              audioElement.onended = () => {
                console.log(`🎵 Blackjack sound finished for ${player.name}`);
                isBlackjackSoundPlayingRef.current = false; // Allow turn sound

                // Add extra delay after sound ends to prevent immediate turn sound
                setTimeout(() => {
                  console.log(`🎵 Extra delay finished for ${player.name}, turn sound can now play`);
                }, 500);
              };
            }, 100);
          }
        }
      });
    }
  }, [gameState?.players]);

  const handleLeaveGame = async () => {
    if (playerId && roomId) {
      await leaveGame(playerId);
      setJoined(false);
      setPlayerId('');
    }
  };

  const handleResetRoom = async () => {
    if (roomId && confirm('Bu oda sıfırlanacak ve tüm oyuncular çıkarılacak. Emin misiniz?')) {
      await resetRoom();
      setJoined(false);
      setPlayerId('');
    }
  };

  const handleChangeName = async () => {
    const trimmedName = newPlayerName.trim();
    if (roomId && playerId && trimmedName && trimmedName.length >= 2 && trimmedName.length <= 15) {
      try {
        await changeName(playerId, trimmedName);
        setShowNameChangeModal(false);
        setNewPlayerName('');
      } catch (error) {
        console.error('Change name error:', error);
        alert('İsim değiştirme sırasında hata oluştu!');
      }
    } else if (!trimmedName) {
      alert('Lütfen bir isim girin!');
    } else if (trimmedName.length < 2) {
      alert('İsim en az 2 karakter olmalıdır!');
    } else if (trimmedName.length > 15) {
      alert('İsim en fazla 15 karakter olabilir!');
    }
  };

  // Bahis sistemi fonksiyonları
  const handleBetPlaced = (amount: number, sessionId: string) => {
    setCurrentBet(amount);
    setCurrentSessionId(sessionId);
    setShowBetModal(false);
    setGameResult(null);
    setResultMessage('');
    setHasBet(true);
    setBetDecision('bet');
    
    // Global player bets state'ini güncelle
    if (socketId) {
      setPlayerBets(prev => ({
        ...prev,
        [socketId]: { decision: 'bet', amount: amount }
      }));

      // Socket ile diğer oyunculara bahis kararını gönder
      if (sendBetDecision && playerName) {
        sendBetDecision({
          playerId: socketId,
          amount: amount,
          hasDecided: true,
          hasBet: true,
          playerName: playerName
        });
      }
    }

    console.log(`Bahis yerleştirildi: ${amount} (Session ID: ${sessionId})`);
  };

  const handleNoBet = () => {
    setShowBetModal(false);
    setCurrentBet(0);
    setCurrentSessionId('');
    setHasBet(true);
    setBetDecision('no-bet');
    
    // Global player bets state'ini güncelle
    if (socketId) {
      setPlayerBets(prev => ({
        ...prev,
        [socketId]: { decision: 'no-bet', amount: 0 }
      }));

      // Socket ile diğer oyunculara bahis kararını gönder
      if (sendBetDecision && playerName) {
        sendBetDecision({
          playerId: socketId,
          amount: 0,
          hasDecided: true,
          hasBet: false,
          playerName: playerName
        });
      }
    }
    
    console.log('Kullanıcı bahis yapmamayı seçti');
  };

  const handleGameResult = async (result: 'win' | 'loss' | 'tie', isBlackjack: boolean = false) => {
    if (!currentSessionId || currentBet === 0) return;

    try {
      if (result === 'win') {
        const winType = isBlackjack ? 'blackjack' : 'normal';
        const success = await processWin(roomId, currentSessionId, winType);
        if (success) {
          const winAmount = isBlackjack ? currentBet * 2.5 : currentBet * 2;
          setResultMessage(`🎉 Kazandınız! ${winAmount.toLocaleString()} chip kazandınız!`);
          setGameResult('win');
        }
      } else if (result === 'loss') {
        const success = await processLoss(roomId, currentSessionId);
        if (success) {
          setResultMessage(`😞 Kaybettiniz! ${currentBet.toLocaleString()} chip kaybettiniz.`);
          setGameResult('loss');
        }
      } else if (result === 'tie') {
        // Berabere kalınca bahis geri verilir
        const success = await processTie(roomId, currentSessionId);
        if (success) {
          setResultMessage(`🤝 Berabere! Bahsiniz geri verildi.`);
          setGameResult('tie');
        }
      }
    } catch (error) {
      console.error('Game result processing error:', error);
    }
  };

  const resetBetForNewGame = () => {
    setCurrentBet(0);
    setCurrentSessionId('');
    setGameResult(null);
    setResultMessage('');
    setHasBet(false);
    setBetDecision(null);
    setPlayerBets({}); // Tüm oyuncuların bahis durumlarını sıfırla
  };

  const handleNewRound = async () => {
    // Bahisleri sıfırla
    resetBetForNewGame();
    
    // Oyunu waiting durumuna getir (resetRoom kullanarak)
    await resetRoom();
  };

  // Tüm oyuncuların bahis kararı verip vermediğini kontrol et
  const allPlayersReady = () => {
    if (!gameState?.players || gameState.players.length === 0) return false;
    
    // Tüm oyuncuların bahis kararı verip vermediğini kontrol et
    return gameState.players.every(player => {
      if (player.id === socketId) {
        return hasBet; // Kendi durumum
      } else {
        const playerBet = playerBets[player.id];
        return playerBet && playerBet.decision !== null; // Diğer oyuncuların durumu
      }
    });
  };

  const joinRoom = async () => {
    if (roomId && playerName.trim()) {
      // Error varsa temizle
      if (error) {
        // Error state'ini temizlemek için playerName'i değiştirip geri getir
        const currentName = playerName;
        setPlayerName('');
        setTimeout(() => setPlayerName(currentName), 0);
      }

      const id = `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setPlayerId(id);
      await joinGame(id);
      setJoined(true);
    }
  };

  const hit = async () => {
    if (roomId && socketId) {
      console.log('🎯 Hit button clicked, socketId:', socketId, 'isMyTurn:', isMyTurn);
      console.log('Current gameState.currentPlayer:', gameState?.currentPlayer);
      await makeMove('hit', socketId);
    } else {
      console.log('❌ Hit failed - roomId:', roomId, 'socketId:', socketId);
    }
  };

  const stand = async () => {
    if (roomId && socketId) {
      console.log('🛑 Stand button clicked, socketId:', socketId, 'isMyTurn:', isMyTurn);
      console.log('Current gameState.currentPlayer:', gameState?.currentPlayer);
      await makeMove('stand', socketId);
    } else {
      console.log('❌ Stand failed - roomId:', roomId, 'socketId:', socketId);
    }
  };

  const doubleDown = async () => {
    if (roomId && socketId) {
      console.log('🎰 Double down button clicked, socketId:', socketId, 'isMyTurn:', isMyTurn);
      console.log('Current gameState.currentPlayer:', gameState?.currentPlayer);
      await makeMove('double-down', socketId);
    } else {
      console.log('❌ Double down failed - roomId:', roomId, 'socketId:', socketId);
    }
  };

  const renderCard = (card: Card) => {
    const suitSymbols = {
      hearts: '♥',
      diamonds: '♦',
      clubs: '♣',
      spades: '♠'
    };
    const suitColors = {
      hearts: 'text-red-600',
      diamonds: 'text-red-600',
      clubs: 'text-black',
      spades: 'text-black'
    };

    return (
      <div className="bg-white border-2 border-gray-300 rounded-lg p-3 m-2 text-center shadow-lg transform hover:scale-105 transition-transform duration-200 min-w-[60px] min-h-[80px] flex flex-col justify-between">
        <div className="text-xl font-bold text-gray-800">{card.value}</div>
        <div className={`text-2xl ${suitColors[card.suit as keyof typeof suitColors]}`}>
          {suitSymbols[card.suit as keyof typeof suitSymbols]}
        </div>
      </div>
    );
  };

  const renderCardBack = () => {
    return (
      <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 border-2 border-blue-400 rounded-lg p-3 m-2 text-center shadow-lg transform hover:scale-105 transition-transform duration-200 min-w-[60px] min-h-[80px] flex flex-col justify-center items-center">
        <div className="text-white text-2xl font-bold">♠</div>
        <div className="text-white text-xs">CASINO</div>
        <div className="text-white text-2xl font-bold rotate-180">♠</div>
      </div>
    );
  };

  if (!joined) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-900 via-green-800 to-green-900 flex items-center justify-center p-4">
        {/* Back to Menu Button */}
        <div className="absolute top-4 left-4 flex gap-3">
          <Link
            href="/"
            onClick={handleLeaveGame}
            className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 rounded-full font-bold text-lg hover:from-blue-700 hover:to-blue-800 shadow-2xl hover:shadow-3xl transform hover:-translate-y-1 transition-all duration-300 flex items-center"
          >
            <span className="text-xl mr-2">⬅️</span>
            ANA MENÜ
          </Link>
          <button
            onClick={handleResetRoom}
            className="bg-gradient-to-r from-red-600 to-red-700 text-white px-4 py-3 rounded-full font-bold text-sm hover:from-red-700 hover:to-red-800 shadow-2xl hover:shadow-3xl transform hover:-translate-y-1 transition-all duration-300 flex items-center"
          >
            <span className="text-lg mr-2">🔄</span>
            SIFIRLA
          </button>
        </div>

        <div className="bg-gradient-to-br from-yellow-50 via-white to-yellow-100 p-8 rounded-2xl shadow-2xl border-4 border-yellow-400 max-w-lg w-full backdrop-blur-sm">
          <div className="text-center mb-8">
            <h1 className="text-5xl font-bold text-gray-900 mb-3 drop-shadow-lg">🎰 Blackjack</h1>
            <p className="text-gray-700 text-lg font-medium">Arkadaşlarınla oyna ve kazan!</p>
            <p className="text-gray-600 text-sm mt-2">Oda: <span className="font-bold text-green-700">{roomId}</span></p>
            {userProfile && (
              <p className="text-green-600 text-sm mt-2">👤 Hoş geldin, <span className="font-bold">{userProfile.username}</span>!</p>
            )}
          </div>
          <div className="space-y-6">
            {error && (
              <div className="bg-red-100 border-2 border-red-400 text-red-800 px-4 py-3 rounded-lg font-medium">
                <div className="flex items-center">
                  <span className="text-red-600 text-xl mr-2">⚠️</span>
                  <span>{error}</span>
                </div>
              </div>
            )}
            {!userProfile ? (
              <div className="bg-blue-100 border-2 border-blue-400 text-blue-800 px-4 py-3 rounded-lg font-medium text-center">
                <div className="flex items-center justify-center">
                  <span className="text-blue-600 text-xl mr-2">🔄</span>
                  <span>Kullanıcı profili yükleniyor...</span>
                </div>
              </div>
            ) : (
              <div className="bg-green-100 border-2 border-green-400 text-green-800 px-4 py-3 rounded-lg font-medium text-center">
                <div className="flex items-center justify-center">
                  <span className="text-green-600 text-xl mr-2">✅</span>
                  <span>Otomatik olarak oyuna katılıyor...</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-900 via-green-800 to-green-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-yellow-400 mx-auto mb-4"></div>
          <h2 className="text-2xl font-bold text-white mb-2">🎰 Oyun Hazırlanıyor</h2>
          <p className="text-yellow-200">Arkadaşlarının katılmasını bekliyoruz...</p>
        </div>
      </div>
    );
  }

  const copyInviteLink = async () => {
    const currentUrl = window.location.href;
    try {
      await navigator.clipboard.writeText(currentUrl);
      alert('🎉 Davet linki kopyalandı! Arkadaşlarını davet etmek için linki paylaşabilirsin.');
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = currentUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert('🎉 Davet linki kopyalandı! Arkadaşlarını davet etmek için linki paylaşabilirsin.');
    }
  };

  console.log('🎮 Game State:', gameState);
  console.log('🎯 Is My Turn:', isMyTurn);
  console.log('🔑 Socket ID:', socketId);
  console.log('👤 Player ID:', playerId);
  console.log('🎲 Current Player Data:', currentPlayerData);
  console.log('🎲 Current Player Status:', currentPlayerData?.status);
  console.log('🎲 Current Player Blackjack:', currentPlayerData?.isBlackjack);

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-900 via-green-800 to-green-900 p-4 relative">
      {/* Invite Button - Top Left Corner (only when waiting) */}
      {gameState?.gameState === 'waiting' && (
        <div className="absolute top-4 left-4 z-10">
          <button
            onClick={copyInviteLink}
            className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 rounded-xl font-bold text-sm hover:from-blue-700 hover:to-blue-800 shadow-2xl hover:shadow-3xl transform hover:-translate-y-1 transition-all duration-300 flex items-center space-x-2"
          >
            <span className="text-lg">👥</span>
            <span>ARKADAŞLARINI DAVET ET</span>
          </button>
        </div>
      )}

      {/* Scoreboard - Top Right Corner */}
      <div className="absolute top-4 right-4 z-10 w-80">
        <Scoreboard
          scoreboard={(() => {
            // Oyun sonucu varsa oradan al, yoksa oyuncuların winnings değerlerinden oluştur
            if (gameState?.results?.scoreboard && gameState.results.scoreboard.length > 0) {
              return gameState.results.scoreboard;
            } else if (gameState?.players) {
              // Oyuncuların winnings değerlerinden scoreboard oluştur
              const scoreboardFromPlayers = gameState.players
                .filter((player: Player) => (player.winnings || 0) > 0)
                .map((player: Player) => ({
                  id: player.id,
                  name: player.name,
                  winnings: player.winnings || 0,
                  isDealer: false
                }))
                .sort((a, b) => b.winnings - a.winnings);

              return scoreboardFromPlayers;
            }
            return [];
          })()}
          className="shadow-2xl"
        />

        {/* Sound Volume Control */}
        <SoundVolumeControl
          onVolumeChange={(volume) => {
            if (turnSoundRef.current) {
              turnSoundRef.current.volume = volume;
            }
            if (blackjackSoundRef.current) {
              blackjackSoundRef.current.volume = volume;
            }
          }}
          className="mt-4"
        />
      </div>

      <div className="max-w-6xl mx-auto">
        {/* Back to Menu Button */}
        <div className="mb-4 flex gap-3">
          <Link
            href="/"
            onClick={handleLeaveGame}
            className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-2 rounded-full font-bold text-sm hover:from-blue-700 hover:to-blue-800 shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300 flex items-center inline-flex"
          >
            <span className="text-lg mr-2">⬅️</span>
            ANA MENÜ
          </Link>
          <button
            onClick={handleResetRoom}
            className="bg-gradient-to-r from-red-600 to-red-700 text-white px-4 py-2 rounded-full font-bold text-sm hover:from-red-700 hover:to-red-800 shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300 flex items-center inline-flex"
          >
            <span className="text-lg mr-2">🔄</span>
            SIFIRLA
          </button>
        </div>

        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-5xl font-bold text-yellow-400 mb-2 drop-shadow-lg">🎰 BLACKJACK</h1>
          <div className="bg-black bg-opacity-50 rounded-lg p-4 inline-block">
            <p className="text-yellow-200 font-semibold">Oda: <span className="text-white">{gameState.roomId}</span></p>
            <p className="text-yellow-200 font-semibold">Durum: <span className="text-white capitalize">{gameState.gameState}</span></p>
          </div>
        </div>

        {/* Dealer's hand */}
        <div className="bg-gradient-to-r from-red-900 to-red-800 p-6 rounded-xl mb-6 shadow-2xl border-4 border-yellow-400">
          <h2 className="text-2xl font-bold text-yellow-400 mb-4 text-center">🏠 KRUPİYER</h2>
          
          {/* Krupiye Kasa Bilgisi */}
          <div className="bg-black bg-opacity-30 rounded-lg p-3 mb-4">
            <div className="flex flex-col sm:flex-row items-center justify-center space-y-2 sm:space-y-0 sm:space-x-6">
              <div className="flex items-center space-x-2">
                <span className="text-yellow-300 font-bold text-sm sm:text-base">🏠</span>
                <span className="text-yellow-300 font-bold text-sm sm:text-base">Casino Krupiyeri</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-green-300 font-bold text-sm sm:text-base">💰 Ev Kasası:</span>
                <span className="text-lg sm:text-xl font-bold text-green-400">
                  {gameRoom?.house_chips ? gameRoom.house_chips.toLocaleString() : '---'}
                </span>
                <span className="text-green-400 text-lg sm:text-xl">💎</span>
              </div>
              {userProfile && (
                <div className="flex items-center space-x-2">
                  <span className="text-blue-300 font-bold text-sm sm:text-base">🫵 Sen:</span>
                  <span className="text-lg sm:text-xl font-bold text-blue-400">{userProfile.chips.toLocaleString()}</span>
                  <span className="text-blue-400 text-lg sm:text-xl">💎</span>
                </div>
              )}
              {currentBet > 0 && (
                <div className="flex items-center space-x-2">
                  <span className="text-purple-300 font-bold text-sm sm:text-base">🎯 Bahis:</span>
                  <span className="text-lg sm:text-xl font-bold text-purple-400">{currentBet.toLocaleString()}</span>
                  <span className="text-purple-400 text-lg sm:text-xl">💎</span>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex justify-center flex-wrap relative">
            {gameState.dealer.hand.map((card: Card, index: number) => (
              <div
                key={index}
                className={`transition-transform duration-700 relative ${index === 1 && !gameState.dealer.hiddenCard ? 'animate-card-flip' : ''}`}
              >
                {index === 1 && gameState.dealer.hiddenCard ? renderCardBack() : renderCard(card)}
                {gameState.dealer.isBlackjack && index === gameState.dealer.hand.length - 1 && !gameState.dealer.hiddenCard && (
                  <div className="absolute -top-2 -right-2 bg-gradient-to-r from-yellow-400 to-yellow-600 text-black font-bold text-xs px-2 py-1 rounded-full shadow-lg border-2 border-yellow-300 animate-pulse">
                    BLACKJACK!
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="text-center mt-4">
            <p className="text-yellow-300 text-lg font-semibold">Skor: <span className="text-white text-xl">{gameState.dealer.visibleScore}</span></p>
            {gameState.dealer.isBlackjack && !gameState.dealer.hiddenCard && (
              <p className="text-red-400 text-xl font-bold animate-pulse">🃏 BLACKJACK! 🃏</p>
            )}
          </div>
        </div>

        {/* Players */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {gameState.players.map((player: Player) => {
            // Determine player result for styling
            let resultStyle = '';
            let resultIcon = '';
            let resultText = '';

            if (gameState.gameState === 'finished' as string && gameState.results) {
              const isWinner = gameState.results.winners.some((w: { id: string; name: string; reason: string }) => w.id === player.id);
              const isLoser = gameState.results.losers.some((l: { id: string; name: string; reason: string }) => l.id === player.id);
              const isTie = gameState.results.ties.some((t: { id: string; name: string; reason: string }) => t.id === player.id);

              // Bahis sistemi entegrasyonu - sadece kendi oyuncumuz için
              if (player.id === socketId && currentBet > 0 && !gameResult) {
                if (isWinner) {
                  const winnerInfo = gameState.results.winners.find((w: { id: string; name: string; reason: string }) => w.id === player.id);
                  const isBlackjack = winnerInfo?.reason === 'blackjack';
                  handleGameResult('win', isBlackjack);
                } else if (isLoser) {
                  handleGameResult('loss');
                } else if (isTie) {
                  handleGameResult('tie');
                }
              }

              if (isWinner) {
                resultStyle = 'border-green-500 bg-gradient-to-br from-green-100 to-green-200 ring-4 ring-green-300';
                resultIcon = '🏆';
                const winnerInfo = gameState.results.winners.find((w: { id: string; name: string; reason: string }) => w.id === player.id);
                if (winnerInfo?.reason === 'blackjack') {
                  resultText = '🎉 BLACKJACK!';
                } else {
                  resultText = 'Kazandın!';
                }
              } else if (isLoser) {
                resultStyle = 'border-red-500 bg-gradient-to-br from-red-100 to-red-200 ring-4 ring-red-300';
                resultIcon = '❌';
                const loserInfo = gameState.results.losers.find((l: { id: string; name: string; reason: string }) => l.id === player.id);
                if (loserInfo?.reason === 'dealer_blackjack') {
                  resultText = 'Krupiyer Blackjack!';
                } else {
                  resultText = 'Kaybettin!';
                }
              } else if (isTie) {
                resultStyle = 'border-blue-500 bg-gradient-to-br from-blue-100 to-blue-200 ring-4 ring-blue-300';
                resultIcon = '🤝';
                const tieInfo = gameState.results.ties.find((t: { id: string; name: string; reason: string }) => t.id === player.id);
                if (tieInfo?.reason === 'blackjack_push') {
                  resultText = 'Blackjack Berabere!';
                } else {
                  resultText = 'Berabere!';
                }
              }
            }

            return (
              <div key={player.id} className={`p-6 rounded-xl shadow-xl border-2 transition-all duration-300 ${
                player.isBlackjack
                  ? 'border-yellow-500 ring-4 ring-yellow-300 bg-gradient-to-br from-yellow-50 via-yellow-100 to-yellow-200 shadow-yellow-200'
                  : gameState.gameState === 'finished' as string && resultStyle
                    ? resultStyle
                    : isMyTurn && player.id === socketId
                      ? 'border-yellow-500 ring-4 ring-yellow-300 bg-gradient-to-br from-yellow-50 to-yellow-100'
                      : 'border-gray-300 bg-gradient-to-br from-gray-100 to-gray-200'
              }`}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xl font-bold text-gray-800">
                    {player.name}
                    {player.id === socketId && <span className="text-blue-600 ml-2">(Sen)</span>}
                    {player.isBlackjack && <span className="text-yellow-600 ml-2 text-lg animate-pulse">👑</span>}
                    {isMyTurn && player.id === socketId && <span className="text-yellow-600 ml-2">🎯</span>}
                    {resultIcon && <span className="ml-2 text-2xl">{resultIcon}</span>}
                  </h3>
                  <div className="flex items-center space-x-2">
                    <p className="text-gray-700 font-semibold">Skor: <span className="text-lg text-gray-900">{player.score}</span></p>
                    {player.isBlackjack && (
                      <span className="text-yellow-500 text-xl animate-pulse">⭐</span>
                    )}
                  </div>
                </div>
                {player.id === socketId && (
                  <div className="text-center mb-3">
                    <button
                      onClick={() => {
                        setShowNameChangeModal(true);
                        setNewPlayerName(player.name);
                      }}
                      className="bg-gradient-to-r from-purple-600 to-purple-700 text-white px-3 py-1 rounded-lg font-bold text-sm hover:from-purple-700 hover:to-purple-800 shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200"
                    >
                      ✏️ İsim Değiştir
                    </button>
                  </div>
                )}
                <div className="flex justify-center flex-wrap mb-4 relative">
                  {player.hand.map((card: Card, index: number) => (
                    <div key={index} className="relative">
                      {renderCard(card)}
                      {player.isBlackjack && index === player.hand.length - 1 && (
                        <div className="absolute -top-4 -right-4 bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600 text-black font-bold text-sm px-3 py-2 rounded-full shadow-2xl border-3 border-yellow-300 animate-bounce transform rotate-12">
                          🎉 BLACKJACK! 🎉
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="text-center space-y-1">
                  {/* Hit/Stand/Double Down buttons for current player */}
                  {isMyTurn && player.id === socketId && currentPlayerData?.status === 'playing' && !currentPlayerData?.isBlackjack && (
                    <div className="flex items-center justify-center space-x-2 mb-2">
                      <button
                        onClick={hit}
                        className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-3 py-2 rounded-lg font-bold text-xs hover:from-blue-700 hover:to-blue-800 shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200 border border-blue-500 flex items-center space-x-1"
                      >
                        <span className="text-sm">🃏</span>
                        <span>HIT</span>
                      </button>
                      <button
                        onClick={stand}
                        className="bg-gradient-to-r from-red-600 to-red-700 text-white px-3 py-2 rounded-lg font-bold text-xs hover:from-red-700 hover:to-red-800 shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200 border border-red-500 flex items-center space-x-1"
                      >
                        <span className="text-sm">✋</span>
                        <span>STAND</span>
                      </button>
                      {/* Double Down button - only show if player has exactly 2 cards */}
                      {player.hand.length === 2 && (
                        <button
                          onClick={doubleDown}
                          className="bg-gradient-to-r from-purple-600 to-purple-700 text-white px-3 py-2 rounded-lg font-bold text-xs hover:from-purple-700 hover:to-purple-800 shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200 border border-purple-500 flex items-center space-x-1"
                        >
                          <span className="text-sm">🎰</span>
                          <span>DOUBLE</span>
                        </button>
                      )}
                    </div>
                  )}
                  {/* Bahis Bilgileri - Herkes için görünür */}
                  <div className="mt-3 p-3 bg-gradient-to-r from-purple-100 to-blue-100 rounded-lg border border-purple-300">
                    {/* Bahis Durumu */}
                    <div className="flex items-center justify-center mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="text-purple-700 font-bold">💰 Aktif Bahis:</span>
                        {gameState?.gameState === 'playing' ? (
                          // Oyun sırasında gerçek bet miktarını göster
                          player.bet > 0 ? (
                            <span className="text-lg font-bold text-green-700">
                              {player.bet.toLocaleString()} 💎
                              {player.hasDoubledDown && <span className="text-purple-600 ml-1">🎰2x</span>}
                            </span>
                          ) : (
                            <span className="text-lg font-bold text-orange-700">🚫 Yok</span>
                          )
                        ) : (
                          // Oyun öncesi/sonrası bahis durumu
                          player.id === socketId ? (
                            // Kendi bahis durumum
                            hasBet ? (
                              betDecision === 'bet' ? (
                                <span className="text-lg font-bold text-green-700">{currentBet.toLocaleString()} 💎</span>
                              ) : (
                                <span className="text-lg font-bold text-orange-700">🚫 Yok</span>
                              )
                            ) : (
                              <span className="text-lg font-bold text-gray-600">⏳</span>
                            )
                          ) : (
                            // Diğer oyuncuların bahis durumu - global state'ten al
                            (() => {
                              const playerBet = playerBets[player.id];
                              if (!playerBet || playerBet.decision === null) {
                                return <span className="text-lg font-bold text-gray-600">⏳</span>;
                              } else if (playerBet.decision === 'bet') {
                                return <span className="text-lg font-bold text-green-700">{playerBet.amount.toLocaleString()} 💎</span>;
                              } else {
                                return <span className="text-lg font-bold text-orange-700">🚫 Yok</span>;
                              }
                            })()
                          )
                        )}
                      </div>
                    </div>
                    
                    {/* Bahis Butonları - Sadece kendi için */}
                    {player.id === socketId && joined && userProfile && (gameState?.gameState === 'waiting' || gameState?.gameState === 'finished') && !hasBet && (
                      <button
                        onClick={() => setShowBetModal(true)}
                        className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 text-black px-4 py-2 rounded-lg font-bold text-sm hover:from-yellow-600 hover:to-yellow-700 shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200 border-2 border-yellow-400"
                      >
                        🎯 Bahis Yap
                      </button>
                    )}
                  </div>
                  <p className="text-gray-600 capitalize font-medium">
                    {player.status === 'playing' && player.isBlackjack && '👑 BLACKJACK!'}
                    {player.status === 'playing' && !player.isBlackjack && '🃏 Oynuyor'}
                    {player.status === 'stood' && player.isBlackjack && '🎉 Blackjack & Durdu'}
                    {player.status === 'stood' && !player.isBlackjack && (
                      // Check if this is a double down by checking if bet is doubled and only 3 cards
                      (player.bet && player.hand.length === 3 && gameState?.gameState === 'playing') ? 
                      '🎰 Double Down & Durdu' : 
                      '✋ Durdu'
                    )}
                    {player.status === 'busted' && (
                      // Check if this is a double down bust
                      (player.bet && player.hand.length === 3 && gameState?.gameState === 'playing') ?
                      '🎰💥 Double Down & Battı' :
                      '💥 Battı'
                    )}
                  </p>
                  {resultText && (
                    <p className="text-lg font-bold mt-2" style={{
                      color: resultText === 'Kazandın!' ? '#16a34a' :
                             resultText === 'Kaybettin!' ? '#dc2626' : '#2563eb'
                    }}>
                      {resultText}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Game controls */}
        {gameState.gameState === 'waiting' as string && (
          <div className="text-center">
            <button
              onClick={startGame}
              disabled={isLoading || !allPlayersReady()}
              className={`px-8 py-4 rounded-xl font-bold text-lg shadow-2xl hover:shadow-3xl transform hover:-translate-y-1 transition-all duration-200 border-2 ${
                isLoading || !allPlayersReady()
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed border-gray-500'
                  : 'bg-gradient-to-r from-green-600 to-green-700 text-white hover:from-green-700 hover:to-green-800 border-green-500'
              }`}
            >
              {isLoading 
                ? '🎲 Oyun Başlatılıyor...' 
                : !allPlayersReady() 
                ? '⏳ Bahis Kararları Bekleniyor...' 
                : '🎲 Oyunu Başlat'
              }
            </button>
            {!allPlayersReady() && (
              <p className="text-yellow-300 text-sm mt-2">
                Tüm oyuncuların bahis kararı vermesi bekleniyor
              </p>
            )}
          </div>
        )}

        {gameState.gameState === 'playing' as string && isMyTurn && currentPlayerData?.isBlackjack && (
          <div className="text-center">
            <p className="text-green-400 text-xl font-bold animate-pulse">🃏 BLACKJACK! Otomatik olarak bekleniyor...</p>
          </div>
        )}

        {/* Name Change Modal */}
        {showNameChangeModal && (
          <div className="fixed inset-0 backdrop-blur-sm bg-black bg-opacity-20 flex items-center justify-center z-40 p-4">
            <div className="bg-gradient-to-br from-purple-600 via-purple-700 to-purple-800 bg-opacity-95 backdrop-blur-sm rounded-2xl p-8 max-w-md w-full shadow-2xl border-4 border-purple-400 animate-modal-appear">
              <h3 className="text-2xl font-bold text-white mb-6 text-center drop-shadow-lg">✏️ İsim Değiştir</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-white mb-2 drop-shadow">Yeni İsminiz</label>
                  <input
                    type="text"
                    placeholder="Yeni adınızı girin (max 15 karakter)"
                    value={newPlayerName}
                    onChange={(e) => setNewPlayerName(e.target.value.slice(0, 15))}
                    maxLength={15}
                    className="w-full p-4 border-3 border-purple-300 rounded-xl bg-white text-gray-900 placeholder:text-gray-500 focus:border-purple-500 focus:ring-4 focus:ring-purple-200 focus:outline-none transition-all duration-200 shadow-lg text-lg font-medium"
                  />
                  <p className="text-xs text-purple-200 mt-1 drop-shadow">{newPlayerName.length}/15 karakter</p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleChangeName}
                    disabled={!newPlayerName.trim() || newPlayerName.trim().length < 2 || newPlayerName.length > 15}
                    className="flex-1 bg-gradient-to-r from-green-500 to-green-600 text-white p-4 rounded-xl font-bold text-lg hover:from-green-600 hover:to-green-700 disabled:from-gray-500 disabled:to-gray-600 disabled:text-gray-300 disabled:cursor-not-allowed transition-all duration-200 shadow-xl hover:shadow-2xl transform hover:-translate-y-1 border-2 border-green-400"
                  >
                    ✅ Değiştir
                  </button>
                  <button
                    onClick={() => {
                      setShowNameChangeModal(false);
                      setNewPlayerName('');
                    }}
                    className="flex-1 bg-gradient-to-r from-gray-600 to-gray-700 text-white p-4 rounded-xl font-bold text-lg hover:from-gray-700 hover:to-gray-800 transition-all duration-200 shadow-xl hover:shadow-2xl transform hover:-translate-y-1 border-2 border-gray-500"
                  >
                    ❌ İptal
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Chat Component */}
        <ChatComponent
          roomId={roomId}
          playerName={playerName}
        />

        {gameState.gameState === 'finished' as string && gameState.results && (
          <div className="fixed inset-0 backdrop-blur-sm bg-opacity-30 flex items-center justify-center z-30 p-4">
            <div className="max-w-4xl max-h-[90vh] overflow-y-auto p-6 bg-gradient-to-br from-yellow-400 via-yellow-500 to-yellow-600 text-black rounded-3xl shadow-2xl border-4 border-yellow-300 animate-modal-slide-down">
              {/* Header */}
              <div className="text-center mb-6">
                <h2 className="text-4xl font-bold mb-2 drop-shadow-lg">🎉 OYUN SONUCU</h2>
                <div className="w-24 h-1 bg-black mx-auto rounded-full"></div>
              </div>

                {/* Dealer Result - Hero Section */}
                <div className="mb-8 p-6 bg-gradient-to-r from-black via-gray-900 to-black rounded-2xl border-4 border-yellow-400 shadow-2xl">
                  <div className="text-center">
                    <h3 className="text-3xl font-bold mb-4 text-yellow-300 flex items-center justify-center">
                      🏠 KRUPİYER
                      {gameState.dealer.isBlackjack && <span className="ml-3 text-yellow-400 text-2xl animate-pulse">♠♥</span>}
                    </h3>
                    <div className="text-7xl font-bold text-white mb-4 drop-shadow-lg">
                      {gameState.dealer.visibleScore}
                    </div>
                    {gameState.dealer.isBlackjack && (
                      <div className="animate-pulse mb-4">
                        <p className="text-yellow-400 font-bold text-3xl mb-2">🎊 BLACKJACK!</p>
                        <p className="text-yellow-200 text-lg">Krupiyer 21 yaptı!</p>
                      </div>
                    )}
                    {gameState.results.dealerBusted && (
                      <div className="animate-pulse">
                        <p className="text-red-400 font-bold text-2xl mb-2">💥 BATTI!</p>
                      </div>
                    )}
                    {!gameState.results.dealerBusted && !gameState.dealer.isBlackjack && gameState.dealer.score <= 21 && (
                      <p className="text-green-400 font-bold text-xl">✅ {gameState.dealer.visibleScore} ile durdu</p>
                    )}
                  </div>
                </div>

                {/* Results Grid */}
                <div className="grid md:grid-cols-3 gap-4 mb-8">
                  {/* Winners */}
                  {gameState.results.winners.length > 0 && (
                    <div className="bg-gradient-to-br from-green-100 to-green-200 p-4 rounded-2xl border-4 border-green-400 shadow-xl">
                      <h4 className="text-xl font-bold text-green-800 mb-3 text-center flex items-center justify-center">
                        <span className="text-2xl mr-2">🏆</span>
                        {gameState.results.winners.some((w: { id: string; name: string; reason: string }) => w.reason === 'blackjack') ? 'BLACKJACK KAZANAN!' : 'KAZANAN'}
                      </h4>
                      <div className="space-y-2">
                        {gameState.results.winners.map((winner: { id: string; name: string; reason: string }) => {
                          console.log('Winner:', winner.name, 'Reason:', winner.reason);
                          return (
                          <div key={winner.id} className="bg-white p-3 rounded-lg border-2 border-green-300 shadow-sm">
                            <div className="font-bold text-sm text-green-900 flex items-center justify-center">
                              {winner.name}
                              {winner.reason === 'blackjack' && <span className="ml-2 text-yellow-600 text-lg animate-pulse">♠♥</span>}
                            </div>
                            <div className="text-green-700 text-xs mt-1 text-center font-bold">
                              {winner.reason === 'dealer_busted' && '🎉 Krupiyer Battı!'}
                              {winner.reason === 'higher_score' && '📈 Yüksek Skor!'}
                              {winner.reason === 'blackjack' && '🎊 BLACKJACK!'}
                            </div>
                          </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Losers */}
                  {gameState.results.losers.length > 0 && (
                    <div className="bg-gradient-to-br from-red-100 to-red-200 p-4 rounded-2xl border-4 border-red-400 shadow-xl">
                      <h4 className="text-xl font-bold text-red-800 mb-3 text-center flex items-center justify-center">
                        <span className="text-2xl mr-2">❌</span>
                        KAYBEDEN
                      </h4>
                      <div className="space-y-2">
                        {gameState.results.losers.map((loser: { id: string; name: string; reason: string }) => (
                          <div key={loser.id} className="bg-white p-3 rounded-lg border-2 border-red-300 shadow-sm">
                            <div className="font-bold text-sm text-red-900">{loser.name}</div>
                            <div className="text-red-700 text-xs mt-1 text-center">
                              {loser.reason === 'busted' && '💥 Battı!'}
                              {loser.reason === 'lower_score' && '📉 Düşük Skor!'}
                              {loser.reason === 'dealer_blackjack' && '🏠 Krupiyer Blackjack!'}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Ties */}
                  {gameState.results.ties.length > 0 && (
                    <div className="bg-gradient-to-br from-blue-100 to-blue-200 p-4 rounded-2xl border-4 border-blue-400 shadow-xl">
                      <h4 className="text-xl font-bold text-blue-800 mb-3 text-center flex items-center justify-center">
                        <span className="text-2xl mr-2">🤝</span>
                        BERABERE
                      </h4>
                      <div className="space-y-2">
                        {gameState.results.ties.map((tie: { id: string; name: string; reason: string }) => (
                          <div key={tie.id} className="bg-white p-3 rounded-lg border-2 border-blue-300 shadow-sm">
                            <div className="font-bold text-sm text-blue-900 flex items-center justify-center">
                              {tie.name}
                              {tie.reason === 'blackjack_push' && <span className="ml-2 text-yellow-600 text-lg">♠♥</span>}
                            </div>
                            <div className="text-blue-700 text-xs mt-1 text-center">
                              {tie.reason === 'tie' && '⚖️ Eşit Skor!'}
                              {tie.reason === 'blackjack_push' && '🎭 Blackjack Berabere!'}
                              {tie.reason === 'both_busted' && '💥 İkisi de Battı - Para Geri Verildi!'}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Current Scores Display */}
                {(gameState.results as GameResults)?.scoreboard && (gameState.results as GameResults)?.scoreboard!.length > 0 && (
                  <div className="mt-8 p-6 bg-gradient-to-br from-purple-900 via-purple-800 to-purple-900 rounded-2xl border-4 border-purple-400 shadow-2xl">
                    <h3 className="text-2xl font-bold text-purple-300 mb-4 text-center flex items-center justify-center">
                      <span className="text-3xl mr-3">💰</span>
                      GÜNCEL SKORLAR
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {(gameState.results as GameResults)?.scoreboard!.map((entry: ScoreboardEntry, index: number) => (
                        <div
                          key={entry.id}
                          className={`p-4 rounded-xl border-2 text-center transition-all duration-300 ${
                            entry.isDealer
                              ? 'bg-gradient-to-r from-red-800 to-red-700 border-red-500'
                              : index === 0 && (gameState.results as GameResults)?.scoreboard!.length > 1
                                ? 'bg-gradient-to-r from-yellow-800 to-yellow-700 border-yellow-500 animate-pulse'
                                : 'bg-gradient-to-r from-gray-700 to-gray-600 border-gray-500'
                          }`}
                        >
                          <div className={`text-lg font-bold mb-2 ${
                            entry.isDealer ? 'text-red-300' : 'text-white'
                          }`}>
                            {entry.name}
                          </div>
                          <div className="flex items-center justify-center space-x-2">
                            <span className={`text-2xl font-bold ${
                              entry.isDealer ? 'text-red-400' : 'text-green-400'
                            }`}>
                              {entry.winnings}
                            </span>
                            <span className="text-yellow-400 text-xl">💰</span>
                          </div>
                          {index === 0 && (gameState.results as GameResults)?.scoreboard!.length > 1 && !entry.isDealer && (
                            <div className="text-yellow-300 text-sm font-bold mt-1">👑 Lider</div>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 text-center">
                      <p className="text-purple-200 text-sm">
                        🎯 Blackjack: 2 puan • 🏆 Normal kazanma: 1 puan
                      </p>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  {gameState.gameState === 'finished' as string && (
                    <button
                      onClick={handleNewRound}
                      disabled={isLoading}
                      className="bg-gradient-to-r from-green-600 to-green-700 text-white px-10 py-5 rounded-2xl font-bold text-xl hover:from-green-700 hover:to-green-800 disabled:from-gray-500 disabled:to-gray-600 disabled:text-gray-300 disabled:cursor-not-allowed shadow-2xl hover:shadow-3xl transform hover:-translate-y-2 transition-all duration-300 border-4 border-green-500 flex items-center justify-center"
                    >
                      <span className="text-2xl mr-3">🎯</span>
                      {isLoading ? 'Hazırlanıyor...' : 'YENİ TUR'}
                    </button>
                  )}
                  <Link
                    href="/"
                    onClick={handleLeaveGame}
                    className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-10 py-5 rounded-2xl font-bold text-xl hover:from-blue-700 hover:to-blue-800 shadow-2xl hover:shadow-3xl transform hover:-translate-y-2 transition-all duration-300 border-4 border-blue-500 flex items-center justify-center"
                  >
                    <span className="text-2xl mr-3">⬅️</span>
                    ANA MENÜ
                  </Link>
                  <button
                    onClick={handleResetRoom}
                    className="bg-gradient-to-r from-red-600 to-red-700 text-white px-10 py-5 rounded-2xl font-bold text-xl hover:from-red-700 hover:to-red-800 shadow-2xl hover:shadow-3xl transform hover:-translate-y-2 transition-all duration-300 border-4 border-red-500 flex items-center justify-center"
                  >
                    <span className="text-2xl mr-3">🔄</span>
                    ODAYI SIFIRLA
                  </button>
                </div>
              </div>
            </div>
        )}
      </div>

      {/* Hidden audio element for turn notification */}
      <audio
        ref={turnSoundRef}
        src="/guitar-riff.wav"
        preload="auto"
        style={{ display: 'none' }}
      />

      {/* Hidden audio element for blackjack sound */}
      <audio
        ref={blackjackSoundRef}
        src="/blackjack.wav"
        preload="auto"
        style={{ display: 'none' }}
      />

      {/* Bahis Modal */}
      {showBetModal && (
        <div className="fixed inset-0 backdrop-blur-sm bg-opacity-20 flex items-center justify-center z-50 p-4">
          <BetPlacement
            roomId={roomId}
            gameType="blackjack"
            onBetPlaced={handleBetPlaced}
            onNoBet={handleNoBet}
            onClose={() => setShowBetModal(false)}
            minBet={10}
            maxBet={1000}
          />
        </div>
      )}
    </div>
  );
}
