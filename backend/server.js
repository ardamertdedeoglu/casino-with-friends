import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import cors from 'cors';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// Game rooms storage (in production, use Redis or database)
const gameRooms = new Map();

// Blackjack game logic
class BlackjackGame {
  constructor(roomId) {
    this.roomId = roomId;
    this.players = new Map();
    this.deck = this.createDeck();
    this.gameState = 'waiting'; // waiting, playing, finished
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
    return score;
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
      status: 'playing' // playing, stood, busted
    });
  }

  startGame() {
    // Reset game state
    this.gameState = 'playing';
    this.results = null; // Clear previous results

    // Shuffle new deck for fresh game
    this.deck = this.createDeck();

    // Reset all players to playing status
    for (const [playerId, player] of this.players) {
      player.status = 'playing';
      player.hand = [this.dealCard(), this.dealCard()];
      player.score = this.calculateScore(player.hand);
    }

    // Reset dealer
    this.dealer.hand = [this.dealCard(), this.dealCard()];
    this.dealer.score = this.calculateScore([this.dealer.hand[0]]); // Only count first card initially
    this.dealer.hiddenCard = true;

    // Set first player
    this.currentPlayer = Array.from(this.players.keys())[0];
  }

  hit(playerId) {
    const player = this.players.get(playerId);
    if (player && player.status === 'playing') {
      player.hand.push(this.dealCard());
      player.score = this.calculateScore(player.hand);
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

    // Check if all players have finished
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
    // Reveal dealer's hidden card
    this.dealer.hiddenCard = false;
    this.dealer.score = this.calculateScore(this.dealer.hand);

    // Dealer plays according to rules
    while (this.dealer.score < 17) {
      this.dealer.hand.push(this.dealCard());
      this.dealer.score = this.calculateScore(this.dealer.hand);
    }

    // Calculate winners and losers
    this.calculateResults();
    this.gameState = 'finished';
  }

  calculateResults() {
    const results = {
      dealerBusted: this.dealer.score > 21,
      winners: [],
      losers: [],
      ties: []
    };

    for (const [playerId, player] of this.players) {
      if (player.status === 'busted') {
        // Player already busted, they lose
        results.losers.push({
          id: playerId,
          name: player.name,
          reason: 'busted'
        });
      } else if (this.dealer.score > 21) {
        // Dealer busted, all remaining players win
        results.winners.push({
          id: playerId,
          name: player.name,
          reason: 'dealer_busted'
        });
      } else if (player.score > 21) {
        // This shouldn't happen if we check status correctly, but safety check
        results.losers.push({
          id: playerId,
          name: player.name,
          reason: 'busted'
        });
      } else if (player.score > this.dealer.score) {
        // Player has higher score than dealer
        results.winners.push({
          id: playerId,
          name: player.name,
          reason: 'higher_score'
        });
      } else if (player.score < this.dealer.score) {
        // Player has lower score than dealer
        results.losers.push({
          id: playerId,
          name: player.name,
          reason: 'lower_score'
        });
      } else {
        // Same score as dealer
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
    // Remove player from all rooms
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

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
