'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../lib/auth';
import { useVirtualCurrency } from '../../../lib/virtualCurrency';
import { useOkeyGame, OkeyUtils, OkeyPlayer, OkeyGameState, OkeyTile } from '../../../lib/useOkeyGame';
import ChatComponent from '../../../components/ChatComponent';
import Scoreboard from '../../../components/Scoreboard';
import SoundVolumeControl from '../../../components/SoundVolumeControl';

interface OkeyGameProps {
  params: {
    roomId: string;
  };
}

interface GameRoom {
  id: string;
  name: string;
  game_type: string;
  status: string;
  max_players: number;
  current_round: number;
  game_mode: 'folding' | 'nonfolding';
  play_type: 'single' | 'paired';
}





export default function OkeyGameRoom({ params }: OkeyGameProps) {
  const roomId = params.roomId;
  const [gameRoom, setGameRoom] = useState<GameRoom | null>(null);
  const [selectedTiles, setSelectedTiles] = useState<OkeyTile[]>([]);
  const [selectedTile, setSelectedTile] = useState<OkeyTile | null>(null);
  const [showGameModeModal, setShowGameModeModal] = useState(false);
  const [showOpenSetModal, setShowOpenSetModal] = useState(false);
  const [message, setMessage] = useState('');
  const [playerScores, setPlayerScores] = useState<{[playerId: string]: number}>({});
  
  // Two-row tile arrangement state
  const [topRowTiles, setTopRowTiles] = useState<OkeyTile[]>([]);
  const [bottomRowTiles, setBottomRowTiles] = useState<OkeyTile[]>([]);
  const [selectedPosition, setSelectedPosition] = useState<{row: 'top' | 'bottom', index: number} | null>(null);
  const [movingTile, setMovingTile] = useState<OkeyTile | null>(null);
  const [currentScore, setCurrentScore] = useState(0);
  const [validSets, setValidSets] = useState<OkeyTile[][]>([]);
  const [canOpen, setCanOpen] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [istakaExpanded, setIstakaExpanded] = useState(true);

  const { user } = useAuth();
  const { userProfile } = useVirtualCurrency();
  const router = useRouter();

  // Use the Okey game hook
  const {
    gameState,
    myTiles,
    isMyTurn,
    isConnected,
    socketId,
    error,
    drawTile,
    discardTile,
    drawFromDiscard,
    openSet,
    startGame,
    finishGame,
    leaveGame,
    socket // Add socket to access for custom events
  } = useOkeyGame(roomId, user?.user_metadata?.username || 'Oyuncu');

  // Initialize game room state
  useEffect(() => {
    if (!roomId || !user) return;

    // Initialize mock game room
    const mockGameRoom: GameRoom = {
      id: roomId,
      name: `101 Okey Masası ${roomId.slice(0, 8)}`,
      game_type: 'okey',
      status: 'waiting',
      max_players: 4,
      current_round: 1,
      game_mode: 'folding',
      play_type: 'single',
    };

    setGameRoom(mockGameRoom);
  }, [roomId, user]);
  
  // Arrange tiles into two rows when myTiles changes
  useEffect(() => {
    if (myTiles.length > 0 && gameState?.okeyTile) {
      const okeyDefinition = {
        color: gameState.okeyTile.color,
        number: gameState.okeyTile.number
      };
      
      const arrangement = OkeyUtils.arrangeTilesOptimally(myTiles, okeyDefinition);
      setTopRowTiles(arrangement.topRow);
      setBottomRowTiles(arrangement.bottomRow);
      setCurrentScore(arrangement.totalScore);
      setValidSets([...arrangement.validSets, ...arrangement.validRuns]);
      setCanOpen(arrangement.totalScore >= 101);
    } else {
      // Simple arrangement when no okey defined yet
      const halfPoint = Math.ceil(myTiles.length / 2);
      setTopRowTiles(myTiles.slice(0, halfPoint));
      setBottomRowTiles(myTiles.slice(halfPoint));
      setCurrentScore(0);
      setValidSets([]);
      setCanOpen(false);
    }
  }, [myTiles, gameState?.okeyTile]);
  
  // Keyboard navigation for tile movement
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!selectedPosition) return;
      
      const { row, index } = selectedPosition;
      const currentRowTiles = row === 'top' ? topRowTiles : bottomRowTiles;
      const otherRowTiles = row === 'top' ? bottomRowTiles : topRowTiles;
      
      switch (event.key) {
        case 'ArrowLeft':
          if (index > 0) {
            setSelectedPosition({ row, index: index - 1 });
          }
          break;
          
        case 'ArrowRight':
          if (index < currentRowTiles.length - 1) {
            setSelectedPosition({ row, index: index + 1 });
          }
          break;
          
        case 'ArrowUp':
          if (row === 'bottom') {
            const newIndex = Math.min(index, topRowTiles.length - 1);
            if (newIndex >= 0) {
              setSelectedPosition({ row: 'top', index: newIndex });
            }
          }
          break;
          
        case 'ArrowDown':
          if (row === 'top') {
            const newIndex = Math.min(index, bottomRowTiles.length - 1);
            if (newIndex >= 0) {
              setSelectedPosition({ row: 'bottom', index: newIndex });
            }
          }
          break;
          
        case 'Enter':
        case ' ':
          if (movingTile) {
            // Place the moving tile at selected position
            placeTileAtPosition(movingTile, row, index);
            setMovingTile(null);
            // Recalculate after placement
            setTimeout(() => updateScoreFromArrangement(), 100);
          } else {
            // Pick up tile from selected position
            const tile = removeTileFromPosition(row, index);
            if (tile) {
              setMovingTile(tile);
              // Don't recalculate immediately when picking up - wait for placement
            }
          }
          break;
          
        case 'Escape':
          if (movingTile) {
            // Cancel move - rearrange all tiles properly
            rearrangeAllTiles();
          }
          setSelectedPosition(null);
          break;
          
        case 'r':
        case 'R':
          // Manual rearrange hotkey
          rearrangeAllTiles();
          setSelectedPosition(null);
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedPosition, topRowTiles, bottomRowTiles, movingTile, gameState?.okeyTile]);
  
  // Helper functions for tile movement
  const removeTileFromPosition = (row: 'top' | 'bottom', index: number) => {
    const tile = row === 'top' ? topRowTiles[index] : bottomRowTiles[index];
    if (!tile) return null;
    
    if (row === 'top') {
      setTopRowTiles(prev => prev.filter((_, i) => i !== index));
    } else {
      setBottomRowTiles(prev => prev.filter((_, i) => i !== index));
    }
    
    return tile;
  };
  
  const placeTileAtPosition = (tile: OkeyTile, row: 'top' | 'bottom', index: number) => {
    if (row === 'top') {
      setTopRowTiles(prev => {
        const newTiles = [...prev];
        newTiles.splice(index, 0, tile);
        return newTiles;
      });
    } else {
      setBottomRowTiles(prev => {
        const newTiles = [...prev];
        newTiles.splice(index, 0, tile);
        return newTiles;
      });
    }
    
    // Trigger recalculation after state updates
    setTimeout(() => updateScoreFromArrangement(), 100);
  };
  
  const updateScoreFromArrangement = useCallback(() => {
    if (isCalculating) return; // Prevent concurrent calculations
    
    setIsCalculating(true);
    
    if (!gameState?.okeyTile) {
      setCurrentScore(0);
      setValidSets([]);
      setCanOpen(false);
      setIsCalculating(false);
      return;
    }
    
    // Use a timeout to debounce rapid updates
    setTimeout(() => {
      try {
        const allTiles = [...topRowTiles, ...bottomRowTiles];
        if (movingTile && !allTiles.some(t => t.id === movingTile.id)) {
          allTiles.push(movingTile);
        }
        
        const okeyDefinition = {
          color: gameState.okeyTile!.color,
          number: gameState.okeyTile!.number
        };
        
        const analysis = OkeyUtils.findValidSetsAndRuns(allTiles, okeyDefinition);
        setCurrentScore(analysis.totalScore);
        setValidSets([...analysis.sets, ...analysis.runs]);
        setCanOpen(analysis.totalScore >= 101);
      } catch (error) {
        console.error('Error calculating score:', error);
        setCurrentScore(0);
        setValidSets([]);
        setCanOpen(false);
      } finally {
        setIsCalculating(false);
      }
    }, 50); // 50ms debounce
  }, [topRowTiles, bottomRowTiles, movingTile, gameState?.okeyTile, isCalculating]);
  
  // Enhanced tile rearrangement with preservation of valid sets
  const rearrangeAllTiles = useCallback(() => {
    if (!gameState?.okeyTile || isCalculating) return;
    
    setIsCalculating(true);
    
    try {
      const allTiles = [...topRowTiles, ...bottomRowTiles];
      if (movingTile && !allTiles.some(t => t.id === movingTile.id)) {
        allTiles.push(movingTile);
      }
      
      const okeyDefinition = {
        color: gameState.okeyTile.color,
        number: gameState.okeyTile.number
      };
      
      const arrangement = OkeyUtils.arrangeTilesOptimally(allTiles, okeyDefinition);
      setTopRowTiles(arrangement.topRow);
      setBottomRowTiles(arrangement.bottomRow);
      setCurrentScore(arrangement.totalScore);
      setValidSets([...arrangement.validSets, ...arrangement.validRuns]);
      setCanOpen(arrangement.totalScore >= 101);
      
      // Clear moving tile if it was included in rearrangement
      if (movingTile) {
        setMovingTile(null);
      }
    } catch (error) {
      console.error('Error rearranging tiles:', error);
    } finally {
      setIsCalculating(false);
    }
  }, [topRowTiles, bottomRowTiles, movingTile, gameState?.okeyTile, isCalculating]);

  const handleStartGame = () => {
    startGame();
  };

  const handleDrawTile = () => {
    if (isMyTurn) {
      drawTile();
      setMessage('Taş çektin!');
      setTimeout(() => setMessage(''), 2000);
    }
  };

  const copyRoomId = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      setMessage('Oda ID kopyalandı! 📋');
      setTimeout(() => setMessage(''), 3000);
    } catch {
      setMessage('Kopyalama başarısız oldu');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  // Get player position around the table
  const getPlayerPosition = (index: number, totalPlayers: number) => {
    const positions = [
      { left: '50%', top: '15%', transform: 'translate(-50%, -50%)' },      // North
      { left: '85%', top: '50%', transform: 'translate(-50%, -50%)' },       // East  
      { left: '50%', top: '85%', transform: 'translate(-50%, -50%)' },      // South
      { left: '15%', top: '50%', transform: 'translate(-50%, -50%)' },       // West
    ];

    if (index >= positions.length) {
      const angle = (index / totalPlayers) * 2 * Math.PI - Math.PI / 2;
      return {
        left: `${50 + Math.cos(angle) * 35}%`,
        top: `${50 + Math.sin(angle) * 35}%`,
        transform: 'translate(-50%, -50%)',
      };
    }

    return positions[index];
  };
  
  // Get discard pile position in actual corners (not between players)
  const getDiscardPosition = (playerIndex: number, totalPlayers: number) => {
    // True corner positions for discard piles - spread across the full table
    const cornerPositions = [
      { left: '85%', top: '20%', transform: 'translate(-50%, -50%)' },   // Top-right corner
      { left: '85%', top: '80%', transform: 'translate(-50%, -50%)' },   // Bottom-right corner  
      { left: '15%', top: '80%', transform: 'translate(-50%, -50%)' },   // Bottom-left corner
      { left: '15%', top: '20%', transform: 'translate(-50%, -50%)' },   // Top-left corner
    ];
    
    // For 2 players, use opposite corners
    if (totalPlayers === 2) {
      return playerIndex === 0 
        ? { left: '85%', top: '20%', transform: 'translate(-50%, -50%)' }  // Top-right
        : { left: '15%', top: '80%', transform: 'translate(-50%, -50%)' }; // Bottom-left
    }
    
    // For 3 players, use 3 corners
    if (totalPlayers === 3) {
      const threePlayerCorners = [
        { left: '85%', top: '20%', transform: 'translate(-50%, -50%)' },  // Top-right
        { left: '85%', top: '80%', transform: 'translate(-50%, -50%)' },  // Bottom-right
        { left: '15%', top: '80%', transform: 'translate(-50%, -50%)' },  // Bottom-left
      ];
      return threePlayerCorners[playerIndex % 3];
    }
    
    // For 4+ players, use all 4 corners and cycle
    return cornerPositions[playerIndex % 4] || cornerPositions[0];
  };

  // Scoreboard entries - using gameState players
  const scoreboardEntries = gameState ? gameState.players.map((p: OkeyPlayer) => ({
    id: p.id,
    name: p.name,
    netWinnings: -(playerScores[p.id] || 0), // Negative because in Okey lower score is better
    isDealer: p.id === gameState.currentPlayer
  })).sort((a: {id: string; name: string; netWinnings: number; isDealer: boolean}, b: {id: string; name: string; netWinnings: number; isDealer: boolean}) => a.netWinnings - b.netWinnings) : []; // Sort by lowest score first

  if (!user || !userProfile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-900 via-red-800 to-black flex items-center justify-center">
        <div className="text-center text-white">
          <div className="animate-spin text-4xl mb-4">🎴</div>
          <p>Yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-900 via-red-800 to-black relative overflow-hidden">
      {/* Background effect */}
      <div className="absolute inset-0 bg-[url('/okey-table.jpg')] bg-cover bg-center opacity-10"></div>
      <div className="absolute inset-0 bg-gradient-to-br from-orange-900/80 via-red-800/60 to-black/80"></div>

      {/* Main game area */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Top bar */}
        <div className="bg-black bg-opacity-50 p-4 border-b border-yellow-500">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/okey')}
                className="bg-gradient-to-r from-gray-600 to-gray-700 text-white px-4 py-2 rounded-lg hover:from-gray-700 hover:to-gray-800 transition-all duration-300"
              >
                ← Okey Menü
              </button>
              <div className="flex items-center space-x-3">
                <div className="text-yellow-400 font-bold">
                  🎴 101 Okey - {gameRoom?.name || `Oda: ${roomId.slice(0, 8)}...`}
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
                Tur: <span className="text-yellow-400 font-bold">{gameState?.roundNumber || 1}</span>
              </div>
              <div className="text-white">
                Oyuncular: <span className="text-green-400 font-bold">{gameState?.players.length || 0}/{gameRoom?.max_players || 4}</span>
              </div>
              <div className="text-white">
                💎 <span className="text-yellow-400 font-bold">{userProfile.chips.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main game content */}
        <div className="flex-1 flex">
          {/* Left panel - Scoreboard */}
          <div className="w-80 p-4">
            <Scoreboard scoreboard={scoreboardEntries} />
            <div className="mt-4">
              <SoundVolumeControl />
            </div>
          </div>

          {/* Center area - Game table */}
          <div className="flex-1 relative">
            {/* Game table */}
            <div className="absolute inset-4 bg-gradient-to-br from-red-800 to-red-900 rounded-3xl shadow-2xl border-8 border-yellow-600">
              {/* Game message - Center of table */}
              {message && (
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-30">
                  <div className="bg-blue-600 text-white px-6 py-4 rounded-xl border-4 border-blue-400 shadow-2xl text-center font-bold animate-pulse max-w-md">
                    {message}
                  </div>
                </div>
              )}
              {/* Individual player discard piles in corners */}
                {gameState?.players.map((player: OkeyPlayer, index: number) => {
                  // Debug: Check if player has individual discard pile
                  const hasIndividualDiscards = player.discardedTiles && player.discardedTiles.length > 0;
                  
                  // Only show discard pile if player has discarded tiles
                  if (!hasIndividualDiscards) return null;
                  
                  console.log(`🎴 Rendering discard pile for ${player.name}: ${player.discardedTiles.length} tiles`);
                  
                  // Get proper corner position for this player's discard pile
                  const discardPosition = getDiscardPosition(index, gameState.players.length);
                  
                  return (
                    <div
                      key={`discard-${player.id}`}
                      className="absolute z-20"
                      style={discardPosition}
                    >
                      <div className="bg-black bg-opacity-90 p-2 rounded-lg border-2 border-yellow-400 shadow-xl">
                        <div className="text-yellow-300 font-bold mb-1 text-center text-xs">
                          {player.name === (user?.user_metadata?.username || 'Oyuncu') ? '🗑️ Atıklarınız' : `🗑️ ${player.name}`}
                        </div>
                        <div className="flex flex-col items-center space-y-1">
                          {/* Show last discarded tile prominently */}
                          <div
                            className={`w-8 h-12 bg-white rounded border-2 text-black font-bold flex flex-col items-center justify-center shadow-md transform rotate-2 ${
                              player.id === socketId ? 'border-blue-400' : 'border-gray-400'
                            }`}
                          >
                            {(() => {
                              const tile = player.discardedTiles[player.discardedTiles.length - 1];
                              const tileDisplay = OkeyUtils.getTileDisplayJSX(tile);
                              
                              if (tileDisplay.isSpecial) {
                                return <span className="text-lg">{tileDisplay.display}</span>;
                              }
                              
                              return (
                                <>
                                  <span className={`text-sm font-bold ${tileDisplay.colorClass}`}>
                                    {tileDisplay.number}
                                  </span>
                                  <div className={`w-2 h-2 rounded-full ${
                                    tileDisplay.color === 'red' ? 'bg-red-500' :
                                    tileDisplay.color === 'black' ? 'bg-gray-800' :
                                    tileDisplay.color === 'blue' ? 'bg-blue-500' :
                                    'bg-yellow-500'
                                  }`}></div>
                                </>
                              );
                            })()}
                          </div>
                          
                          {/* Show previous tiles as small stack */}
                          {player.discardedTiles.length > 1 && (
                            <div className="relative">
                              {player.discardedTiles.slice(-3, -1).map((tile, tileIndex) => (
                                <div
                                  key={`stack-${tileIndex}`}
                                  className="absolute w-8 h-12 bg-gray-200 rounded border text-gray-600 font-bold flex flex-col items-center justify-center"
                                  style={{
                                    bottom: `${(tileIndex + 1) * 1}px`,
                                    left: `${(tileIndex + 1) * 0.5}px`,
                                    transform: `rotate(${(tileIndex + 1) * 1}deg)`,
                                    zIndex: -(tileIndex + 1)
                                  }}
                                >
                                  {(() => {
                                    const tileDisplay = OkeyUtils.getTileDisplayJSX(tile);
                                    
                                    if (tileDisplay.isSpecial) {
                                      return <span className="text-xs">{tileDisplay.display}</span>;
                                    }
                                    
                                    return (
                                      <>
                                        <span className={`text-xs font-bold ${tileDisplay.colorClass}`}>
                                          {tileDisplay.number}
                                        </span>
                                        <div className={`w-1.5 h-1.5 rounded-full ${
                                          tileDisplay.color === 'red' ? 'bg-red-500' :
                                          tileDisplay.color === 'black' ? 'bg-gray-700' :
                                          tileDisplay.color === 'blue' ? 'bg-blue-500' :
                                          'bg-yellow-500'
                                        }`}></div>
                                      </>
                                    );
                                  })()}
                                </div>
                              ))}
                            </div>
                          )}
                          
                          <div className="text-yellow-300 text-xs font-bold">
                            {player.discardedTiles.length} taş
                          </div>
                        </div>
                        
                        {/* Pick from discard option only for next player and if it's their turn */}
                        {isMyTurn && player.discardedTiles.length > 0 && (
                          <div className="mt-1 text-center">
                            <button
                              onClick={() => {
                                // Custom draw from this player's discard pile
                                if (socket && isConnected) {
                                  socket.emit('okey-draw-from-player-discard', { 
                                    roomId: `okey_${roomId}`, 
                                    targetPlayerId: player.id 
                                  });
                                }
                              }}
                              className="bg-gradient-to-r from-orange-600 to-orange-700 text-white px-2 py-1 rounded text-xs font-bold hover:from-orange-700 hover:to-orange-800 transition-all duration-300"
                            >
                              🎯 Al
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              
              {/* Center area - Game controls */}
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center z-20">
                {/* Start game button */}
                {gameState?.gamePhase === 'waiting' && gameState.players.length >= 2 && (
                  <button
                    onClick={handleStartGame}
                    className="bg-gradient-to-r from-green-600 to-green-700 text-white px-8 py-4 rounded-xl font-bold text-lg hover:from-green-700 hover:to-green-800 transition-all duration-300 shadow-lg transform hover:scale-105"
                  >
                    🎮 Oyunu Başlat
                  </button>
                )}

                {/* Waiting message */}
                {(!gameState || gameState.gamePhase === 'waiting') && (!gameState || gameState.players.length < 2) && (
                  <div className="text-gray-400 text-center">
                    <div className="text-3xl mb-2">💭</div>
                    <div>En az 2 oyuncu gerekli</div>
                    <div className="text-sm mt-1">Arkadaşlarınızı davet edin!</div>
                  </div>
                )}

                {/* Okey tile display */}
                {gameState?.okeyTile && (
                  <div className="bg-black bg-opacity-80 p-4 rounded-xl border-2 border-yellow-500">
                    <div className="text-yellow-300 font-bold mb-2 text-center">🎯 Okey Taşı</div>
                    <div className="flex justify-center">
                      <div className="w-16 h-20 bg-white rounded border-2 border-gray-400 text-black font-bold flex flex-col items-center justify-center shadow-md">
                        {(() => {
                          const tile = gameState.okeyTile;
                          const tileDisplay = OkeyUtils.getTileDisplayJSX(tile);
                          
                          if (tileDisplay.isSpecial) {
                            return <span className="text-2xl">{tileDisplay.display}</span>;
                          }
                          
                          return (
                            <>
                              <span className={`text-xl font-bold ${tileDisplay.colorClass}`}>
                                {tileDisplay.number}
                              </span>
                              <div className={`w-3 h-3 rounded-full mt-1 ${
                                tileDisplay.color === 'red' ? 'bg-red-500' :
                                tileDisplay.color === 'black' ? 'bg-gray-800' :
                                tileDisplay.color === 'blue' ? 'bg-blue-500' :
                                'bg-yellow-500'
                              }`}></div>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Players around the table */}
              {gameState?.players.map((player: OkeyPlayer, index: number) => {
                const position = getPlayerPosition(index, gameState.players.length);
                return (
                  <div
                    key={player.id}
                    className={`absolute p-3 rounded-xl border-2 transition-all duration-300 min-w-[140px] ${
                      player.isActive
                        ? 'bg-yellow-600 border-yellow-400 shadow-lg scale-110 z-20'
                        : 'bg-gray-700 border-gray-500 z-10'
                    }`}
                    style={position}
                  >
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
                        💰 {player.chips?.toLocaleString() || '0'}
                      </div>
                      <div className="text-xs text-gray-300 mt-1">
                        📊 {player.score || 0} puan
                      </div>
                      
                      {/* Tile count display */}
                      <div className="flex justify-center mt-2">
                        <div className="bg-red-700 text-white px-2 py-1 rounded text-xs font-bold">
                          🎴 {player.tiles?.length || 0} taş
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right panel - Game controls and chat */}
          <div className="w-80 p-4">
            <ChatComponent roomId={roomId} playerName={user.user_metadata?.username || 'Oyuncu'} />
            
            {/* Game controls */}
            <div className="mt-4 bg-gradient-to-br from-gray-800 to-gray-900 p-4 rounded-xl shadow-2xl border-2 border-gray-600">
              <h3 className="text-yellow-400 font-bold mb-3 text-center">🎴 Oyun Kontrolleri</h3>

              {/* Only show tile controls when it's player's turn */}
              {gameState?.gamePhase === 'playing' && isMyTurn && (
                <div className="space-y-3">
                  <div className="text-center text-yellow-300 text-sm mb-3 font-bold">
                    👉 Sıranız! Hamle yapın
                  </div>
                  
                  {/* Draw from deck button */}
                  <button
                    onClick={handleDrawTile}
                    className="w-full bg-gradient-to-r from-green-600 to-green-700 text-white py-3 rounded-lg font-bold hover:from-green-700 hover:to-green-800 transition-all duration-300"
                  >
                    🎯 Desteden Taş Çek
                  </button>
                  
                  {/* Discard tile button - only show if player has selected a position with a tile */}
                  {selectedPosition && (
                    <button
                      onClick={() => {
                        const currentRowTiles = selectedPosition.row === 'top' ? topRowTiles : bottomRowTiles;
                        const tileToDiscard = currentRowTiles[selectedPosition.index];
                        if (tileToDiscard) {
                          discardTile(tileToDiscard.id);
                          setSelectedPosition(null);
                        }
                      }}
                      className="w-full bg-gradient-to-r from-red-600 to-red-700 text-white py-3 rounded-lg font-bold hover:from-red-700 hover:to-red-800 transition-all duration-300"
                    >
                      🗑️ Taş At: {(() => {
                        if (selectedPosition) {
                          const currentRowTiles = selectedPosition.row === 'top' ? topRowTiles : bottomRowTiles;
                          const tile = currentRowTiles[selectedPosition.index];
                          if (tile) {
                            const tileDisplay = OkeyUtils.getTileDisplayJSX(tile);
                            if (tileDisplay.isSpecial) {
                              return tileDisplay.display;
                            }
                            return `${tileDisplay.number}`;
                          }
                        }
                        return '';
                      })()}
                    </button>
                  )}
                  
                  {/* Open sets button - show if player can open with current arrangement */}
                  {canOpen && validSets.length > 0 && (
                    <button
                      onClick={() => {
                        // Open all valid sets
                        validSets.forEach(set => openSet(set));
                        setValidSets([]);
                        setCanOpen(false);
                      }}
                      className="w-full bg-gradient-to-r from-green-600 to-green-700 text-white py-3 rounded-lg font-bold hover:from-green-700 hover:to-green-800 transition-all duration-300 animate-pulse"
                    >
                      🏆 101+ Set Aç ({validSets.length} set)
                    </button>
                  )}
                  
                  {/* Manual set opening for selected tiles (legacy mode) */}
                  {selectedTiles.length >= 3 && (
                    <button
                      onClick={() => {
                        openSet(selectedTiles);
                        setSelectedTiles([]);
                      }}
                      className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 rounded-lg font-bold hover:from-blue-700 hover:to-blue-800 transition-all duration-300"
                    >
                      🎴 Manuel Set Aç ({selectedTiles.length} taş)
                    </button>
                  )}
                </div>
              )}
              
              {/* Show waiting message when it's not player's turn */}
              {gameState?.gamePhase === 'playing' && !isMyTurn && (
                <div className="text-center text-gray-400 py-4">
                  <div className="text-2xl mb-2">⏳</div>
                  <div>Diğer oyuncunun sırası</div>
                  <div className="text-sm mt-1">Lütfen bekleyin...</div>
                </div>
              )}

              {/* Game info */}
              <div className="mt-4 bg-black bg-opacity-50 p-3 rounded-lg">
                <div className="text-yellow-400 font-bold text-lg text-center mb-2">
                  🎴 101 Okey
                </div>
                <div className="text-white text-sm text-center">
                  {gameRoom?.game_mode === 'folding' ? '📈 Katlamalı' : '📊 Katlamasız'} - 
                  {gameRoom?.play_type === 'single' ? ' 👤 Tekli' : ' 👥 Eşli'}
                </div>
                <div className="text-gray-300 text-xs text-center mt-1">
                  Tur {gameState?.roundNumber || 1} - {gameState?.gamePhase === 'waiting' ? 'Bekliyor' : gameState?.gamePhase === 'playing' ? 'Devam Ediyor' : 'Bitti'}
                </div>
                {/* Show current player info */}
                {gameState?.gamePhase === 'playing' && (
                  <div className="text-center mt-2 text-xs">
                    <div className={`inline-block px-2 py-1 rounded ${
                      isMyTurn ? 'bg-green-600 text-white' : 'bg-yellow-600 text-black'
                    }`}>
                      {isMyTurn ? '👉 Sizin sıranız' : `🔄 ${gameState.players.find(p => p.id === gameState.currentPlayer)?.name || 'Bilinmeyen'} oynuyor`}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Player tiles area (bottom) - Collapsible İstaka interface */}
        {(topRowTiles.length > 0 || bottomRowTiles.length > 0) && (
          <div className={`backdrop-blur-sm bg-opacity-75 transition-all duration-300 ${
            istakaExpanded ? 'p-4' : 'p-2'
          }`}>
            <div className="max-w-7xl mx-auto">
              {/* Header with toggle button */}
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => setIstakaExpanded(!istakaExpanded)}
                    className={`bg-gradient-to-r from-yellow-600 to-yellow-700 hover:from-yellow-700 hover:to-yellow-800 text-white px-4 py-2 rounded-lg font-bold transition-all duration-300 flex items-center space-x-2 ${
                      istakaExpanded ? 'scale-100' : 'scale-110'
                    }`}
                  >
                    <span>{istakaExpanded ? '🔽' : '🔼'}</span>
                    <span>🎯 Istaka</span>
                    {!istakaExpanded && (
                      <span className="text-yellow-200 text-sm">({topRowTiles.length + bottomRowTiles.length} taş)</span>
                    )}
                  </button>
                  
                  {istakaExpanded && (
                    <h4 className="text-yellow-400 font-bold text-lg">Taşlarınız</h4>
                  )}
                </div>
                <div className="flex items-center space-x-4">
                  <div className={`text-green-400 font-bold ${isCalculating ? 'animate-pulse' : ''}`}>
                    🏆 Puan: {isCalculating ? '...' : currentScore}
                  </div>
                  {canOpen && !isCalculating && (
                    <div className="bg-green-600 text-white px-3 py-1 rounded-lg font-bold animate-pulse">
                      🚀 101+ Açabilirsiniz!
                    </div>
                  )}
                  {movingTile && (
                    <div className="bg-blue-600 text-white px-3 py-1 rounded-lg font-bold">
                      👆 Taşınan: {OkeyUtils.getTileDisplay(movingTile)}
                    </div>
                  )}
                  {isCalculating && (
                    <div className="bg-yellow-600 text-white px-3 py-1 rounded-lg font-bold animate-pulse">
                      🔄 Hesaplanıyor...
                    </div>
                  )}
                </div>
              </div>
              
              {/* Mini preview when collapsed */}
              {!istakaExpanded && (
                <div className="flex justify-center space-x-1 mt-2">
                  {[...topRowTiles, ...bottomRowTiles].slice(0, 8).map((tile, index) => (
                    <div
                      key={`preview-${tile.id}-${index}`}
                      className="w-6 h-8 bg-white rounded border text-xs font-bold flex flex-col items-center justify-center text-black"
                    >
                      {(() => {
                        const tileDisplay = OkeyUtils.getTileDisplayJSX(tile);
                        
                        if (tileDisplay.isSpecial) {
                          return <span className="text-xs">{tileDisplay.display}</span>;
                        }
                        
                        return (
                          <>
                            <span className={`text-xs font-bold ${tileDisplay.colorClass}`}>
                              {tileDisplay.number}
                            </span>
                            <div className={`w-1 h-1 rounded-full ${
                              tileDisplay.color === 'red' ? 'bg-red-500' :
                              tileDisplay.color === 'black' ? 'bg-gray-800' :
                              tileDisplay.color === 'blue' ? 'bg-blue-500' :
                              'bg-yellow-500'
                            }`}></div>
                          </>
                        );
                      })()} 
                    </div>
                  ))}
                  {(topRowTiles.length + bottomRowTiles.length) > 8 && (
                    <div className="w-6 h-8 bg-gray-300 rounded border text-xs font-bold flex items-center justify-center text-gray-600">
                      +{(topRowTiles.length + bottomRowTiles.length) - 8}
                    </div>
                  )}
                </div>
              )}
              
              {/* Collapsible content */}
              <div className={`transition-all duration-500 overflow-hidden ${
                istakaExpanded 
                  ? 'max-h-[500px] opacity-100' 
                  : 'max-h-0 opacity-0'
              }`}>
                {/* Instructions */}
                <div className="text-center mb-3 text-white text-sm">
                  Tıkla: Seç | Ok tuşları: Hareket | Enter/Space: Al/Bırak | Esc: İptal | R: Yeniden Düzenle
                </div>
                
                {/* Control buttons */}
                <div className="flex justify-center space-x-2 mb-3">
                  <button
                    onClick={rearrangeAllTiles}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all duration-300"
                  >
                    🔄 Otomatik Düzenle
                  </button>
                  {movingTile && (
                    <button
                      onClick={() => {
                        rearrangeAllTiles();
                        setSelectedPosition(null);
                      }}
                      className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all duration-300"
                    >
                      ❌ Hareketi İptal Et
                    </button>
                  )}
                </div>
              
              {/* Top Row */}
              <div className="">
                <div className="text-yellow-300 text-sm mb-1 font-semibold">Üst Sıra (Geçerli Setler) / Alt Sıra (Diğer Taşlar)</div>
                <div className="flex justify-center space-x-1 p-2 bg-gradient-to-r from-green-900/30 to-blue-900/30 rounded-lg border-l-4 border-r-4 border-black min-h-[70px] items-center">
                  {topRowTiles.length === 0 ? (
                    <div className="text-gray-500 text-sm italic">Geçerli setler buraya yerleşir...</div>
                  ) : (
                    topRowTiles.map((tile, index) => {
                      const isSelected = selectedPosition?.row === 'top' && selectedPosition?.index === index;
                      const isInValidSet = validSets.some(set => set.some(t => t.id === tile.id));
                      
                      // Get tile color for styling
                      const getColorClasses = (tile: OkeyTile) => {
                        if (tile.isFakeOkey || tile.isOkey) return 'bg-purple-100 border-purple-400 text-purple-800';
                        const colorMap = {
                          red: 'bg-red-50 border-red-400 text-red-800',
                          black: 'bg-gray-100 border-gray-600 text-gray-900',
                          blue: 'bg-blue-50 border-blue-400 text-blue-800',
                          yellow: 'bg-yellow-50 border-yellow-400 text-yellow-800'
                        };
                        return colorMap[tile.color] || 'bg-white border-gray-400 text-black';
                      };
                      
                      return (
                        <button
                          key={`top-${tile.id}-${index}`}
                          onClick={() => setSelectedPosition({ row: 'top', index })}
                          className={`w-12 h-16 rounded-lg border-2 font-bold transition-all flex flex-col items-center justify-center ${
                            isSelected
                              ? 'border-yellow-400 scale-110 shadow-lg bg-yellow-100 text-yellow-900'
                              : isInValidSet
                                ? `border-green-400 shadow-md scale-105 ${getColorClasses(tile)}`
                                : `${getColorClasses(tile)} hover:border-gray-300`
                          }`}
                        >
                          {(() => {
                            const tileDisplay = OkeyUtils.getTileDisplayJSX(tile);
                            
                            if (tileDisplay.isSpecial) {
                              return <span className="text-lg">{tileDisplay.display}</span>;
                            }
                            
                            return (
                              <>
                                <span className={`text-sm font-bold ${tileDisplay.colorClass}`}>
                                  {tileDisplay.number}
                                </span>
                                <div className={`w-2 h-2 rounded-full ${
                                  tile.color === 'red' ? 'bg-red-500' :
                                  tile.color === 'black' ? 'bg-gray-800' :
                                  tile.color === 'blue' ? 'bg-blue-500' :
                                  'bg-yellow-500'
                                }`}></div>
                              </>
                            );
                          })()}
                        </button>
                      );
                    })
                  )}

                </div>
              </div>
              
              {/* Bottom Row */}
              <div>
                <div className="flex justify-center space-x-1 p-2 bg-gradient-to-r from-red-900/30 to-orange-900/30 rounded-lg border-l-4 border-r-4 border-black min-h-[70px] items-center">
                  {bottomRowTiles.length === 0 ? (
                    <div className="text-gray-500 text-sm italic">Kalan taşlar buraya yerleşir...</div>
                  ) : (
                    bottomRowTiles.map((tile, index) => {
                      const isSelected = selectedPosition?.row === 'bottom' && selectedPosition?.index === index;
                      
                      // Get tile color for styling
                      const getColorClasses = (tile: OkeyTile) => {
                        if (tile.isFakeOkey || tile.isOkey) return 'bg-purple-100 border-purple-400 text-purple-800';
                        const colorMap = {
                          red: 'bg-red-50 border-red-400 text-red-800',
                          black: 'bg-gray-100 border-gray-600 text-gray-900',
                          blue: 'bg-blue-50 border-blue-400 text-blue-800',
                          yellow: 'bg-yellow-50 border-yellow-400 text-yellow-800'
                        };
                        return colorMap[tile.color] || 'bg-white border-gray-400 text-black';
                      };
                      
                      return (
                        <button
                          key={`bottom-${tile.id}-${index}`}
                          onClick={() => setSelectedPosition({ row: 'bottom', index })}
                          className={`w-12 h-16 rounded-lg border-2 font-bold transition-all flex flex-col items-center justify-center ${
                            isSelected
                              ? 'border-yellow-400 scale-110 shadow-lg bg-yellow-100 text-yellow-900'
                              : `${getColorClasses(tile)} hover:border-gray-300`
                          }`}
                        >
                          {(() => {
                            const tileDisplay = OkeyUtils.getTileDisplayJSX(tile);
                            
                            if (tileDisplay.isSpecial) {
                              return <span className="text-lg">{tileDisplay.display}</span>;
                            }
                            
                            return (
                              <>
                                <span className={`text-sm font-bold ${tileDisplay.colorClass}`}>
                                  {tileDisplay.number}
                                </span>
                                <div className={`w-2 h-2 rounded-full ${
                                  tile.color === 'red' ? 'bg-red-500' :
                                  tile.color === 'black' ? 'bg-gray-800' :
                                  tile.color === 'blue' ? 'bg-blue-500' :
                                  'bg-yellow-500'
                                }`}></div>
                              </>
                            );
                          })()}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
              
              {/* Valid sets display */}
              {validSets.length > 0 && (
                <div className="mt-3 text-center">
                  <div className="text-green-400 text-sm font-semibold mb-1">
                    🏆 Geçerli Setler: {validSets.length}
                  </div>
                  <div className="flex justify-center space-x-2 text-xs">
                    {validSets.map((set, index) => (
                      <div key={index} className="bg-green-700 text-white px-2 py-1 rounded">
                        {set.map((tile, tileIndex) => {
                          const tileDisplay = OkeyUtils.getTileDisplayJSX(tile);
                          if (tileDisplay.isSpecial) {
                            return tileDisplay.display;
                          }
                          return tileDisplay.number;
                        }).join('-')}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}