import { NextRequest, NextResponse } from 'next/server';

// In-memory game storage (production'da Redis kullanın)
const gameRooms = new Map();

// Types
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

interface GameResult {
  dealerBusted: boolean;
  dealerBlackjack: boolean;
  winners: Array<{ id: string; name: string; reason: string }>;
  losers: Array<{ id: string; name: string; reason: string }>;
  ties: Array<{ id: string; name: string; reason: string }>;
}

// Blackjack game logic
class BlackjackGame {
  roomId: string;
  players: Map<string, Player>;
  deck: Card[];
  gameState: string;
  currentPlayer: string | null;
  dealer: { hand: Card[]; score: number; hiddenCard: boolean; isBlackjack?: boolean };
  results: GameResult | null;

  constructor(roomId: string) {
    this.roomId = roomId;
    this.players = new Map();
    this.deck = this.createDeck();
    this.gameState = 'waiting';
    this.currentPlayer = null;
    this.dealer = { hand: [], score: 0, hiddenCard: true };
    this.results = null;
  }

  createDeck() {
    const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
    const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    const deck = [];
    for (const suit of suits) {
      for (const value of values) {
        deck.push({ suit, value });
      }
    }
    return this.shuffle(deck);
  }

  shuffle(deck: Card[]) {
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }

  calculateScore(hand: Card[]) {
    let score = 0;
    let aces = 0;
    let isBlackjack = false;

    for (const card of hand) {
      if (card.value === 'A') {
        aces++;
        score += 11;
      } else if (['K', 'Q', 'J'].includes(card.value)) {
        score += 10;
      } else {
        score += parseInt(card.value);
      }
    }

    while (score > 21 && aces > 0) {
      score -= 10;
      aces--;
    }

    // Check for blackjack (21 with any number of cards)
    if (score === 21) {
      isBlackjack = true;
    }

    return { score, isBlackjack };
  }

  dealCard(): Card {
    const card = this.deck.pop();
    if (!card) {
      throw new Error('Deck is empty');
    }
    return card;
  }

  addPlayer(playerId: string, name: string) {
    this.players.set(playerId, {
      id: playerId,
      name,
      hand: [],
      score: 0,
      bet: 0,
      status: 'playing',
      isBlackjack: false
    });
  }

  changePlayerName(playerId: string, newName: string) {
    const player = this.players.get(playerId);
    if (player) {
      const trimmedName = newName.trim();
      if (trimmedName.length >= 2 && trimmedName.length <= 15) {
        player.name = trimmedName;
        return true;
      }
    }
    return false;
  }

  startGame() {
    this.gameState = 'playing';
    this.results = null;

    this.deck = this.createDeck();

    for (const [playerId, player] of this.players) {
      player.status = 'playing';
      player.hand = [this.dealCard(), this.dealCard()];
      const scoreResult = this.calculateScore(player.hand);
      player.score = scoreResult.score;
      player.isBlackjack = scoreResult.isBlackjack;

      // If player has blackjack, they automatically stand
      if (player.isBlackjack) {
        player.status = 'stood';
      }
    }

    this.dealer.hand = [this.dealCard(), this.dealCard()];
    const dealerScoreResult = this.calculateScore(this.dealer.hand);
    // Dealer'ın kapalı kartı varken sadece ilk kartın skoru gösterilsin
    if (this.dealer.hiddenCard) {
      const firstCardScore = this.calculateScore([this.dealer.hand[0]]);
      this.dealer.score = firstCardScore.score;
    } else {
      this.dealer.score = dealerScoreResult.score;
    }
    this.dealer.isBlackjack = dealerScoreResult.isBlackjack;
    this.dealer.hiddenCard = true;

    // İlk aktif oyuncuyu bul (blackjack yapanları atla)
    const playerIds = Array.from(this.players.keys());
    this.currentPlayer = null;
    for (const playerId of playerIds) {
      const player = this.players.get(playerId);
      if (player && player.status === 'playing') {
        this.currentPlayer = playerId;
        break;
      }
    }

    // Eğer hiç aktif oyuncu yoksa, dealer'ın sırası
    if (!this.currentPlayer) {
      this.dealerTurn();
    }
  }

  hit(playerId: string) {
    const player = this.players.get(playerId);
    if (player && player.status === 'playing' && !player.isBlackjack) {
      player.hand.push(this.dealCard());
      const scoreResult = this.calculateScore(player.hand);
      player.score = scoreResult.score;
      player.isBlackjack = scoreResult.isBlackjack;

      if (player.score > 21) {
        player.status = 'busted';
        this.nextPlayer();
      } else if (player.isBlackjack) {
        player.status = 'stood';
        this.nextPlayer();
      }
    }
  }

