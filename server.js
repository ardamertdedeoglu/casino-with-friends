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

    // Check for blackjack (21 with any number of cards)
    if (score === 21) {
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
      hands: [{ // Split için hands array'i kullanıyoruz
        cards: [],
        score: 0,
        status: 'playing',
        isBlackjack: false,
        hasDoubledDown: false,
        bet: 0
      }],
      currentHandIndex: 0, // Hangi el oynuyor
      hasSplit: false,
      winnings: 0, // Track total winnings across games
      // Insurance fields
      hasInsurance: false,
      insuranceBet: 0
    });
  }

  startGame() {
    this.gameState = 'playing';
    this.results = null;

    this.deck = this.createDeck();

    // Copy bet amounts from playerBets to player objects
    if (this.playerBets) {
      for (const [playerId, betInfo] of this.playerBets) {
        const player = this.players.get(playerId);
        if (player && betInfo.hasBet) {
          player.hands[0].bet = betInfo.amount;
          console.log(`💰 Set bet for player ${playerId} (${player.name}): ${player.hands[0].bet}`);
        }
      }
    }

    for (const [playerId, player] of this.players) {
      const currentHand = player.hands[0];
      currentHand.status = 'playing';
      currentHand.cards = [this.dealCard(), this.dealCard()];
      const scoreResult = this.calculateScore(currentHand.cards);
      currentHand.score = scoreResult.score;
      currentHand.isBlackjack = scoreResult.isBlackjack;

      // If player has blackjack, they automatically stand
      if (currentHand.isBlackjack) {
        currentHand.status = 'stood';
        console.log(`♠️ Player ${playerId} (${player.name}) got blackjack and auto-stood`);
      }
    }

    this.dealer.hand = [this.dealCard(), this.dealCard()];
    const dealerScoreResult = this.calculateScore(this.dealer.hand);
    this.dealer.score = dealerScoreResult.score;
    this.dealer.isBlackjack = dealerScoreResult.isBlackjack;
    this.dealer.hiddenCard = true;

    this.currentPlayer = Array.from(this.players.keys())[0];

    // Find the first player who is still playing (not blackjack) - use hands structure
    let foundActivePlayer = false;
    for (const [playerId, player] of this.players) {
      for (let handIndex = 0; handIndex < player.hands.length; handIndex++) {
        const hand = player.hands[handIndex];
        if (hand.status === 'playing') {
          this.currentPlayer = playerId;
          player.currentHandIndex = handIndex;
          console.log(`🎯 Game starting with active player: ${player.name}, hand: ${handIndex}`);
          foundActivePlayer = true;
          break;
        }
      }
      if (foundActivePlayer) break;
    }
    
    if (!foundActivePlayer) {
      // All players got blackjack, dealer turn starts immediately
      console.log(`🎯 All players got blackjack, dealer turn starts immediately`);
      this.dealerTurn();
    }
  }

  hit(playerId) {
    const player = this.players.get(playerId);
    if (player) {
      const currentHand = player.hands[player.currentHandIndex];
      if (currentHand && currentHand.status === 'playing' && !currentHand.isBlackjack) {
        currentHand.cards.push(this.dealCard());
        const scoreResult = this.calculateScore(currentHand.cards);
        currentHand.score = scoreResult.score;
        currentHand.isBlackjack = scoreResult.isBlackjack;

        if (currentHand.score > 21) {
          currentHand.status = 'busted';
          console.log(`💥 Player ${playerId} hand ${player.currentHandIndex} busted with score: ${currentHand.score}`);
          this.nextPlayerHand(); // Sıradaki ele geç
        } else if (currentHand.isBlackjack) {
          // Oyuncu kart çekerek blackjack yaptı
          currentHand.status = 'stood';
          console.log(`♠️ Player ${playerId} (${player.name}) got blackjack by hitting on hand ${player.currentHandIndex}!`);
          this.nextPlayerHand(); // Blackjack yapıldığında da sıradaki ele geç
        } else {
          console.log(`🎯 Player ${playerId} hit hand ${player.currentHandIndex}, new score: ${currentHand.score}`);
          // Busted veya blackjack olmadıysa, aynı elin sırası devam eder
        }
      }
    }
  }

  stand(playerId) {
    const player = this.players.get(playerId);
    if (player) {
      const currentHand = player.hands[player.currentHandIndex];
      if (currentHand) {
        currentHand.status = 'stood';
        console.log(`🛑 Player ${playerId} (${player.name}) stood on hand ${player.currentHandIndex} with score: ${currentHand.score}`);
        this.nextPlayerHand();
      }
    }
  }

  split(playerId) {
    const player = this.players.get(playerId);
    if (player && !player.hasSplit && player.hands.length === 1) {
      const currentHand = player.hands[0];
      
      // Split için gerekli koşulları kontrol et
      if (currentHand.cards.length === 2) {
        const card1 = currentHand.cards[0];
        const card2 = currentHand.cards[1];
        
        // Kartların sayısal değerleri aynı olmalı (J=10, Q=10, K=10 olduğu için bunlar birbirleriyle split edilebilir)
        const card1Value = this.getCardValue(card1);
        const card2Value = this.getCardValue(card2);
        
        if (card1Value === card2Value) {
          player.hasSplit = true;
          
          // İkinci eli oluştur
          const secondHand = {
            cards: [currentHand.cards[1]], // İkinci kartı al
            score: 0,
            status: 'playing',
            isBlackjack: false,
            hasDoubledDown: false,
            bet: currentHand.bet // Aynı bahis miktarı
          };
          
          // İlk eli güncelle
          currentHand.cards = [currentHand.cards[0]]; // İlk kartı bırak
          
          // Her iki ele de yeni kart dağıt
          currentHand.cards.push(this.dealCard());
          secondHand.cards.push(this.dealCard());
          
          // Skorları hesapla
          const firstScoreResult = this.calculateScore(currentHand.cards);
          currentHand.score = firstScoreResult.score;
          currentHand.isBlackjack = firstScoreResult.isBlackjack;
          
          const secondScoreResult = this.calculateScore(secondHand.cards);
          secondHand.score = secondScoreResult.score;
          secondHand.isBlackjack = secondScoreResult.isBlackjack;
          
          // İkinci eli ekle
          player.hands.push(secondHand);
          
          // Eğer As split'i ise, sadece bir kart alabilir ve otomatik stand
          if (card1.value === 'A') {
            currentHand.status = 'stood';
            secondHand.status = 'stood';
            console.log(`🃏 Player ${playerId} (${player.name}) split Aces - both hands auto-stood`);
            this.nextPlayerHand();
          } else {
            // Normal split - blackjack kontrolü yap
            if (currentHand.isBlackjack) {
              currentHand.status = 'stood';
              console.log(`♠️ Player ${playerId} (${player.name}) got blackjack on first hand after split!`);
              // İkinci el aktif hale getir
              player.currentHandIndex = 1;
              console.log(`🔄 Switching to second hand automatically`);
              
              // İkinci el de blackjack ise onu da stood yap
              if (secondHand.isBlackjack) {
                secondHand.status = 'stood';
                console.log(`♠️ Player ${playerId} (${player.name}) got blackjack on second hand too after split!`);
                this.nextPlayerHand(); // Her iki el de blackjack, sıradaki oyuncuya geç
              }
            } else if (secondHand.isBlackjack) {
              // İlk el normal, ikinci el blackjack
              secondHand.status = 'stood';
              console.log(`♠️ Player ${playerId} (${player.name}) got blackjack on second hand after split!`);
              // İlk el hala aktif, devam et
            }
            
            console.log(`🃏 Player ${playerId} (${player.name}) split cards! Now has ${player.hands.length} hands`);
          }
          
          return true;
        }
      }
    }
    return false;
  }

  // Insurance helper functions
  canOfferInsurance() {
    // Insurance sadece dealer'ın açık kartı As olduğunda ve hiçbir oyuncu henüz insurance almadığında sunulur
    return this.dealer.hand && 
           this.dealer.hand.length >= 1 && 
           this.dealer.hand[0].value === 'A' &&
           this.gameState === 'playing';
  }

  getMaxInsuranceAmount(playerId) {
    const player = this.players.get(playerId);
    if (!player) return 0;
    
    const currentHand = player.hands[player.currentHandIndex];
    if (!currentHand || currentHand.bet === 0) return 0;
    
    return Math.floor(currentHand.bet / 2);
  }

  // Kart değerini hesapla (split için)
  getCardValue(card) {
    if (card.value === 'A') return 1; // As için 1 (11 de olabilir ama split için value karşılaştırması)
    if (['K', 'Q', 'J'].includes(card.value)) return 10;
    return parseInt(card.value);
  }

  // Sıradaki el veya oyuncuya geç
  nextPlayerHand() {
    console.log('🔄 nextPlayerHand() called');
    const currentPlayerObj = this.players.get(this.currentPlayer);
    
    if (currentPlayerObj) {
      // Aynı oyuncunun başka aktif eli var mı kontrol et
      for (let i = currentPlayerObj.currentHandIndex + 1; i < currentPlayerObj.hands.length; i++) {
        if (currentPlayerObj.hands[i].status === 'playing') {
          currentPlayerObj.currentHandIndex = i;
          console.log(`🔄 Same player ${this.currentPlayer}, switching to hand ${i}`);
          return; // Aynı oyuncunun başka eli var
        }
      }
    }
    
    // Bu oyuncunun tüm elleri bitti, tamamen farklı bir algoritma ile sıradaki oyuncuya geç
    this.nextPlayer();
  }

  insurance(playerId, amount) {
    const player = this.players.get(playerId);
    if (!player || player.hasInsurance) {
      console.log(`❌ Insurance failed - player not found or already has insurance`);
      return false;
    }

    // Insurance sadece dealer'ın açık kartı As olduğunda yapılabilir
    if (!this.dealer.hand || this.dealer.hand.length < 1 || this.dealer.hand[0].value !== 'A') {
      console.log(`❌ Insurance failed - dealer's up card is not an Ace`);
      return false;
    }

    const currentHand = player.hands[player.currentHandIndex];
    if (!currentHand || currentHand.bet === 0) {
      console.log(`❌ Insurance failed - no main bet found`);
      return false;
    }

    // Insurance bet maximum main bet'in yarısı olabilir
    const maxInsurance = Math.floor(currentHand.bet / 2);
    if (amount > maxInsurance) {
      console.log(`❌ Insurance failed - amount ${amount} exceeds max ${maxInsurance}`);
      return false;
    }

    player.hasInsurance = true;
    player.insuranceBet = amount;
    
    console.log(`🛡️ Player ${playerId} (${player.name}) placed insurance bet: ${amount}`);
    return true;
  }

  doubleDown(playerId) {
    const player = this.players.get(playerId);
    if (player) {
      const currentHand = player.hands[player.currentHandIndex];
      if (currentHand && currentHand.status === 'playing' && currentHand.cards.length === 2 && !currentHand.hasDoubledDown) {
        // Bahsi ikiye katla
        currentHand.bet *= 2;
        currentHand.hasDoubledDown = true;
        
        console.log(`🎰 Player ${playerId} (${player.name}) doubled down on hand ${player.currentHandIndex}! New bet: ${currentHand.bet}`);
        
        // Bir kart dağıt
        currentHand.cards.push(this.deck.pop());
        const scoreResult = this.calculateScore(currentHand.cards);
        currentHand.score = scoreResult.score;
        currentHand.isBlackjack = scoreResult.isBlackjack;
        
        console.log(`📇 Player ${playerId} (${player.name}) drew a card for hand ${player.currentHandIndex}. New score: ${currentHand.score}`);
        
        // Eğer 21'i aştıysa bust, değilse otomatik stand
        if (currentHand.score > 21) {
          currentHand.status = 'busted';
          console.log(`💥 Player ${playerId} (${player.name}) busted after double down on hand ${player.currentHandIndex}!`);
        } else {
          currentHand.status = 'stood';
          console.log(`🛑 Player ${playerId} (${player.name}) automatically stood after double down on hand ${player.currentHandIndex}.`);
        }
        
        this.nextPlayerHand();
        return true;
      }
    }
    return false;
  }

  nextPlayer() {
    console.log('🔄 nextPlayer() called');
    const allPlayerIds = Array.from(this.players.keys());
    
    // Hala oynayacak oyuncu var mı kontrol et (hands yapısını kullan)
    const hasActivePlayer = () => {
      for (const [playerId, player] of this.players) {
        for (let handIndex = 0; handIndex < player.hands.length; handIndex++) {
          const hand = player.hands[handIndex];
          if (hand.status === 'playing') {
            console.log(`⏳ Player ${playerId} hand ${handIndex} still playing`);
            return { playerId, handIndex };
          }
        }
      }
      return null;
    };

    const activeHand = hasActivePlayer();
    
    if (!activeHand) {
      console.log('✅ All players finished, starting dealer turn...');
      this.dealerTurn();
    } else {
      // Sıradaki aktif eli bul
      this.currentPlayer = activeHand.playerId;
      const player = this.players.get(activeHand.playerId);
      if (player) {
        player.currentHandIndex = activeHand.handIndex;
        console.log(`➡️ Next active player: ${activeHand.playerId}, hand: ${activeHand.handIndex}`);
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
        // Akıllı karar verme mantığı
        const shouldHit = this.shouldDealerHit();
        
        if (shouldHit) {
          console.log(`🎩 Dealer decides to hit (score: ${this.dealer.score})...`);
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
          console.log('🎩 Dealer decides to stand. Final score:', this.dealer.score, 'Hand:', this.dealer.hand);
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

  // Akıllı dealer karar verme fonksiyonu
  shouldDealerHit() {
    const dealerScore = this.dealer.score;
    
    // 1. Temel kural: 17'den küçükse çek (geleneksel kural)
    if (dealerScore < 17) {
      console.log(`🎩 Rule 1: Dealer score ${dealerScore} < 17, must hit`);
      return true;
    }
    
    // 2. Oyuncuların durumunu analiz et
    const playerAnalysis = this.analyzePlayers();
    console.log('🎩 Player analysis:', playerAnalysis);
    
    // 3. YENİ KURAL: Eğer en az bir oyuncu bustlamamışsa, dealer onu yenmeye çalışmalı
    if (playerAnalysis.activePlayers > 0 && dealerScore >= 17) {
      // Dealer'ın skoru aktif oyuncuların en yükseğinden düşükse, çekmeli
      if (dealerScore < playerAnalysis.highestPlayerScore) {
        console.log(`🎩 Rule 2: Dealer score ${dealerScore} < highest player score ${playerAnalysis.highestPlayerScore}, must hit to try to beat them`);
        return true;
      } else {
        console.log(`🎩 Rule 2: Dealer score ${dealerScore} >= highest player score ${playerAnalysis.highestPlayerScore}, can stand`);
        return false;
      }
    }
    
    // 4. Kural 2: Eğer dealer oyuncuların hepsinin skorundan fazlaysa, risk alma
    if (playerAnalysis.allPlayersHaveLowerScore && dealerScore >= 17) {
      console.log(`🎩 Rule 3: Dealer score ${dealerScore} > all players, standing to avoid bust risk`);
      return false;
    }
    
    // 5. Oyuncuların yüksek skorları varsa dikkatli ol
    if (playerAnalysis.highestPlayerScore >= 18 && dealerScore >= 17 && dealerScore <= 19) {
      console.log(`🎩 Rule 4: High player scores detected (${playerAnalysis.highestPlayerScore}), being cautious`);
      return false;
    }
    
    // 6. Geleneksel kural: 17-21 arası dur
    if (dealerScore >= 17 && dealerScore <= 21) {
      console.log(`🎩 Rule 5: Traditional rule - dealer stands with ${dealerScore}`);
      return false;
    }
    
    // 7. Bust riski varsa dur
    if (dealerScore > 21) {
      console.log(`🎩 Rule 6: Dealer would bust, standing`);
      return false;
    }
    
    // 8. Diğer durumlarda çek (çok düşük skor)
    console.log(`🎩 Rule 7: Default - dealer hits with score ${dealerScore}`);
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
      if (player.hasSplit) {
        // Split yapılmış oyuncu - her eli ayrı değerlendir
        player.hands.forEach(hand => {
          if (hand.status !== 'busted') {
            activePlayers++;
            totalPlayers++;
            if (hand.score > highestPlayerScore) {
              highestPlayerScore = hand.score;
            }
            if (hand.score >= this.dealer.score) {
              allPlayersHaveLowerScore = false;
            }
          } else {
            bustedPlayers++;
            totalPlayers++;
          }
        });
      } else {
        // Normal oyuncu
        const hand = player.hands[0];
        totalPlayers++;
        if (hand.status === 'busted') {
          bustedPlayers++;
        } else {
          activePlayers++;
          if (hand.score > highestPlayerScore) {
            highestPlayerScore = hand.score;
          }
          if (hand.score >= this.dealer.score) {
            allPlayersHaveLowerScore = false;
          }
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
      ties: [],
      scoreboard: [] // Add scoreboard data
    };

    // Track dealer wins for scoreboard
    let dealerWins = 0;

    for (const [playerId, player] of this.players) {
      // Her el için ayrı ayrı sonuç hesapla
      let playerWon = false;
      let playerLost = false;
      let playerTied = false;
      let totalWinnings = 0;
      let totalBetAmount = 0; // O turda yatırılan toplam bahis
      
      // Toplam bahis miktarını hesapla (tüm eller + insurance)
      for (const hand of player.hands) {
        totalBetAmount += hand.bet;
      }
      if (player.hasInsurance) {
        totalBetAmount += player.insuranceBet;
      }
      
      // Insurance kontrolü ve ödemesi
      if (player.hasInsurance) {
        if (this.dealer.isBlackjack) {
          // Insurance kazandı - 2:1 ödeme (bahis + 2x kazanç)
          const insuranceWin = player.insuranceBet + (player.insuranceBet * 2); // Total: 3x bahis
          totalWinnings += insuranceWin;
          console.log(`🛡️ ${player.name} insurance won: ${insuranceWin} (bet: ${player.insuranceBet}, payout: 2:1)`);
        } else {
          // Insurance kaybetti - bahis kaybedilir
          console.log(`🛡️ ${player.name} insurance lost: ${player.insuranceBet}`);
        }
      }
      
      for (let handIndex = 0; handIndex < player.hands.length; handIndex++) {
        const hand = player.hands[handIndex];
        
        console.log(`🎯 Evaluating ${player.name} hand ${handIndex}: score=${hand.score}, status=${hand.status}, isBlackjack=${hand.isBlackjack}, bet=${hand.bet}`);
        
        // Player hand busted - dealer'dan bağımsız olarak kaybeder
        if (hand.status === 'busted') {
          console.log(`💥 Hand ${handIndex}: Player busted - dealer wins (player loses regardless of dealer)`);
          playerLost = true;
          dealerWins++; // Dealer wins when player busts
        }
        // Player hand has blackjack
        else if (hand.isBlackjack) {
          if (this.dealer.isBlackjack) {
            // Both have blackjack - push (tie) - bahis geri verilir
            console.log(`🤝 Hand ${handIndex}: Both have blackjack - push`);
            totalWinnings += hand.bet; // Bahis geri verilir
            playerTied = true;
          } else {
            // Player blackjack wins - 3:2 payout
            console.log(`🎉 Hand ${handIndex}: Player blackjack wins`);
            const blackjackPayout = hand.bet + Math.floor(hand.bet * 1.5); // Bahis + 1.5x kazanç
            totalWinnings += blackjackPayout;
            playerWon = true;
          }
        }
        // Dealer has blackjack (player doesn't)
        else if (this.dealer.isBlackjack) {
          console.log(`😞 Hand ${handIndex}: Dealer blackjack - player loses`);
          playerLost = true;
          dealerWins++; // Dealer wins with blackjack
        }
        // Dealer busted (player didn't)
        else if (this.dealer.score > 21) {
          console.log(`🎉 Hand ${handIndex}: Dealer busted - player wins`);
          totalWinnings += hand.bet * 2; // Bahis + 1:1 kazanç
          playerWon = true;
        }
        // Compare scores (neither busted, neither has blackjack)
        else if (hand.score > this.dealer.score) {
          console.log(`🎉 Hand ${handIndex}: Player higher score (${hand.score} vs ${this.dealer.score}) - player wins`);
          totalWinnings += hand.bet * 2; // Bahis + 1:1 kazanç
          playerWon = true;
        } else if (hand.score < this.dealer.score) {
          console.log(`😞 Hand ${handIndex}: Dealer higher score (${this.dealer.score} vs ${hand.score}) - dealer wins`);
          playerLost = true;
          dealerWins++; // Dealer wins with higher score
        } else {
          console.log(`🤝 Hand ${handIndex}: Same score (${hand.score}) - push`);
          totalWinnings += hand.bet; // Bahis geri verilir
          playerTied = true;
        }
        
        // Player hand has blackjack
        if (hand.isBlackjack && hand.status !== 'busted') {
          if (this.dealer.isBlackjack) {
            // Both have blackjack - push (tie) - bahis geri verilir
            console.log(`🤝 Hand ${handIndex}: Both have blackjack - push`);
            totalWinnings += hand.bet; // Bahis geri verilir
            playerTied = true;
          } else {
            // Player blackjack wins - 3:2 payout
            console.log(`🎉 Hand ${handIndex}: Player blackjack wins`);
            const blackjackPayout = hand.bet + Math.floor(hand.bet * 1.5); // Bahis + 1.5x kazanç
            totalWinnings += blackjackPayout;
            playerWon = true;
          }
        }
        // Dealer has blackjack (player doesn't)
        else if (this.dealer.isBlackjack && hand.status !== 'busted') {
          console.log(`😞 Hand ${handIndex}: Dealer blackjack - player loses`);
          playerLost = true;
          dealerWins++; // Dealer wins with blackjack
        }
        // Dealer busted (player didn't)
        else if (this.dealer.score > 21 && hand.status !== 'busted') {
          console.log(`🎉 Hand ${handIndex}: Dealer busted - player wins`);
          totalWinnings += hand.bet * 2; // Bahis + 1:1 kazanç
          playerWon = true;
        }
        // Compare scores (neither busted, neither has blackjack)
        else if (hand.status !== 'busted' && hand.score > this.dealer.score) {
          console.log(`🎉 Hand ${handIndex}: Player higher score (${hand.score} vs ${this.dealer.score}) - player wins`);
          totalWinnings += hand.bet * 2; // Bahis + 1:1 kazanç
          playerWon = true;
        } else if (hand.status !== 'busted' && hand.score < this.dealer.score) {
          console.log(`😞 Hand ${handIndex}: Dealer higher score (${this.dealer.score} vs ${hand.score}) - dealer wins`);
          playerLost = true;
          dealerWins++; // Dealer wins with higher score
        } else if (hand.status !== 'busted') {
          console.log(`🤝 Hand ${handIndex}: Same score (${hand.score}) - push`);
          totalWinnings += hand.bet; // Bahis geri verilir
          playerTied = true;
        }
      }
      
      // Apply winnings to player
      player.winnings += totalWinnings;
      
      // O turda net kazanç/kayıp hesapla
      const roundNetGain = totalWinnings - totalBetAmount;
      
      console.log(`💰 ${player.name} total bet: ${totalBetAmount}, total winnings: ${totalWinnings}, round net: ${roundNetGain}`);
      
      // Determine overall result for this player (prioritize wins over losses over ties)
      if (playerWon && !playerLost) {
        // Pure win case
        const hasBlackjack = player.hands.some(hand => hand.isBlackjack && hand.status !== 'busted');
        results.winners.push({
          id: playerId,
          name: player.name,
          reason: hasBlackjack ? 'blackjack' : (this.dealer.score > 21 ? 'dealer_busted' : 'higher_score'),
          roundBet: totalBetAmount,
          roundWinnings: totalWinnings,
          roundNet: roundNetGain
        });
        console.log(`🎉 Overall result for ${player.name}: WIN`);
      } else if (playerLost && !playerWon) {
        // Pure loss case
        const allBusted = player.hands.every(hand => hand.status === 'busted');
        results.losers.push({
          id: playerId,
          name: player.name,
          reason: allBusted ? 'busted' : (this.dealer.isBlackjack ? 'dealer_blackjack' : 'lower_score'),
          roundBet: totalBetAmount,
          roundWinnings: totalWinnings,
          roundNet: roundNetGain
        });
        console.log(`😞 Overall result for ${player.name}: LOSS`);
      } else if (playerTied && !playerWon && !playerLost) {
        // Pure tie case
        const hasBlackjackTie = player.hands.some(hand => hand.isBlackjack) && this.dealer.isBlackjack;
        results.ties.push({
          id: playerId,
          name: player.name,
          reason: hasBlackjackTie ? 'blackjack_push' : 'tie',
          roundBet: totalBetAmount,
          roundWinnings: totalWinnings,
          roundNet: roundNetGain
        });
        console.log(`🤝 Overall result for ${player.name}: TIE`);
      } else {
        // Mixed results - classify as tie since it's complex
        results.ties.push({
          id: playerId,
          name: player.name,
          reason: 'mixed_results',
          roundBet: totalBetAmount,
          roundWinnings: totalWinnings,
          roundNet: roundNetGain
        });
        console.log(`🤝 Overall result for ${player.name}: MIXED (classified as tie)`);
      }
    }

    // Add dealer to scoreboard if they won
    if (dealerWins > 0) {
      results.scoreboard.push({
        id: 'dealer',
        name: '🏠 Krupiyer',
        winnings: dealerWins,
        isDealer: true
      });
    }

    // Add players to scoreboard
    for (const [playerId, player] of this.players) {
      if (player.winnings > 0) {
        results.scoreboard.push({
          id: playerId,
          name: player.name,
          winnings: player.winnings,
          isDealer: false
        });
      }
    }

    // Sort scoreboard by winnings (highest first)
    results.scoreboard.sort((a, b) => b.winnings - a.winnings);

    this.results = results;
  }

  getDealerVisibleScore() {
    if (this.dealer.hand.length === 0) return 0;
    if (this.dealer.hand.length === 1) return this.calculateScore([this.dealer.hand[0]]).score;
    if (this.dealer.hiddenCard) return this.calculateScore([this.dealer.hand[0]]).score;
    return this.dealer.score;
  }

  getGameState() {
    // Compatibility layer - convert hands back to old format for frontend
    const compatiblePlayers = Array.from(this.players.values()).map(player => {
      const currentHand = player.hands[player.currentHandIndex] || player.hands[0];
      return {
        id: player.id,
        name: player.name,
        hand: currentHand.cards,
        score: currentHand.score,
        bet: currentHand.bet,
        status: currentHand.status,
        isBlackjack: currentHand.isBlackjack,
        hasDoubledDown: currentHand.hasDoubledDown,
        winnings: player.winnings,
        // Split specific data
        hands: player.hands,
        currentHandIndex: player.currentHandIndex,
        hasSplit: player.hasSplit,
        // Insurance specific data
        hasInsurance: player.hasInsurance,
        insuranceBet: player.insuranceBet
      };
    });

    return {
      roomId: this.roomId,
      players: compatiblePlayers,
      dealer: {
        ...this.dealer,
        visibleScore: this.getDealerVisibleScore(),
        canOfferInsurance: this.canOfferInsurance()
      },
      gameState: this.gameState,
      currentPlayer: this.currentPlayer,
      results: this.results || null,
      deckCount: this.deck.length // Kalan kart sayısı
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

    socket.on('double-down', (roomId) => {
      console.log(`🎰 Double down event received from ${socket.id} in room ${roomId}`);
      const game = gameRooms.get(roomId);
      if (game && game.currentPlayer === socket.id) {
        const success = game.doubleDown(socket.id);
        if (success) {
          console.log(`✅ Double down processed for player ${socket.id}`);
          io.to(roomId).emit('game-update', game.getGameState());
          console.log(`📤 Double down processed in room ${roomId}, new current player: ${game.currentPlayer}`);
        } else {
          console.log(`❌ Double down failed - conditions not met for player ${socket.id}`);
        }
      } else {
        console.log(`❌ Double down failed - currentPlayer: ${game?.currentPlayer}, socketId: ${socket.id}`);
      }
    });

    socket.on('insurance', (data) => {
      const { roomId, amount } = data;
      console.log(`🛡️ Insurance event received from ${socket.id} in room ${roomId} with amount ${amount}`);
      const game = gameRooms.get(roomId);
      if (game && game.canOfferInsurance()) {
        const success = game.insurance(socket.id, amount);
        if (success) {
          console.log(`✅ Insurance processed for player ${socket.id}`);
          io.to(roomId).emit('game-update', game.getGameState());
          console.log(`📤 Insurance processed in room ${roomId}`);
        } else {
          console.log(`❌ Insurance failed - conditions not met for player ${socket.id}`);
        }
      } else {
        console.log(`❌ Insurance failed - game not found or insurance not available`);
      }
    });

    socket.on('split', (roomId) => {
      console.log(`🃏 Split event received from ${socket.id} in room ${roomId}`);
      const game = gameRooms.get(roomId);
      if (game && game.currentPlayer === socket.id) {
        const success = game.split(socket.id);
        if (success) {
          console.log(`✅ Split processed for player ${socket.id}`);
          io.to(roomId).emit('game-update', game.getGameState());
          console.log(`📤 Split processed in room ${roomId}, player now has multiple hands`);
        } else {
          console.log(`❌ Split failed - conditions not met for player ${socket.id}`);
        }
      } else {
        console.log(`❌ Split failed - currentPlayer: ${game?.currentPlayer}, socketId: ${socket.id}`);
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
      const oldGame = gameRooms.get(roomId);
      if (oldGame) {
        // Eski oyun nesnesindeki oyuncuların winnings değerlerini kaydet
        const playerWinnings = new Map();
        for (const [playerId, player] of oldGame.players) {
          playerWinnings.set(playerId, {
            name: player.name,
            winnings: player.winnings || 0
          });
        }

        // Yeni oyun oluştur
        const newGame = new BlackjackGame(roomId, io);
        gameRooms.set(roomId, newGame);

        // Eski oyuncuları yeni oyuna ekle ve winnings değerlerini geri yükle
        for (const [playerId, playerData] of playerWinnings) {
          newGame.addPlayer(playerId, playerData.name);
          const newPlayer = newGame.players.get(playerId);
          if (newPlayer) {
            newPlayer.winnings = playerData.winnings;
          }
        }

        // Clear betting decisions for new game
        newGame.playerBets = new Map();

        console.log(`✅ Room ${roomId} reset successfully with preserved winnings`);
        io.to(roomId).emit('game-update', newGame.getGameState());
        
        // Notify clients to clear their betting state
        io.to(roomId).emit('betting-cleared');
      } else {
        console.log(`❌ Room ${roomId} not found for reset`);
      }
    });

    // Chat message event
    socket.on('chat-message', (data) => {
      const { roomId, message, playerName } = data;
      console.log(`💬 Chat message from ${playerName} in room ${roomId}: ${message}`);
      
      // Send message to all players in the room
      io.to(roomId).emit('chat-message', {
        id: socket.id,
        name: playerName,
        message: message,
        timestamp: Date.now()
      });
    });

    // Betting decision events
    socket.on('bet-decision', (data) => {
      const { roomId, bet } = data;
      console.log(`💰 Bet decision from ${socket.id} in room ${roomId}:`, bet);
      
      const game = gameRooms.get(roomId);
      if (game) {
        // Store betting decision in the game
        if (!game.playerBets) {
          game.playerBets = new Map();
        }
        
        game.playerBets.set(socket.id, { 
          decision: bet.hasBet ? 'bet' : 'no-bet', 
          amount: bet.amount,
          hasDecided: bet.hasDecided,
          hasBet: bet.hasBet,
          playerName: bet.playerName
        });
        
        // Broadcast the betting decision to all players in the room
        io.to(roomId).emit('bet-decision-update', {
          bet: {
            playerId: socket.id,
            decision: bet.hasBet ? 'bet' : 'no-bet',
            amount: bet.amount,
            hasDecided: bet.hasDecided,
            hasBet: bet.hasBet,
            playerName: bet.playerName
          }
        });
        
        console.log(`📤 Bet decision broadcasted to room ${roomId}`);
      }
    });

    socket.on('get-betting-status', (data) => {
      const { roomId } = data;
      const game = gameRooms.get(roomId);
      if (game && game.playerBets) {
        // Send current betting status to the requesting player
        const playerBets = {};
        game.playerBets.forEach((betInfo, playerId) => {
          playerBets[playerId] = {
            amount: betInfo.amount || 0,
            hasBet: betInfo.hasBet || false,
            hasDecided: betInfo.hasDecided || false
          };
        });
        
        socket.emit('betting-status-update', { playerBets });
        console.log(`📤 Betting status sent to ${socket.id} in room ${roomId}`);
      }
    });
  });

  httpServer.listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
