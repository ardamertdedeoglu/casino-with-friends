// Test script for updated dealer AI logic
const { createServer } = require('http');
const { parse } = require('url');

// Mock BlackjackGame class for testing
class BlackjackGame {
  constructor() {
    this.players = new Map();
    this.dealer = { hand: [], score: 0, hiddenCard: true };
  }

  // Mock player addition
  addMockPlayer(id, name, score, status = 'playing') {
    this.players.set(id, {
      id,
      name,
      hands: [{ cards: [], score, status, isBlackjack: false, hasDoubledDown: false, bet: 100 }],
      currentHandIndex: 0,
      hasSplit: false,
      winnings: 0
    });
  }

  // Mock dealer score
  setDealerScore(score) {
    this.dealer.score = score;
  }

  // Test the analyzePlayers function
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

  // Test the updated shouldDealerHit function
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
}

// Test scenarios
console.log('🧪 Testing Updated Dealer AI Logic...\n');

// Test 1: Dealer 18, 2 active players - should hit to try to beat them
console.log('Test 1: Dealer (18) vs Players (16, 19, busted)');
const game1 = new BlackjackGame();
game1.setDealerScore(18);
game1.addMockPlayer('p1', 'Player1', 16);
game1.addMockPlayer('p2', 'Player2', 19);
game1.addMockPlayer('p3', 'Player3', 25, 'busted');
console.log('Should dealer hit?', game1.shouldDealerHit());
console.log();

// Test 2: Dealer 20, all players have lower scores - should stand
console.log('Test 2: Dealer (20) vs Players (15, 16, 17)');
const game2 = new BlackjackGame();
game2.setDealerScore(20);
game2.addMockPlayer('p1', 'Player1', 15);
game2.addMockPlayer('p2', 'Player2', 16);
game2.addMockPlayer('p3', 'Player3', 17);
console.log('Should dealer hit?', game2.shouldDealerHit());
console.log();

// Test 3: Dealer 15, must hit (traditional rule)
console.log('Test 3: Dealer (15) vs Players (18, 19, 20)');
const game3 = new BlackjackGame();
game3.setDealerScore(15);
game3.addMockPlayer('p1', 'Player1', 18);
game3.addMockPlayer('p2', 'Player2', 19);
game3.addMockPlayer('p3', 'Player3', 20);
console.log('Should dealer hit?', game3.shouldDealerHit());
console.log();

// Test 4: Dealer 18, all players busted - should stand (no active players)
console.log('Test 4: Dealer (18) vs Players (all busted)');
const game4 = new BlackjackGame();
game4.setDealerScore(18);
game4.addMockPlayer('p1', 'Player1', 25, 'busted');
game4.addMockPlayer('p2', 'Player2', 22, 'busted');
game4.addMockPlayer('p3', 'Player3', 23, 'busted');
console.log('Should dealer hit?', game4.shouldDealerHit());
console.log();

console.log('✅ Updated Dealer AI Logic Tests Completed!');
