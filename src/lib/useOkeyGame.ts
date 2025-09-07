'use client';

import { useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

export interface OkeyTile {
  color: 'red' | 'black' | 'blue' | 'yellow';
  number: number; // 1-13, 14 for joker
  isOkey: boolean; // True if this is the determined Okey tile
  isFakeOkey: boolean; // True if this is a fake Okey (sahte okey)
  id: string;
}

export interface OkeyPlayer {
  id: string;
  name: string;
  chips: number;
  tiles: OkeyTile[];
  isActive: boolean;
  position: number;
  isConnected: boolean;
  score: number; // Total cumulative score
  roundScore: number; // Score for current round
  foldMultiplier: number; // Multiplier for folded games
  debt: number; // Current debt amount in folding games
  partner?: string; // Partner ID for paired games
  hasOpened: boolean; // Has opened with 101+ points
  canFinish: boolean; // Can finish the game
  openedSets: OkeyTile[][]; // Sets that player has opened
  discardedTiles: OkeyTile[]; // Player's individual discard pile
  isDealer: boolean; // Is the dealer for this round
  tileCount: number; // Number of tiles (for display to others)
}

export interface OkeyGameState {
  roomId: string;
  players: OkeyPlayer[];
  currentPlayer: string;
  gamePhase: 'waiting' | 'dealing' | 'playing' | 'finished';
  okeyTile: OkeyTile | null; // The determined Okey tile
  indicatorTile: OkeyTile | null; // The indicator tile shown
  fakeOkeyTiles: OkeyTile[]; // The two fake Okey tiles
  discardPile: OkeyTile[]; // Legacy single discard pile (for compatibility)
  playerDiscardPiles: { [playerId: string]: OkeyTile[] }; // Individual player discard piles
  remainingTiles: number;
  roundNumber: number;
  gameMode: 'folding' | 'nonfolding';
  playType: 'single' | 'paired';
  winner?: string;
  scores: { [playerId: string]: number }; // Total scores
  roundScores: { [playerId: string]: number }; // Current round scores
  partnerships?: { [playerId: string]: string }; // Partner mappings
  currentDebt: number; // Current debt in folding games
  gameSettings: {
    targetScore: number; // Target score to end game (default 101)
    maxRounds: number; // Maximum rounds before forced end
    dealerRotation: boolean; // Whether dealer rotates
  };
}

interface OkeyGameActions {
  drawTile: () => void;
  discardTile: (tileId: string) => void;
  drawFromDiscard: () => void;
  openSet: (tiles: OkeyTile[]) => void;
  addToSet: (tileId: string, setIndex: number) => void;
  finishGame: (winningSet?: OkeyTile[]) => void;
  fold: (multiplier: number) => void;
  acceptFold: () => void;
  rejectFold: () => void;
  startGame: () => void;
  leaveGame: () => void;
  rearrangeTiles: (tiles: OkeyTile[]) => void;
  validateSet: (tiles: OkeyTile[]) => boolean;
  calculateHandScore: (tiles: OkeyTile[]) => number;
}

interface UseOkeyGameReturn extends OkeyGameActions {
  gameState: OkeyGameState | null;
  myTiles: OkeyTile[];
  isMyTurn: boolean;
  isConnected: boolean;
  socketId: string | null;
  socket: Socket | null; // Export socket for custom events
  error: string | null;
}

export function useOkeyGame(roomId: string, playerName: string): UseOkeyGameReturn {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameState, setGameState] = useState<OkeyGameState | null>(null);
  const [myTiles, setMyTiles] = useState<OkeyTile[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [socketId, setSocketId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Initialize socket connection
  useEffect(() => {
    if (!roomId || !playerName) return;

    console.log('🎴 Creating Okey socket connection for room:', roomId, 'player:', playerName);
    
    const newSocket = io(process.env.NODE_ENV === 'production'
      ? process.env.NEXT_PUBLIC_APP_URL || "https://casino-with-friends-production.up.railway.app"
      : "http://localhost:3000", {
      path: '/api/socket',
      transports: ['websocket', 'polling'],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 20000,
      upgrade: true,
      rememberUpgrade: true
    });

    newSocket.on('connect', () => {
      console.log('🎴 Connected to Okey game server:', newSocket.id);
      console.log('🎴 Socket connected status:', newSocket.connected);
      setIsConnected(true);
      setSocketId(newSocket.id || null);
      setError(null);
      
      // Join the game room with okey prefix
      console.log('🎴 Joining Okey room:', { roomId, playerName });
      newSocket.emit('join-okey-room', {
        roomId: `okey_${roomId}`, // Add okey prefix to avoid conflicts
        playerName,
        gameType: 'okey'
      });
    });

    newSocket.on('disconnect', () => {
      console.log('🎴 Disconnected from Okey game server');
      setIsConnected(false);
      setSocketId(null);
    });

    newSocket.on('connect_error', (err) => {
      console.error('🎴 Connection error:', err);
      setError('Bağlantı hatası: ' + err.message);
      setIsConnected(false);
    });

    newSocket.on('reconnect_error', (err) => {
      console.error('🎴 Reconnection error:', err);
    });

    newSocket.on('error', (err) => {
      console.error('🎴 Socket error:', err);
    });

    // Game state updates
    newSocket.on('okey-game-update', (data: OkeyGameState) => {
      console.log('🎴 Game state update:', data);
      setGameState(data);
    });

    // Player tiles (private information)
    newSocket.on('okey-player-tiles', (tiles: OkeyTile[]) => {
      console.log('🎴 Received player tiles:', tiles.length);
      setMyTiles(tiles);
    });

    // Game events
    newSocket.on('okey-player-joined', (data: { playerName: string }) => {
      console.log('🎴 Player joined:', data.playerName);
    });

    newSocket.on('okey-player-left', (data: { playerName: string }) => {
      console.log('🎴 Player left:', data.playerName);
    });

    newSocket.on('okey-tile-drawn', (data: { playerName: string }) => {
      console.log('🎴 Player drew tile:', data.playerName);
    });

    newSocket.on('okey-tile-discarded', (data: { playerName: string, tile: OkeyTile }) => {
      console.log('🎴 Player discarded tile:', data.playerName, data.tile);
    });

    newSocket.on('okey-set-opened', (data: { playerName: string, sets: OkeyTile[][] }) => {
      console.log('🎴 Player opened sets:', data.playerName, data.sets);
    });

    newSocket.on('okey-game-finished', (data: { winner: string, scores: { [playerId: string]: number } }) => {
      console.log('🎴 Game finished:', data);
    });

    // Folding events
    newSocket.on('okey-fold-proposed', (data: { playerName: string, multiplier: number, currentDebt: number }) => {
      console.log('🎴 Fold proposed:', data);
      // You can add UI handling here for fold proposals
    });

    newSocket.on('okey-fold-accepted', (data: { multiplier: number, message: string }) => {
      console.log('🎴 Fold accepted:', data);
      // You can add UI handling here for accepted folds
    });

    newSocket.on('okey-fold-rejected', (data: { message: string }) => {
      console.log('🎴 Fold rejected:', data);
      // You can add UI handling here for rejected folds
    });

    // Error handling
    newSocket.on('okey-join-error', (data: { message: string }) => {
      console.error('🎴 Join error:', data.message);
      setError(data.message);
    });

    setSocket(newSocket);

    return () => {
      if (newSocket) {
        newSocket.disconnect();
      }
    };
  }, [roomId, playerName]);

  // Game actions
  const drawTile = useCallback(() => {
    if (socket && isConnected) {
      socket.emit('okey-draw-tile', { roomId: `okey_${roomId}` });
    }
  }, [socket, isConnected, roomId]);

  const drawFromDiscard = useCallback(() => {
    if (socket && isConnected) {
      socket.emit('okey-draw-from-discard', { roomId: `okey_${roomId}` });
    }
  }, [socket, isConnected, roomId]);

  const discardTile = useCallback((tileId: string) => {
    if (socket && isConnected) {
      socket.emit('okey-discard-tile', { roomId: `okey_${roomId}`, tileId });
    }
  }, [socket, isConnected, roomId]);

  const openSet = useCallback((tiles: OkeyTile[]) => {
    if (socket && isConnected) {
      socket.emit('okey-open-set', { roomId: `okey_${roomId}`, tiles });
    }
  }, [socket, isConnected, roomId]);

  const finishGame = useCallback((winningSet?: OkeyTile[]) => {
    if (socket && isConnected) {
      socket.emit('okey-finish-game', { roomId: `okey_${roomId}`, winningSet });
    }
  }, [socket, isConnected, roomId]);

  const fold = useCallback((multiplier: number) => {
    if (socket && isConnected) {
      socket.emit('okey-fold', { roomId: `okey_${roomId}`, multiplier });
    }
  }, [socket, isConnected, roomId]);

  const startGame = useCallback(() => {
    if (socket && isConnected) {
      socket.emit('okey-start-game', { roomId: `okey_${roomId}` });
    }
  }, [socket, isConnected, roomId]);

  const leaveGame = useCallback(() => {
    if (socket && isConnected) {
      socket.emit('okey-leave-game', { roomId: `okey_${roomId}` });
    }
  }, [socket, isConnected, roomId]);

  const addToSet = useCallback((tileId: string, setIndex: number) => {
    if (socket && isConnected) {
      socket.emit('okey-add-to-set', { roomId: `okey_${roomId}`, tileId, setIndex });
    }
  }, [socket, isConnected, roomId]);

  const acceptFold = useCallback(() => {
    if (socket && isConnected) {
      socket.emit('okey-accept-fold', { roomId: `okey_${roomId}` });
    }
  }, [socket, isConnected, roomId]);

  const rejectFold = useCallback(() => {
    if (socket && isConnected) {
      socket.emit('okey-reject-fold', { roomId: `okey_${roomId}` });
    }
  }, [socket, isConnected, roomId]);

  const rearrangeTiles = useCallback((tiles: OkeyTile[]) => {
    if (socket && isConnected) {
      socket.emit('okey-rearrange-tiles', { roomId: `okey_${roomId}`, tiles });
    }
  }, [socket, isConnected, roomId]);

  const validateSet = useCallback((tiles: OkeyTile[]) => {
    return OkeyUtils.isValidSet(tiles) || OkeyUtils.isValidRun(tiles);
  }, []);

  const calculateHandScore = useCallback((tiles: OkeyTile[]) => {
    return OkeyUtils.calculateHandScore(tiles);
  }, []);

  const isMyTurn = gameState ? gameState.currentPlayer === socketId : false;

  return {
    gameState,
    myTiles,
    isMyTurn,
    isConnected,
    socketId,
    socket, // Export socket for custom events
    error,
    drawTile,
    discardTile,
    drawFromDiscard,
    openSet,
    addToSet,
    finishGame,
    fold,
    acceptFold,
    rejectFold,
    startGame,
    leaveGame,
    rearrangeTiles,
    validateSet,
    calculateHandScore,
  };
}

// Utility functions for Okey game logic
export const OkeyUtils = {
  // Create a complete 106-tile Okey set (authentic Turkish rules)
  createTileSet: (): OkeyTile[] => {
    const tiles: OkeyTile[] = [];
    const colors: Array<'red' | 'black' | 'blue' | 'yellow'> = ['red', 'black', 'blue', 'yellow'];
    
    // Add numbered tiles (1-13) for each color, two sets (104 tiles)
    for (let set = 0; set < 2; set++) {
      for (const color of colors) {
        for (let number = 1; number <= 13; number++) {
          tiles.push({
            color,
            number,
            isOkey: false,
            isFakeOkey: false,
            id: `${color}-${number}-${set}`,
          });
        }
      }
    }
    
    // Add 2 fake Okey tiles (sahte okey) - total 106 tiles
    tiles.push({
      color: 'red',
      number: 14, // Special number for fake okey
      isOkey: false,
      isFakeOkey: true,
      id: 'fake-okey-1',
    });
    tiles.push({
      color: 'black',
      number: 14, // Special number for fake okey
      isOkey: false,
      isFakeOkey: true,
      id: 'fake-okey-2',
    });
    
    return tiles;
  },

  // Shuffle tiles
  shuffleTiles: (tiles: OkeyTile[]): OkeyTile[] => {
    const shuffled = [...tiles];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  },

  // Determine okey tile (indicator tile + 1, with wraparound)
  determineOkey: (indicatorTile: OkeyTile): { color: string; number: number } => {
    if (indicatorTile.number === 13) {
      return { color: indicatorTile.color, number: 1 }; // 13 → 1
    } else {
      return { color: indicatorTile.color, number: indicatorTile.number + 1 };
    }
  },

  // Mark Okey tiles in a tile set
  markOkeyTiles: (tiles: OkeyTile[], okeyDefinition: { color: string; number: number }) => {
    tiles.forEach(tile => {
      if (tile.color === okeyDefinition.color && tile.number === okeyDefinition.number) {
        tile.isOkey = true;
      }
    });
  },

  // Check if tiles form a valid run (sequence) with Okey substitution
  isValidRun: (tiles: OkeyTile[], okeyDefinition?: { color: string; number: number }): boolean => {
    if (tiles.length < 3) return false;
    
    // Separate okeys/fakes from regular tiles
    const regularTiles = tiles.filter(t => !t.isOkey && !t.isFakeOkey);
    const okeyCount = tiles.filter(t => t.isOkey || t.isFakeOkey).length;
    
    if (regularTiles.length === 0) return false; // Cannot have all okeys
    
    // Check if all regular tiles are same color
    const colors = [...new Set(regularTiles.map(t => t.color))];
    if (colors.length > 1) return false;
    
    // Sort regular tiles by number
    const sortedTiles = regularTiles.sort((a, b) => a.number - b.number);
    
    // Try to form a valid sequence with okeys as substitutes
    let neededOkeys = 0;
    for (let i = 1; i < sortedTiles.length; i++) {
      const gap = sortedTiles[i].number - sortedTiles[i-1].number - 1;
      if (gap < 0) return false; // Duplicate numbers
      neededOkeys += gap;
    }
    
    // Check if we have enough okeys to fill gaps
    return neededOkeys <= okeyCount && (sortedTiles.length + okeyCount) <= 13;
  },

  // Find all valid sets and runs in a hand
  findValidSetsAndRuns: (tiles: OkeyTile[], okeyDefinition?: { color: string; number: number }): { sets: OkeyTile[][], runs: OkeyTile[][], totalScore: number } => {
    if (!tiles || tiles.length === 0) return { sets: [], runs: [], totalScore: 0 };
    
    // Filter out any invalid tiles
    const validTiles = tiles.filter(t => t && t.id && typeof t.number === 'number');
    const sets: OkeyTile[][] = [];
    const runs: OkeyTile[][] = [];
    const usedTiles = new Set<string>();
    
    // Try all possible combinations for sets (3-4 tiles) - prioritize sets first
    for (let setSize = 4; setSize >= 3; setSize--) {
      const combinations = OkeyUtils.getCombinations(validTiles, setSize);
      for (const combo of combinations) {
        // Skip if any tile is already used
        if (combo.some(t => usedTiles.has(t.id))) continue;
        
        if (OkeyUtils.isValidSet(combo, okeyDefinition)) {
          sets.push([...combo]); // Create a copy to avoid reference issues
          combo.forEach(t => usedTiles.add(t.id));
        }
      }
    }
    
    // Try all possible combinations for runs (3+ tiles)
    const remainingTiles = validTiles.filter(t => !usedTiles.has(t.id));
    for (let runSize = Math.min(13, remainingTiles.length); runSize >= 3; runSize--) {
      const combinations = OkeyUtils.getCombinations(remainingTiles, runSize);
      for (const combo of combinations) {
        // Skip if any tile is already used
        if (combo.some(t => usedTiles.has(t.id))) continue;
        
        if (OkeyUtils.isValidRun(combo, okeyDefinition)) {
          runs.push([...combo]); // Create a copy to avoid reference issues
          combo.forEach(t => usedTiles.add(t.id));
          break; // Take first valid run of this size to avoid overlap
        }
      }
    }
    
    // Calculate total score from valid sets and runs
    const validCombos = [...sets, ...runs];
    const totalScore = validCombos.reduce((score, combo) => {
      return score + OkeyUtils.calculateHandScore(combo);
    }, 0);
    
    return { sets, runs, totalScore };
  },

  // Generate combinations of specified size
  getCombinations: <T>(array: T[], size: number): T[][] => {
    if (size === 1) return array.map(item => [item]);
    if (size > array.length) return [];
    
    const result: T[][] = [];
    for (let i = 0; i <= array.length - size; i++) {
      const first = array[i];
      const rest = array.slice(i + 1);
      const combos = OkeyUtils.getCombinations(rest, size - 1);
      result.push(...combos.map(combo => [first, ...combo]));
    }
    return result;
  },

  // Arrange tiles optimally for scoring (two-row layout)
  arrangeTilesOptimally: (tiles: OkeyTile[], okeyDefinition?: { color: string; number: number }) => {
    const analysis = OkeyUtils.findValidSetsAndRuns(tiles, okeyDefinition);
    const validTiles = new Set([...analysis.sets.flat(), ...analysis.runs.flat()].map(t => t.id));
    const remainingTiles = tiles.filter(t => !validTiles.has(t.id));
    
    // Arrange valid sets and runs in top row, maintaining set integrity
    const topRow: OkeyTile[] = [];
    
    // Add sets first (same number, different colors)
    analysis.sets.forEach(set => {
      topRow.push(...set);
      if (topRow.length < set.length + 1) {
        topRow.push({ id: 'separator-' + Math.random(), color: 'red', number: 0, isOkey: false, isFakeOkey: false } as OkeyTile);
      }
    });
    
    // Add runs next (same color, consecutive numbers)
    analysis.runs.forEach(run => {
      topRow.push(...run);
      if (topRow.length < run.length + 1) {
        topRow.push({ id: 'separator-' + Math.random(), color: 'red', number: 0, isOkey: false, isFakeOkey: false } as OkeyTile);
      }
    });
    
    // Remove separators and keep only real tiles
    const cleanTopRow = topRow.filter(t => t.number > 0);
    
    // Put remaining tiles in bottom row, sorted by color then number
    const bottomRow = remainingTiles.sort((a, b) => {
      if (a.color !== b.color) {
        const colorOrder = ['red', 'yellow', 'blue', 'black'];
        return colorOrder.indexOf(a.color) - colorOrder.indexOf(b.color);
      }
      return a.number - b.number;
    });
    
    return {
      topRow: cleanTopRow,
      bottomRow,
      validSets: analysis.sets,
      validRuns: analysis.runs,
      totalScore: analysis.totalScore,
      validTileCount: cleanTopRow.length
    };
  },

  // Validate specific tile arrangement
  validateArrangement: (topRow: OkeyTile[], bottomRow: OkeyTile[], okeyDefinition?: { color: string; number: number }) => {
    const allTiles = [...topRow, ...bottomRow].filter(t => t && t.id); // Filter out any invalid tiles
    const analysis = OkeyUtils.findValidSetsAndRuns(allTiles, okeyDefinition);
    
    return {
      isValid: analysis.totalScore > 0,
      totalScore: analysis.totalScore,
      validSets: analysis.sets,
      validRuns: analysis.runs,
      canOpen: analysis.totalScore >= 101 // 101 Okey opening requirement
    };
  },

  // Check if tiles form a valid set (same number, different colors)
  isValidSet: (tiles: OkeyTile[], okeyDefinition?: { color: string; number: number }): boolean => {
    if (tiles.length < 3 || tiles.length > 4) return false;
    
    // Separate okeys/fakes from regular tiles
    const regularTiles = tiles.filter(t => !t.isOkey && !t.isFakeOkey);
    const okeyCount = tiles.filter(t => t.isOkey || t.isFakeOkey).length;
    
    if (regularTiles.length === 0) return false; // Cannot have all okeys
    
    // Check if all regular tiles have same number
    const numbers = [...new Set(regularTiles.map(t => t.number))];
    if (numbers.length > 1) return false;
    
    // Check if all regular tiles have different colors
    const colors = regularTiles.map(t => t.color);
    const uniqueColors = [...new Set(colors)];
    if (colors.length !== uniqueColors.length) return false; // Duplicate colors
    
    // Check if we can complete the set with okeys (max 4 different colors)
    return (regularTiles.length + okeyCount) <= 4;
  },

  // Calculate hand score for tiles
  calculateHandScore: (tiles: OkeyTile[]): number => {
    return tiles.reduce((total, tile) => {
      if (tile.isFakeOkey) return total + 50; // Fake okey penalty
      if (tile.isOkey) return total; // Real okey = 0 points
      return total + tile.number; // Regular tiles = face value
    }, 0);
  },

  // Get enhanced tile display string (Turkish 101 Okey style)
  getTileDisplay: (tile: OkeyTile): string => {
    if (tile.isFakeOkey) return '🃟'; // Fake Okey symbol
    if (tile.isOkey) return '🎯'; // Real Okey symbol
    
    const colorSymbols = {
      red: '🔴',
      black: '⚫',
      blue: '🔵',
      yellow: '🟡',
    };
    
    // Return object for more realistic tile display with number and color separate
    return JSON.stringify({
      number: tile.number,
      color: tile.color,
      symbol: colorSymbols[tile.color]
    });
  },
  
  // Get tile display as JSX for better formatting
  getTileDisplayJSX: (tile: OkeyTile) => {
    if (tile.isFakeOkey) return { isSpecial: true, display: '🃟' }; // Fake Okey symbol
    if (tile.isOkey) return { isSpecial: true, display: '🎯' }; // Real Okey symbol
    
    const colorClasses = {
      red: 'text-red-600',
      black: 'text-gray-900', 
      blue: 'text-blue-600',
      yellow: 'text-yellow-600',
    };
    
    return {
      isSpecial: false,
      number: tile.number,
      colorClass: colorClasses[tile.color],
      color: tile.color
    };
  }
};