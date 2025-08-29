const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = process.env.PORT || 3000;

// Initialize Next.js
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Game rooms storage
const gameRooms = new Map();

// Blackjack game logic
class BlackjackGame {
  constructor(roomId) {
    this.roomId = roomId;
    this.players = new Map();
    this.deck = this.createDeck();
    this.gameState = 'waiting';
    this.currentPlayer = null;
    this.dealer = { hand: [], score: 0, hiddenCard: true };
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

  shuffle(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }

  calculateScore(hand) {
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

    // Check for blackjack (21 with exactly 2 cards)
    if (score === 21 && hand.length === 2) {
      isBlackjack = true;
    }

    return { score, isBlackjack };
  }

  dealCard() {
    return this.deck.pop();
  }

  addPlayer(playerId, name) {
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
    this.dealer.score = dealerScoreResult.score;
    this.dealer.isBlackjack = dealerScoreResult.isBlackjack;
    this.dealer.hiddenCard = true;

    // If dealer has blackjack, reveal it immediately
    if (this.dealer.isBlackjack) {
      this.dealer.hiddenCard = false;
    }

    this.currentPlayer = Array.from(this.players.keys())[0];
  }

  hit(playerId) {
    const player = this.players.get(playerId);
    if (player && player.status === 'playing' && !player.isBlackjack) {
      player.hand.push(this.dealCard());
      const scoreResult = this.calculateScore(player.hand);
      player.score = scoreResult.score;
      player.isBlackjack = scoreResult.isBlackjack;

      if (player.score > 21) {
        player.status = 'busted';
        this.nextPlayer();
      }
    }
  }

  stand(playerId) {
    const player = this.players.get(playerId);
    if (player) {
      player.status = 'stood';
      this.nextPlayer();
    }
  }

  nextPlayer() {
    const playerIds = Array.from(this.players.keys());
    const currentIndex = playerIds.indexOf(this.currentPlayer);
    const nextIndex = (currentIndex + 1) % playerIds.length;

    let allFinished = true;
    for (const player of this.players.values()) {
      if (player.status === 'playing') {
        allFinished = false;
        break;
      }
    }

    if (allFinished) {
      this.dealerTurn();
    } else {
      this.currentPlayer = playerIds[nextIndex];
    }
  }

  dealerTurn() {
    this.dealer.hiddenCard = false;
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
    const results = {
      dealerBusted: this.dealer.score > 21,
      dealerBlackjack: this.dealer.isBlackjack,
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
    return {
      roomId: this.roomId,
      players: Array.from(this.players.values()),
      dealer: this.dealer,
      gameState: this.gameState,
      currentPlayer: this.currentPlayer,
      results: this.results || null
    };
  }
}

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(httpServer, {
    cors: {
      origin: dev ? "http://localhost:3000" : process.env.NEXT_PUBLIC_APP_URL || "https://your-app.vercel.app",
      methods: ["GET", "POST"]
    }
  });

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join-room', (data) => {
      const { roomId, playerName } = data;
      socket.join(roomId);

      if (!gameRooms.has(roomId)) {
        gameRooms.set(roomId, new BlackjackGame(roomId));
      }

      const game = gameRooms.get(roomId);
      game.addPlayer(socket.id, playerName);

      io.to(roomId).emit('game-update', game.getGameState());
    });

    socket.on('start-game', (roomId) => {
      const game = gameRooms.get(roomId);
      if (game) {
        game.startGame();
        io.to(roomId).emit('game-update', game.getGameState());
      }
    });

    socket.on('hit', (roomId) => {
      const game = gameRooms.get(roomId);
      if (game && game.currentPlayer === socket.id) {
        game.hit(socket.id);
        io.to(roomId).emit('game-update', game.getGameState());
      }
    });

    socket.on('stand', (roomId) => {
      const game = gameRooms.get(roomId);
      if (game && game.currentPlayer === socket.id) {
        game.stand(socket.id);
        io.to(roomId).emit('game-update', game.getGameState());
      }
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
      for (const [roomId, game] of gameRooms) {
        game.players.delete(socket.id);
        if (game.players.size === 0) {
          gameRooms.delete(roomId);
        } else {
          io.to(roomId).emit('game-update', game.getGameState());
        }
      }
    });
  });

  httpServer.listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
