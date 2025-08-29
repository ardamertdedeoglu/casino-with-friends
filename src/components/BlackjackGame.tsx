'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { usePollingGame } from '../lib/usePollingGame';

interface Card {
  suit: string;
  value: string;
}

interface Player {
  id: string;
  name: string;
  hand: Card[];
  score: number;
  bet: number;
  status: string;
  isBlackjack?: boolean;
}

interface GameState {
  roomId: string;
  players: Player[];
  dealer: { hand: Card[]; score: number; hiddenCard: boolean; isBlackjack?: boolean };
  gameState: string;
  currentPlayer: string;
  results?: {
    dealerBusted: boolean;
    dealerBlackjack?: boolean;
    winners: Array<{ id: string; name: string; reason: string }>;
    losers: Array<{ id: string; name: string; reason: string }>;
    ties: Array<{ id: string; name: string; reason: string }>;
  } | null;
}

export default function BlackjackGame() {
  const params = useParams();
  const roomId = params.roomId as string;
  const [playerName, setPlayerName] = useState('');
  const [joined, setJoined] = useState(false);
  const [playerId, setPlayerId] = useState('');
  const { gameState, joinGame, makeMove, isLoading } = usePollingGame(roomId, playerName);

  const joinRoom = async () => {
    if (roomId && playerName) {
      const id = `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setPlayerId(id);
      await joinGame(id);
      setJoined(true);
    }
  };

  const startGame = async () => {
    if (roomId) {
      await makeMove('start');
    }
  };

  const hit = async () => {
    if (roomId && playerId) {
      await makeMove('hit', playerId);
    }
  };

  const stand = async () => {
    if (roomId && playerId) {
      await makeMove('stand', playerId);
    }
  };

  const restartGame = async () => {
    if (roomId) {
      await makeMove('restart');
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
        <div className="absolute top-4 left-4">
          <Link
            href="/"
            className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 rounded-full font-bold text-lg hover:from-blue-700 hover:to-blue-800 shadow-2xl hover:shadow-3xl transform hover:-translate-y-1 transition-all duration-300 flex items-center"
          >
            <span className="text-xl mr-2">⬅️</span>
            ANA MENÜ
          </Link>
        </div>

        <div className="bg-gradient-to-br from-yellow-50 via-white to-yellow-100 p-8 rounded-2xl shadow-2xl border-4 border-yellow-400 max-w-lg w-full backdrop-blur-sm">
          <div className="text-center mb-8">
            <h1 className="text-5xl font-bold text-gray-900 mb-3 drop-shadow-lg">🎰 Blackjack</h1>
            <p className="text-gray-700 text-lg font-medium">Arkadaşlarınla oyna ve kazan!</p>
            <p className="text-gray-600 text-sm mt-2">Oda: <span className="font-bold text-green-700">{roomId}</span></p>
          </div>
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-gray-800 mb-2">👤 İsminiz</label>
              <input
                type="text"
                placeholder="Oyuncu adınızı girin"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="w-full p-4 border-3 border-gray-400 rounded-xl bg-white text-gray-900 placeholder:text-gray-500 focus:border-yellow-500 focus:ring-4 focus:ring-yellow-200 focus:outline-none transition-all duration-200 shadow-lg text-lg font-medium"
              />
            </div>
            <button
              onClick={joinRoom}
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-green-600 to-green-700 text-white p-4 rounded-xl font-bold text-lg hover:from-green-700 hover:to-green-800 disabled:from-gray-500 disabled:to-gray-600 disabled:text-gray-300 disabled:cursor-not-allowed transition-all duration-200 shadow-xl hover:shadow-2xl transform hover:-translate-y-1 border-2 border-green-500 disabled:border-gray-400"
            >
              {isLoading ? '🔄 Katılıyor...' : '🎲 Oyuna Katıl'}
            </button>
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

  const currentPlayerData = gameState.players.find(p => p.id === playerId);
  const isMyTurn = gameState.currentPlayer === playerId;

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-900 via-green-800 to-green-900 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Back to Menu Button */}
        <div className="mb-4">
          <Link
            href="/"
            className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-2 rounded-full font-bold text-sm hover:from-blue-700 hover:to-blue-800 shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300 flex items-center inline-flex"
          >
            <span className="text-lg mr-2">⬅️</span>
            ANA MENÜ
          </Link>
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
          <h2 className="text-2xl font-bold text-yellow-400 mb-4 text-center">🏠 KURPİYER</h2>
          <div className="flex justify-center flex-wrap relative">
            {gameState.dealer.hand.map((card, index) => (
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
            <p className="text-yellow-300 text-lg font-semibold">Skor: <span className="text-white text-xl">{gameState.dealer.score}</span></p>
          </div>
        </div>

        {/* Players */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {gameState.players.map((player) => {
            // Determine player result for styling
            let resultStyle = '';
            let resultIcon = '';
            let resultText = '';

            if (gameState.gameState === 'finished' as string && gameState.results) {
              const isWinner = gameState.results.winners.some(w => w.id === player.id);
              const isLoser = gameState.results.losers.some(l => l.id === player.id);
              const isTie = gameState.results.ties.some(t => t.id === player.id);

              if (isWinner) {
                resultStyle = 'border-green-500 bg-gradient-to-br from-green-100 to-green-200 ring-4 ring-green-300';
                resultIcon = '🏆';
                const winnerInfo = gameState.results.winners.find(w => w.id === player.id);
                if (winnerInfo?.reason === 'blackjack') {
                  resultText = '🎉 BLACKJACK!';
                } else {
                  resultText = 'Kazandın!';
                }
              } else if (isLoser) {
                resultStyle = 'border-red-500 bg-gradient-to-br from-red-100 to-red-200 ring-4 ring-red-300';
                resultIcon = '❌';
                const loserInfo = gameState.results.losers.find(l => l.id === player.id);
                if (loserInfo?.reason === 'dealer_blackjack') {
                  resultText = 'Krupiyer Blackjack!';
                } else {
                  resultText = 'Kaybettin!';
                }
              } else if (isTie) {
                resultStyle = 'border-blue-500 bg-gradient-to-br from-blue-100 to-blue-200 ring-4 ring-blue-300';
                resultIcon = '🤝';
                const tieInfo = gameState.results.ties.find(t => t.id === player.id);
                if (tieInfo?.reason === 'blackjack_push') {
                  resultText = 'Blackjack Berabere!';
                } else {
                  resultText = 'Berabere!';
                }
              }
            }

            return (
              <div key={player.id} className={`p-6 rounded-xl shadow-xl border-2 transition-all duration-300 ${
                gameState.gameState === 'finished' as string && resultStyle
                  ? resultStyle
                  : isMyTurn && player.id === playerId
                    ? 'border-yellow-500 ring-4 ring-yellow-300 bg-gradient-to-br from-yellow-50 to-yellow-100'
                    : 'border-gray-300 bg-gradient-to-br from-gray-100 to-gray-200'
              }`}>
                <h3 className="text-xl font-bold text-gray-800 mb-3 text-center">
                  {player.name}
                  {player.id === playerId && <span className="text-blue-600 ml-2">(Sen)</span>}
                  {isMyTurn && player.id === playerId && <span className="text-yellow-600 ml-2">🎯</span>}
                  {resultIcon && <span className="ml-2 text-2xl">{resultIcon}</span>}
                </h3>
                <div className="flex justify-center flex-wrap mb-4 relative">
                  {player.hand.map((card, index) => (
                    <div key={index} className="relative">
                      {renderCard(card)}
                      {player.isBlackjack && index === player.hand.length - 1 && (
                        <div className="absolute -top-2 -right-2 bg-gradient-to-r from-yellow-400 to-yellow-600 text-black font-bold text-xs px-2 py-1 rounded-full shadow-lg border-2 border-yellow-300 animate-pulse">
                          BLACKJACK!
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="text-center space-y-1">
                  <p className="text-gray-700 font-semibold">Skor: <span className="text-lg text-gray-900">{player.score}</span></p>
                  <p className="text-gray-600 capitalize font-medium">
                    {player.status === 'playing' && '🃏 Oynuyor'}
                    {player.status === 'stood' && '✋ Durdu'}
                    {player.status === 'busted' && '💥 Battı'}
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
              className="bg-gradient-to-r from-green-600 to-green-700 text-white px-8 py-4 rounded-xl font-bold text-lg hover:from-green-700 hover:to-green-800 shadow-2xl hover:shadow-3xl transform hover:-translate-y-1 transition-all duration-200 border-2 border-green-500"
            >
              🎲 Oyunu Başlat
            </button>
          </div>
        )}

        {gameState.gameState === 'playing' as string && isMyTurn && currentPlayerData?.status === 'playing' && (
          <div className="text-center space-x-6">
            <button
              onClick={hit}
              className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-8 py-4 rounded-xl font-bold text-lg hover:from-blue-700 hover:to-blue-800 shadow-2xl hover:shadow-3xl transform hover:-translate-y-1 transition-all duration-200 border-2 border-blue-500"
            >
              🃏 Kart Al (Hit)
            </button>
            <button
              onClick={stand}
              className="bg-gradient-to-r from-red-600 to-red-700 text-white px-8 py-4 rounded-xl font-bold text-lg hover:from-red-700 hover:to-red-800 shadow-2xl hover:shadow-3xl transform hover:-translate-y-1 transition-all duration-200 border-2 border-red-500"
            >
              ✋ Dur (Stand)
            </button>
          </div>
        )}

        {gameState.gameState === 'finished' as string && gameState.results && (
          <>
            {/* Backdrop */}
            <div className="fixed inset-0 casino-pattern bg-gradient-to-br from-green-900 via-green-800 to-black bg-opacity-80 animate-backdrop-fade-in z-40"></div>

            {/* Modal */}
            <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
              <div className="bg-gradient-to-br from-yellow-400 via-yellow-500 to-yellow-600 text-black p-6 rounded-3xl shadow-2xl border-4 border-yellow-300 max-w-3xl w-full max-h-[90vh] overflow-y-auto animate-modal-slide-down">
                {/* Header */}
                <div className="text-center mb-8">
                  <h2 className="text-6xl font-bold mb-4 drop-shadow-lg">🎉</h2>
                  <h3 className="text-4xl font-bold mb-2">OYUN SONUCU</h3>
                  <div className="w-24 h-1 bg-black mx-auto rounded-full"></div>
                </div>

                {/* Dealer Result - Hero Section */}
                <div className="mb-8 p-6 bg-gradient-to-r from-black via-gray-900 to-black rounded-2xl border-4 border-yellow-400 shadow-2xl">
                  <div className="text-center">
                    <h3 className="text-3xl font-bold mb-4 text-yellow-300 flex items-center justify-center">
                      🏠 KURPİYER
                      {gameState.dealer.isBlackjack && <span className="ml-3 text-yellow-400 text-2xl animate-pulse">♠♥</span>}
                    </h3>
                    <div className="text-7xl font-bold text-white mb-4 drop-shadow-lg">
                      {gameState.dealer.score}
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
                        <p className="text-yellow-200 text-lg">Tüm oyuncular kazandı!</p>
                      </div>
                    )}
                    {!gameState.results.dealerBusted && !gameState.dealer.isBlackjack && gameState.dealer.score <= 21 && (
                      <p className="text-green-400 font-bold text-xl">✅ {gameState.dealer.score} ile durdu</p>
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
                        {gameState.results.winners.some(w => w.reason === 'blackjack') ? 'BLACKJACK KAZANAN!' : 'KAZANAN'}
                      </h4>
                      <div className="space-y-2">
                        {gameState.results.winners.map((winner) => {
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
                        {gameState.results.losers.map((loser) => (
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
                        {gameState.results.ties.map((tie) => (
                          <div key={tie.id} className="bg-white p-3 rounded-lg border-2 border-blue-300 shadow-sm">
                            <div className="font-bold text-sm text-blue-900 flex items-center justify-center">
                              {tie.name}
                              {tie.reason === 'blackjack_push' && <span className="ml-2 text-yellow-600 text-lg">♠♥</span>}
                            </div>
                            <div className="text-blue-700 text-xs mt-1 text-center">
                              {tie.reason === 'tie' && '⚖️ Eşit Skor!'}
                              {tie.reason === 'blackjack_push' && '🎭 Blackjack Berabere!'}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  {gameState.gameState === 'finished' as string && (
                    <button
                      onClick={restartGame}
                      disabled={isLoading}
                      className="bg-gradient-to-r from-green-600 to-green-700 text-white px-10 py-5 rounded-2xl font-bold text-xl hover:from-green-700 hover:to-green-800 disabled:from-gray-500 disabled:to-gray-600 disabled:text-gray-300 disabled:cursor-not-allowed shadow-2xl hover:shadow-3xl transform hover:-translate-y-2 transition-all duration-300 border-4 border-green-500 flex items-center justify-center"
                    >
                      <span className="text-2xl mr-3">🔄</span>
                      {isLoading ? 'Yenileniyor...' : 'YENİDEN OYNA'}
                    </button>
                  )}
                  <Link
                    href="/"
                    className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-10 py-5 rounded-2xl font-bold text-xl hover:from-blue-700 hover:to-blue-800 shadow-2xl hover:shadow-3xl transform hover:-translate-y-2 transition-all duration-300 border-4 border-blue-500 flex items-center justify-center"
                  >
                    <span className="text-2xl mr-3">⬅️</span>
                    ANA MENÜ
                  </Link>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
