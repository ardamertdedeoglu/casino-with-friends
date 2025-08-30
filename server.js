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
  constructor(roomId, io) {
    this.roomId = roomId;
    this.io = io;
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
        console.log(`♠️ Player ${playerId} (${player.name}) got blackjack and auto-stood`);
      }
    }

    this.dealer.hand = [this.dealCard(), this.dealCard()];
    const dealerScoreResult = this.calculateScore(this.dealer.hand);
    this.dealer.score = dealerScoreResult.score;
    this.dealer.isBlackjack = dealerScoreResult.isBlackjack;
    this.dealer.hiddenCard = true;

    this.currentPlayer = Array.from(this.players.keys())[0];

    // Find the first player who is still playing (not blackjack)
    const activePlayers = Array.from(this.players.values()).filter(p => p.status === 'playing');
    if (activePlayers.length > 0) {
      // Set currentPlayer to the first active player
      const firstActivePlayerId = Array.from(this.players.entries()).find(([id, player]) => player.status === 'playing')?.[0];
      if (firstActivePlayerId) {
        this.currentPlayer = firstActivePlayerId;
        console.log(`🎯 Game starting with active player: ${this.players.get(this.currentPlayer).name}`);
      }
    } else {
      // All players got blackjack, dealer turn starts immediately
      console.log(`🎯 All players got blackjack, dealer turn starts immediately`);
      this.dealerTurn();
    }
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
        console.log(`💥 Player ${playerId} busted with score: ${player.score}`);
        this.nextPlayer(); // Sadece busted olduğunda sıradaki oyuncuya geç
      } else {
        console.log(`🎯 Player ${playerId} hit, new score: ${player.score}`);
        // Busted olmadıysa, aynı oyuncunun sırası devam eder
        // nextPlayer() çağrılMAZ!
      }
    }
  }

  stand(playerId) {
    const player = this.players.get(playerId);
    if (player) {
      player.status = 'stood';
      console.log(`🛑 Player ${playerId} (${player.name}) stood with score: ${player.score}`);
      this.nextPlayer();
    }
  }

  nextPlayer() {
    console.log('🔄 nextPlayer() called');
    const allPlayerIds = Array.from(this.players.keys());
    const activePlayerIds = allPlayerIds.filter(id => this.players.get(id).status === 'playing');

    console.log('👥 All players:', Array.from(this.players.values()).map(p => ({ id: p.id, name: p.name, status: p.status, score: p.score })));
    console.log('🎯 Current player:', this.currentPlayer);
    console.log('🎮 Active players (playing status):', activePlayerIds);

    let allFinished = true;
    for (const player of this.players.values()) {
      if (player.status === 'playing') {
        allFinished = false;
        console.log('⏳ Player still playing:', player.id, player.name);
        break;
      }
    }

    if (allFinished) {
      console.log('✅ All players finished, starting dealer turn...');
      this.dealerTurn();
    } else {
      // Sadece aktif (playing) oyuncular arasında geçiş yap
      const currentActiveIndex = activePlayerIds.indexOf(this.currentPlayer);
      if (currentActiveIndex === -1) {
        // Current player artık aktif değil, ilk aktif oyuncuya geç
        this.currentPlayer = activePlayerIds[0];
        console.log('🔄 Current player not active, switching to first active player:', this.currentPlayer);
      } else {
        // Bir sonraki aktif oyuncuya geç
        const nextActiveIndex = (currentActiveIndex + 1) % activePlayerIds.length;
        this.currentPlayer = activePlayerIds[nextActiveIndex];
        console.log('➡️ Next active player:', this.currentPlayer, 'Index:', nextActiveIndex);
      }
    }
  }

  dealerTurn() {
    console.log('🎩 Dealer starting turn...');

    // İlk adım: Dealer'ın gizli kartını aç (1 saniye bekle)
    setTimeout(() => {
      console.log('🎩 Step 1: Revealing dealer hidden card...');
      this.dealer.hiddenCard = false;
      const dealerScoreResult = this.calculateScore(this.dealer.hand);
      this.dealer.score = dealerScoreResult.score;
      this.dealer.isBlackjack = dealerScoreResult.isBlackjack;
      console.log('🎩 Dealer reveals cards:', this.dealer.hand, 'Score:', this.dealer.score);

      // Dealer kartları açıldı, güncel durumu gönder
      this.io.to(this.roomId).emit('game-update', this.getGameState());
      console.log('📤 Dealer cards revealed to room:', this.roomId);

      // İkinci adım: Dealer'ın kart çekme işlemlerini yap
      this.dealerHitSequence();
    }, 1000); // 1 saniye bekle ki gizli kart görünsün
  }

  dealerHitSequence() {
    console.log('🎩 Step 2: Dealer hit sequence starting...');

    // If dealer doesn't have blackjack, play according to rules
    if (!this.dealer.isBlackjack) {
      console.log('🎩 Dealer does not have blackjack, checking if needs to hit...');
      console.log('🎩 Dealer current score:', this.dealer.score, 'Hand:', this.dealer.hand);
      let hitCount = 0;
      const hitDealer = () => {
        if (this.dealer.score < 17) {
          console.log(`🎩 Dealer score ${this.dealer.score} < 17, dealer will hit...`);
          this.dealer.hand.push(this.dealCard());
          const newScoreResult = this.calculateScore(this.dealer.hand);
          this.dealer.score = newScoreResult.score;
          this.dealer.isBlackjack = newScoreResult.isBlackjack;
          hitCount++;
          console.log(`🎩 Dealer hit ${hitCount}:`, this.dealer.hand[this.dealer.hand.length - 1], 'New score:', this.dealer.score, 'Hand:', this.dealer.hand);

          // Dealer kart çekti, güncel durumu gönder
          this.io.to(this.roomId).emit('game-update', this.getGameState());
          console.log(`📤 Dealer hit ${hitCount} sent to room:`, this.roomId);

          // Bir sonraki kart çekişi için 1.5 saniye bekle
          setTimeout(hitDealer, 1500);
        } else {
          console.log('🎩 Dealer finished hitting. Final score:', this.dealer.score, 'Hand:', this.dealer.hand);
          // Kart çekme bitti, sonuçları hesapla
          this.calculateFinalResults();
        }
      };

      // İlk kart çekişini başlat
      setTimeout(hitDealer, 1500);
    } else {
      console.log('🎩 Dealer has blackjack, skipping hit phase');
      // Blackjack varsa direkt sonuçlara geç
      this.calculateFinalResults();
    }
  }

  calculateFinalResults() {
    console.log('🎩 Step 3: Calculating final results...');

    // Kısa bir bekleme ile sonuçları hesapla
    setTimeout(() => {
      console.log('🎩 Calculating results...');
      this.calculateResults();
      this.gameState = 'finished';
      console.log('🎩 Game finished with results:', this.results);

      // Game state'i client'lara gönder
      this.io.to(this.roomId).emit('game-update', this.getGameState());
      console.log('📤 Dealer turn completed and results sent to room:', this.roomId);
    }, 1000); // 1 saniye bekle ki final durumu görünsün
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

  getDealerVisibleScore() {
    if (this.dealer.hand.length === 0) return 0;
    if (this.dealer.hand.length === 1) return this.calculateScore([this.dealer.hand[0]]).score;
    if (this.dealer.hiddenCard) return this.calculateScore([this.dealer.hand[0]]).score;
    return this.dealer.score;
  }

  getGameState() {
    return {
      roomId: this.roomId,
      players: Array.from(this.players.values()),
      dealer: {
        ...this.dealer,
        visibleScore: this.getDealerVisibleScore()
      },
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
      origin: dev ? "http://localhost:3000" : [
        "https://casino-with-friends-production.up.railway.app",
        process.env.NEXT_PUBLIC_APP_URL
      ].filter(Boolean),
      methods: ["GET", "POST"],
      credentials: true
    },
    allowEIO3: true,
    transports: ['polling', 'websocket'],
    path: '/api/socket',
    pingTimeout: 60000,
    pingInterval: 25000,
    upgradeTimeout: 10000,
    maxHttpBufferSize: 1e8
  });

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join-room', (data) => {
      const { roomId, playerName } = data;
      console.log(`🎯 Player ${playerName} (${socket.id}) joining room ${roomId}`);
      socket.join(roomId);

      if (!gameRooms.has(roomId)) {
        gameRooms.set(roomId, new BlackjackGame(roomId, io));
        console.log(`🆕 Created new game room: ${roomId}`);
      }

      const game = gameRooms.get(roomId);

      // Aynı socket ID ile oyuncu zaten varsa, güncelleme yap
      if (game.players.has(socket.id)) {
        console.log(`🔄 Player ${playerName} (${socket.id}) already in room, updating name`);
        const existingPlayer = game.players.get(socket.id);
        existingPlayer.name = playerName; // İsim güncellemesi
      } else {
        // Aynı isimde oyuncu var mı kontrol et
        const existingPlayerWithSameName = Array.from(game.players.values()).find(p => p.name === playerName);
        if (existingPlayerWithSameName) {
          console.log(`⚠️ Player with name "${playerName}" already exists, rejecting join`);
          socket.emit('join-error', { message: `İsim "${playerName}" zaten kullanılıyor. Lütfen farklı bir isim seçin.` });
          return;
        }

        // Yeni oyuncu ekle
        game.addPlayer(socket.id, playerName);
        console.log(`✅ New player ${playerName} (${socket.id}) added to room ${roomId}`);
      }

      io.to(roomId).emit('game-update', game.getGameState());
      console.log(`📤 Game state sent to room ${roomId}`);
    });

    socket.on('start-game', (roomId) => {
      console.log(`🎰 Starting game in room ${roomId}`);
      console.log(`Current players in room:`, Array.from(gameRooms.get(roomId)?.players.keys() || []));
      const game = gameRooms.get(roomId);
      if (game) {
        console.log(`✅ Game room found, starting game...`);
        game.startGame();
        console.log(`Game started. Current player: ${game.currentPlayer}`);
        console.log(`Player statuses:`, Array.from(game.players.values()).map(p => ({ name: p.name, status: p.status, isBlackjack: p.isBlackjack })));
        console.log(`Dealer hand:`, game.dealer.hand);
        console.log(`Dealer score:`, game.dealer.score);
        console.log(`Dealer hidden:`, game.dealer.hiddenCard);
        io.to(roomId).emit('game-update', game.getGameState());
        console.log(`📤 Game started in room ${roomId}`);
      } else {
        console.log(`❌ Game not found for room ${roomId}`);
        console.log(`Available rooms:`, Array.from(gameRooms.keys()));
      }
    });

    socket.on('hit', (roomId) => {
      console.log(`🎯 Player hit in room ${roomId}, socket ID: ${socket.id}`);
      const game = gameRooms.get(roomId);
      console.log(`Current player in game: ${game?.currentPlayer}`);
      console.log(`Is it this player's turn? ${game?.currentPlayer === socket.id}`);
      if (game && game.currentPlayer === socket.id) {
        console.log(`✅ Processing hit for player ${socket.id}`);
        game.hit(socket.id);
        io.to(roomId).emit('game-update', game.getGameState());
        console.log(`📤 Hit processed in room ${roomId}, new current player: ${game.currentPlayer}`);
      } else {
        console.log(`❌ Hit failed - currentPlayer: ${game?.currentPlayer}, socketId: ${socket.id}`);
      }
    });

    socket.on('stand', (roomId) => {
      console.log(`🛑 Stand event received from ${socket.id} in room ${roomId}`);
      const game = gameRooms.get(roomId);
      console.log(`Current player in game: ${game?.currentPlayer}`);
      console.log(`Is it this player's turn? ${game?.currentPlayer === socket.id}`);
      if (game && game.currentPlayer === socket.id) {
        console.log(`✅ Processing stand for player ${socket.id}`);
        game.stand(socket.id);
        io.to(roomId).emit('game-update', game.getGameState());
        console.log(`📤 Stand processed in room ${roomId}, new current player: ${game.currentPlayer}`);
      } else {
        console.log(`❌ Stand failed - currentPlayer: ${game?.currentPlayer}, socketId: ${socket.id}`);
      }
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
      for (const [roomId, game] of gameRooms) {
        const playerWasCurrent = game.currentPlayer === socket.id;
        game.players.delete(socket.id);

        if (game.players.size === 0) {
          console.log(`🗑️ Deleting empty room: ${roomId}`);
          gameRooms.delete(roomId);
        } else {
          // Eğer disconnect olan oyuncu sıradaysa, sıradaki oyuncuya geç
          if (playerWasCurrent && game.gameState === 'playing') {
            const playerIds = Array.from(game.players.keys());
            if (playerIds.length > 0) {
              game.currentPlayer = playerIds[0];
              console.log(`🔄 Current player changed to: ${game.currentPlayer}`);
            }
          }

          console.log(`📤 Sending game update after disconnect in room: ${roomId}`);
          io.to(roomId).emit('game-update', game.getGameState());
        }
      }
    });

    // Reset room event
    socket.on('reset-room', (roomId) => {
      console.log(`🔄 Reset room requested for: ${roomId} by ${socket.id}`);
      const game = gameRooms.get(roomId);
      if (game) {
        // Yeni oyun oluştur
        const newGame = new BlackjackGame(roomId);
        gameRooms.set(roomId, newGame);

        console.log(`✅ Room ${roomId} reset successfully`);
        io.to(roomId).emit('game-update', newGame.getGameState());
      } else {
        console.log(`❌ Room ${roomId} not found for reset`);
      }
    });
  });

  httpServer.listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