  stand(playerId: string) {
    const player = this.players.get(playerId);
    if (player) {
      player.status = 'stood';
      this.nextPlayer();
    }
  }

  nextPlayer() {
    const playerIds = Array.from(this.players.keys());
    if (playerIds.length === 0) {
      this.currentPlayer = null;
      return;
    }

    if (!this.currentPlayer) {
      // İlk oyuncu olarak ayarla
      this.currentPlayer = playerIds[0];
      return;
    }

    const currentIndex = playerIds.indexOf(this.currentPlayer);
    if (currentIndex === -1) {
      // Current player not found, start with first player
      this.currentPlayer = playerIds[0];
      return;
    }

    // Check if all players are finished (stood, busted, or blackjack)
    let allFinished = true;
    let nextActivePlayerIndex = -1;

    for (let i = 0; i < playerIds.length; i++) {
      const player = this.players.get(playerIds[i]);
      if (player && player.status === 'playing') {
        if (i > currentIndex && nextActivePlayerIndex === -1) {
          nextActivePlayerIndex = i;
        }
        allFinished = false;
      }
    }

    if (allFinished) {
      this.dealerTurn();
    } else if (nextActivePlayerIndex !== -1) {
      // Move to next active player
      this.currentPlayer = playerIds[nextActivePlayerIndex];
    } else {
      // No active player found after current, start from beginning
      for (let i = 0; i < playerIds.length; i++) {
        const player = this.players.get(playerIds[i]);
        if (player && player.status === 'playing') {
          this.currentPlayer = playerIds[i];
          break;
        }
      }
    }
  }

  dealerTurn() {
    this.dealer.hiddenCard = false;
    // Dealer'ın tüm kartlarının skorunu hesapla
    const dealerScoreResult = this.calculateScore(this.dealer.hand);
    this.dealer.score = dealerScoreResult.score;
    this.dealer.isBlackjack = dealerScoreResult.isBlackjack;

    // If dealer doesn't have blackjack, play according to rules
    if (!this.dealer.isBlackjack) {
      while (this.dealer.score < 17) {
        this.dealer.hand.push(this.dealCard());
        const newScoreResult = this.calculateScore(this.dealer.hand);
        this.dealer.score = newScoreResult.score;
        this.dealer.isBlackjack = newScoreResult.isBlackjack;
      }
    }

    this.calculateResults();
    this.gameState = 'finished';
  }

  calculateResults() {
    const results: GameResult = {
      dealerBusted: this.dealer.score > 21,
      dealerBlackjack: this.dealer.isBlackjack || false,
      winners: [],
      losers: [],
      ties: []
    };

    for (const [playerId, player] of this.players) {
      // Player already busted
      if (player.status === 'busted') {
        results.losers.push({
          id: playerId,
          name: player.name,
          reason: 'busted'
        });
      }
      // Player has blackjack
      else if (player.isBlackjack) {
        if (this.dealer.isBlackjack) {
          // Both have blackjack - push (tie)
          results.ties.push({
            id: playerId,
            name: player.name,
            reason: 'blackjack_push'
          });
        } else {
          // Player blackjack wins
          results.winners.push({
            id: playerId,
            name: player.name,
            reason: 'blackjack'
          });
        }
      }
      // Dealer has blackjack
      else if (this.dealer.isBlackjack) {
        results.losers.push({
          id: playerId,
          name: player.name,
          reason: 'dealer_blackjack'
        });
      }
      // Dealer busted
      else if (this.dealer.score > 21) {
        results.winners.push({
          id: playerId,
          name: player.name,
          reason: 'dealer_busted'
        });
      }
      // Compare scores
      else if (player.score > this.dealer.score) {
        results.winners.push({
          id: playerId,
          name: player.name,
          reason: 'higher_score'
        });
      } else if (player.score < this.dealer.score) {
        results.losers.push({
          id: playerId,
          name: player.name,
          reason: 'lower_score'
        });
      } else {
        results.ties.push({
          id: playerId,
          name: player.name,
          reason: 'tie'
        });
      }
    }

    this.results = results;
  }

  getGameState() {
    // Dealer'ın kapalı kartı varsa sadece ilk kartın skorunu göster
    let dealerScore = this.dealer.score;
    if (this.dealer.hiddenCard && this.dealer.hand.length > 0) {
      const firstCardScore = this.calculateScore([this.dealer.hand[0]]);
      dealerScore = firstCardScore.score;
    }

    return {
      roomId: this.roomId,
      players: Array.from(this.players.values()),
      dealer: {
        ...this.dealer,
        score: dealerScore
      },
      gameState: this.gameState,
      currentPlayer: this.currentPlayer,
      results: this.results
    };
  }

