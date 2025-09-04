-- Blöf (Liar's Dice) Oyunu İçin Supabase Tabloları

-- Blöf oyun odaları
CREATE TABLE bluff_games (
  id TEXT PRIMARY KEY,
  game_type TEXT NOT NULL DEFAULT 'bluff',
  house_chips BIGINT NOT NULL DEFAULT 10000,
  status TEXT NOT NULL DEFAULT 'waiting', -- waiting, active, finished
  max_players INTEGER NOT NULL DEFAULT 6,
  current_round INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Blöf oyun oturumları (her oyun için)
CREATE TABLE bluff_game_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id TEXT NOT NULL REFERENCES bluff_games(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bet_amount BIGINT NOT NULL,
  chips_before BIGINT NOT NULL,
  chips_after BIGINT NOT NULL,
  result TEXT, -- win, loss, tie
  payout BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Oyuncu elleri (zarlar)
CREATE TABLE bluff_player_hands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id TEXT NOT NULL REFERENCES bluff_games(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  dice_values INTEGER[] NOT NULL, -- 5 zar için değerler (1-6)
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bahisler
CREATE TABLE bluff_bets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id TEXT NOT NULL REFERENCES bluff_games(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  bet_quantity INTEGER NOT NULL, -- kaç tane
  bet_value INTEGER NOT NULL, -- hangi değer (1-6)
  bet_type TEXT NOT NULL DEFAULT 'normal', -- normal, bluff
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Turlar
CREATE TABLE bluff_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id TEXT NOT NULL REFERENCES bluff_games(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  current_player_id UUID REFERENCES auth.users(id),
  round_status TEXT NOT NULL DEFAULT 'active', -- active, challenged, finished
  winner_id UUID REFERENCES auth.users(id),
  loser_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  finished_at TIMESTAMP WITH TIME ZONE
);

-- İtirazlar (challenges)
CREATE TABLE bluff_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id TEXT NOT NULL REFERENCES bluff_games(id) ON DELETE CASCADE,
  challenger_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenged_bet_id UUID NOT NULL REFERENCES bluff_bets(id) ON DELETE CASCADE,
  challenge_result TEXT NOT NULL, -- correct, incorrect
  actual_quantity INTEGER NOT NULL, -- gerçek miktar
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Oyuncu istatistikleri
CREATE TABLE bluff_player_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  games_played INTEGER NOT NULL DEFAULT 0,
  games_won INTEGER NOT NULL DEFAULT 0,
  total_bluffs INTEGER NOT NULL DEFAULT 0,
  successful_bluffs INTEGER NOT NULL DEFAULT 0,
  total_challenges INTEGER NOT NULL DEFAULT 0,
  successful_challenges INTEGER NOT NULL DEFAULT 0,
  total_chips_won BIGINT NOT NULL DEFAULT 0,
  total_chips_lost BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- İndeksler
CREATE INDEX idx_bluff_games_status ON bluff_games(status);
CREATE INDEX idx_bluff_game_sessions_game_id ON bluff_game_sessions(game_id);
CREATE INDEX idx_bluff_player_hands_game_round ON bluff_player_hands(game_id, round_number);
CREATE INDEX idx_bluff_bets_game_round ON bluff_bets(game_id, round_number);
CREATE INDEX idx_bluff_rounds_game ON bluff_rounds(game_id);
CREATE INDEX idx_bluff_challenges_game ON bluff_challenges(game_id);
CREATE INDEX idx_bluff_player_stats_user ON bluff_player_stats(user_id);

-- Row Level Security (RLS) Politikaları
ALTER TABLE bluff_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE bluff_game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bluff_player_hands ENABLE ROW LEVEL SECURITY;
ALTER TABLE bluff_bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE bluff_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE bluff_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE bluff_player_stats ENABLE ROW LEVEL SECURITY;

-- bluff_games için politikalar
CREATE POLICY "Anyone can view bluff games" ON bluff_games FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create bluff games" ON bluff_games FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Game creator can update bluff games" ON bluff_games FOR UPDATE USING (auth.uid() IN (SELECT user_id FROM bluff_game_sessions WHERE game_id = bluff_games.id));

-- bluff_game_sessions için politikalar
CREATE POLICY "Users can view their own sessions" ON bluff_game_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own sessions" ON bluff_game_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- bluff_player_hands için politikalar
CREATE POLICY "Players can view hands in their games" ON bluff_player_hands FOR SELECT USING (auth.uid() = user_id OR auth.uid() IN (SELECT user_id FROM bluff_player_hands WHERE game_id = bluff_player_hands.game_id));
CREATE POLICY "System can create player hands" ON bluff_player_hands FOR INSERT WITH CHECK (true);

-- bluff_bets için politikalar
CREATE POLICY "Players can view bets in their games" ON bluff_bets FOR SELECT USING (auth.uid() = user_id OR auth.uid() IN (SELECT user_id FROM bluff_bets WHERE game_id = bluff_bets.game_id));
CREATE POLICY "Players can create bets in their games" ON bluff_bets FOR INSERT WITH CHECK (auth.uid() = user_id);

-- bluff_rounds için politikalar
CREATE POLICY "Anyone can view rounds" ON bluff_rounds FOR SELECT USING (true);
CREATE POLICY "System can create and update rounds" ON bluff_rounds FOR ALL WITH CHECK (true);

-- bluff_challenges için politikalar
CREATE POLICY "Players can view challenges in their games" ON bluff_challenges FOR SELECT USING (auth.uid() = challenger_id OR auth.uid() IN (SELECT challenger_id FROM bluff_challenges WHERE game_id = bluff_challenges.game_id));
CREATE POLICY "Players can create challenges" ON bluff_challenges FOR INSERT WITH CHECK (auth.uid() = challenger_id);

-- bluff_player_stats için politikalar
CREATE POLICY "Users can view their own stats" ON bluff_player_stats FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own stats" ON bluff_player_stats FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "System can create player stats" ON bluff_player_stats FOR INSERT WITH CHECK (true);

-- Trigger fonksiyonları
CREATE OR REPLACE FUNCTION update_bluff_game_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_bluff_games_updated_at
  BEFORE UPDATE ON bluff_games
  FOR EACH ROW
  EXECUTE FUNCTION update_bluff_game_updated_at();

CREATE OR REPLACE FUNCTION update_bluff_player_stats_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_bluff_player_stats_updated_at
  BEFORE UPDATE ON bluff_player_stats
  FOR EACH ROW
  EXECUTE FUNCTION update_bluff_player_stats_updated_at();
