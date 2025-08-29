import { NextRequest, NextResponse } from 'next/server';

// Simple polling fallback API for Railway deployment
const gameStates = new Map();

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
  isBlackjack: boolean;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const playerId = request.nextUrl.searchParams.get('playerId');

    if (!roomId || !playerId) {
      return NextResponse.json({ error: 'Room ID and Player ID required' }, { status: 400 });
    }

    const gameState = gameStates.get(roomId);
    if (!gameState) {
      return NextResponse.json({
        roomId,
        players: [],
        dealer: { hand: [], score: 0, hiddenCard: true, visibleScore: 0 },
        gameState: 'waiting',
        currentPlayer: null,
        results: null
      });
    }

    return NextResponse.json(gameState);
  } catch (error) {
    console.error('Polling API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const body = await request.json();
    const { playerId, playerName, action } = body;

    if (!roomId || !playerId) {
      return NextResponse.json({ error: 'Room ID and Player ID required' }, { status: 400 });
    }

    // Initialize game state if it doesn't exist
    if (!gameStates.has(roomId)) {
      gameStates.set(roomId, {
        roomId,
        players: [],
        dealer: { hand: [], score: 0, hiddenCard: true, visibleScore: 0 },
        gameState: 'waiting',
        currentPlayer: null,
        results: null
      });
    }

    const gameState = gameStates.get(roomId);

    if (action === 'join' && playerName) {
      // Add player if not already in game
      const existingPlayer = gameState.players.find((p: Player) => p.id === playerId);
      if (!existingPlayer) {
        gameState.players.push({
          id: playerId,
          name: playerName,
          hand: [],
          score: 0,
          bet: 0,
          status: 'waiting',
          isBlackjack: false
        });
      }
    }

    return NextResponse.json({ success: true, gameState });
  } catch (error) {
    console.error('Polling API POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
