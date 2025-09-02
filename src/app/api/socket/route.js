import { NextRequest, NextResponse } from 'next/server';
import { Server as SocketIOServer } from 'socket.io';

// Global variables to persist across requests
let io;
let gameRooms = new Map();

// Blackjack game logic (same as before)
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
      status: 'playing'
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
    }

    this.dealer.hand = [this.dealCard(), this.dealCard()];
    const dealerScoreResult = this.calculateScore([this.dealer.hand[0]]);
    this.dealer.score = dealerScoreResult.score;
    this.dealer.isBlackjack = dealerScoreResult.isBlackjack;
    this.dealer.hiddenCard = true;

    this.currentPlayer = Array.from(this.players.keys())[0];
  }

  hit(playerId) {
    const player = this.players.get(playerId);
    if (player && player.status === 'playing') {
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

    // Akıllı karar verme mantığı ile kart çek
    while (this.shouldDealerHit()) {
      this.dealer.hand.push(this.dealCard());
      const newScoreResult = this.calculateScore(this.dealer.hand);
      this.dealer.score = newScoreResult.score;
      this.dealer.isBlackjack = newScoreResult.isBlackjack;
    }

    this.calculateResults();
    this.gameState = 'finished';
  }

  // Akıllı dealer karar verme fonksiyonu
  shouldDealerHit() {
    const dealerScore = this.dealer.score;
    
    // 1. Temel kural: 17'den küçükse çek (geleneksel kural)
    if (dealerScore < 17) {
      return true;
    }
    
    // 2. Oyuncuların durumunu analiz et
    const playerAnalysis = this.analyzePlayers();
    
    // 3. YENİ KURAL: Eğer en az bir oyuncu bustlamamışsa, dealer onu yenmeye çalışmalı
    if (playerAnalysis.activePlayers > 0 && dealerScore >= 17) {
      // Dealer'ın skoru aktif oyuncuların en yükseğinden düşükse, çekmeli
      if (dealerScore < playerAnalysis.highestPlayerScore) {
        return true;
      } else {
        return false;
      }
    }
    
    // 4. Kural 2: Eğer dealer oyuncuların hepsinin skorundan fazlaysa, risk alma
    if (playerAnalysis.allPlayersHaveLowerScore && dealerScore >= 17) {
      return false;
    }
    
    // 5. Oyuncuların yüksek skorları varsa dikkatli ol
    if (playerAnalysis.highestPlayerScore >= 18 && dealerScore >= 17 && dealerScore <= 19) {
      return false;
    }
    
    // 6. Geleneksel kural: 17-21 arası dur
    if (dealerScore >= 17 && dealerScore <= 21) {
      return false;
    }
    
    // 7. Bust riski varsa dur
    if (dealerScore > 21) {
      return false;
    }
    
    // 8. Diğer durumlarda çek (çok düşük skor)
    return true;
  }

  // Oyuncuları analiz eden fonksiyon
  analyzePlayers() {
    const players = Array.from(this.players.values());
    let totalPlayers = 0;
    let bustedPlayers = 0;
    let activePlayers = 0;
    let highestPlayerScore = 0;
    let allPlayersHaveLowerScore = true;
    
    players.forEach(player => {
      totalPlayers++;
      if (player.status === 'busted') {
        bustedPlayers++;
      } else {
        activePlayers++;
        if (player.score > highestPlayerScore) {
          highestPlayerScore = player.score;
        }
        if (player.score >= this.dealer.score) {
          allPlayersHaveLowerScore = false;
        }
      }
    });
    
    const bustedPlayersRatio = totalPlayers > 0 ? bustedPlayers / totalPlayers : 0;
    
    return {
      totalPlayers,
      activePlayers,
      bustedPlayers,
      bustedPlayersRatio,
      highestPlayerScore,
      allPlayersHaveLowerScore
    };
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
        results.losers.push({
          id: playerId,
          name: player.name,
          reason: 'busted'
        });
      } else if (this.dealer.score > 21) {
        results.winners.push({
          id: playerId,
          name: player.name,
          reason: 'dealer_busted'
        });
      } else if (player.score > this.dealer.score) {
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

// Initialize Socket.IO server
function initSocketIO(res) {
  if (!io) {
    // Get the HTTP server from Next.js response
    const httpServer = res.socket?.server;
    if (!httpServer) {
      console.error('HTTP server not available');
      return null;
    }

    io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.NODE_ENV === 'production'
          ? process.env.NEXT_PUBLIC_APP_URL || "https://casino-with-friends-production.up.railway.app"
          : "http://localhost:3000",
        methods: ["GET", "POST"]
      },
      path: '/api/socket'
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

    // Note: HTTP server is managed by Next.js, no need to start it manually
  }

  return io;
}

export async function GET(request) {
  // For Socket.IO, we need to handle the upgrade request
  // This is a placeholder - Socket.IO will handle the actual connection
  return new Response('Socket.IO endpoint', {
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
    },
  });
}

export async function POST(request) {
  // Handle any POST requests if needed
  return NextResponse.json({ message: 'POST request received' });
}