  resetGame() {
    // Mevcut oyuncuları koru ama durumlarını sıfırla
    for (const player of this.players.values()) {
      player.hand = [];
      player.score = 0;
      player.bet = 0;
      player.status = 'playing';
      player.isBlackjack = false;
    }

    // Yeni deste oluştur
    this.deck = this.createDeck();
    this.dealer.hand = [];
    this.dealer.score = 0;
    this.dealer.isBlackjack = false;
    this.dealer.hiddenCard = true; // Yeni oyun başladığında dealer'ın kartı gizli
    this.gameState = 'waiting';
    this.currentPlayer = null;
    this.results = null;
  }
}

// Ana game route - GET: oyun durumunu al, POST: yeni oyun oluştur
export async function GET(request: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;

  if (!roomId) {
    return NextResponse.json({ error: 'Room ID required' }, { status: 400 });
  }

  let game = gameRooms.get(roomId);

  if (!game) {
    // Yeni oyun oluştur
    game = new BlackjackGame(roomId);
    gameRooms.set(roomId, game);
  }

  return NextResponse.json(game.getGameState());
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;

  if (!roomId) {
    return NextResponse.json({ error: 'Room ID required' }, { status: 400 });
  }

  const body = await request.json();
  const { action, playerId, playerName } = body;

  let game = gameRooms.get(roomId);

  if (!game) {
    game = new BlackjackGame(roomId);
    gameRooms.set(roomId, game);
  }

  try {
    switch (action) {
      case 'join':
        if (playerId && playerName) {
          const trimmedName = playerName.trim();
          if (trimmedName.length >= 2 && trimmedName.length <= 15) {
            game.addPlayer(playerId, trimmedName);
          } else {
            return NextResponse.json({ error: 'İsim 2-15 karakter arasında olmalıdır' }, { status: 400 });
          }
        } else {
          return NextResponse.json({ error: 'Player ID ve isim gerekli' }, { status: 400 });
        }
        break;

      case 'start':
        game.startGame();
        break;

      case 'hit':
        if (playerId) {
          const player = game.players.get(playerId);
          if (player && player.status === 'playing' && game.currentPlayer === playerId) {
            game.hit(playerId);
          }
        }
        break;

      case 'stand':
        if (playerId) {
          const player = game.players.get(playerId);
          if (player && player.status === 'playing' && game.currentPlayer === playerId) {
            game.stand(playerId);
          }
        }
        break;

      case 'changeName':
        if (playerId && playerName) {
          const success = game.changePlayerName(playerId, playerName);
          if (!success) {
            return NextResponse.json({ error: 'İsim 2-15 karakter arasında olmalıdır' }, { status: 400 });
          }
        } else {
          return NextResponse.json({ error: 'Player ID ve yeni isim gerekli' }, { status: 400 });
        }
        break;

      case 'restart':
        console.log('Restarting game for room:', roomId);
        try {
          // Mevcut oyuncuları koruyarak yeni oyun başlat
          game.resetGame();
          // İlk oyuncuyu current player olarak ayarla ve kart dağıt
          if (game.players.size > 0) {
            game.startGame();
            console.log('Game restarted successfully, players:', game.players.size);
          } else {
            console.log('No players to restart game');
          }
        } catch (error) {
          console.error('Error during game restart:', error);
          return NextResponse.json({ error: 'Oyun yeniden başlatılırken hata oluştu' }, { status: 500 });
        }
        break;

      case 'leave':
        if (playerId) {
          const leavingPlayer = game.players.get(playerId);
          if (leavingPlayer) {
            game.players.delete(playerId);

            // Eğer çıkan oyuncu şu anki oyuncu ise, sıradaki oyuncuya geç
            if (game.currentPlayer === playerId) {
              game.nextPlayer();
            }

            // Eğer hiç oyuncu kalmadıysa waiting'e geç
            if (game.players.size === 0) {
              game.gameState = 'waiting';
              game.currentPlayer = null;
              game.results = null;
            }
          }
        }
        break;

      case 'reset':
        // Tüm oyuncuları çıkar ve oyunu sıfırla
        game.players.clear();
        game.gameState = 'waiting';
        game.currentPlayer = null;
        game.results = null;
        game.deck = game.createDeck();
        game.dealer.hand = [];
        game.dealer.score = 0;
        game.dealer.isBlackjack = false;
        game.dealer.hiddenCard = false;
        break;

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json(game.getGameState());
  } catch (error) {
    console.error('Game action error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
