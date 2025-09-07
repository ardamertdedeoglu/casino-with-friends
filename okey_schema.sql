-- 101 Okey Game Database Schema
-- Compatible with Supabase PostgreSQL

-- Okey Game Rooms Table
CREATE TABLE IF NOT EXISTS okey_rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  game_mode VARCHAR(20) NOT NULL CHECK (game_mode IN ('folding', 'nonfolding')),
  play_type VARCHAR(20) NOT NULL CHECK (play_type IN ('single', 'paired')),
  max_players INTEGER NOT NULL DEFAULT 4,
  current_players INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'playing', 'finished')),
  room_owner UUID,
  is_private BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Okey Game Sessions Table
CREATE TABLE IF NOT EXISTS okey_game_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES okey_rooms(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL DEFAULT 1,
  current_player UUID,
  game_phase VARCHAR(20) NOT NULL DEFAULT 'waiting' CHECK (game_phase IN ('waiting', 'dealing', 'playing', 'finished')),
  okey_tile JSONB, -- {color, number, isOkey, id}
  indicator_tile JSONB, -- {color, number, isOkey, id}
  discard_pile JSONB[], -- Array of tile objects
  remaining_tiles INTEGER NOT NULL DEFAULT 106,
  winner UUID,
  started_at TIMESTAMP WITH TIME ZONE,
  finished_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Okey Game Players Table
CREATE TABLE IF NOT EXISTS okey_game_players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES okey_game_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL, -- Links to auth.users or virtual_currency_users
  player_name VARCHAR(50) NOT NULL,
  position INTEGER NOT NULL,
  tiles JSONB[], -- Array of tile objects
  score INTEGER NOT NULL DEFAULT 0,
  round_score INTEGER NOT NULL DEFAULT 0,
  fold_multiplier INTEGER NOT NULL DEFAULT 1,
  has_opened BOOLEAN NOT NULL DEFAULT false,
  can_finish BOOLEAN NOT NULL DEFAULT false,
  opened_sets JSONB[], -- Array of tile arrays representing opened sets
  is_active BOOLEAN NOT NULL DEFAULT false,
  is_connected BOOLEAN NOT NULL DEFAULT true,
  partner_id UUID, -- For paired games
  chips_won INTEGER NOT NULL DEFAULT 0,
  chips_lost INTEGER NOT NULL DEFAULT 0,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  left_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(session_id, position)
);

-- Okey Game Moves Table (for game history and replay)
CREATE TABLE IF NOT EXISTS okey_game_moves (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES okey_game_sessions(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES okey_game_players(id) ON DELETE CASCADE,
  move_number INTEGER NOT NULL,
  move_type VARCHAR(20) NOT NULL CHECK (move_type IN ('draw', 'discard', 'open_set', 'add_to_set', 'finish')),
  move_data JSONB NOT NULL, -- Tile data, set data, etc.
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Okey Game Partnerships Table (for paired games)
CREATE TABLE IF NOT EXISTS okey_partnerships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES okey_game_sessions(id) ON DELETE CASCADE,
  player1_id UUID NOT NULL REFERENCES okey_game_players(id) ON DELETE CASCADE,
  player2_id UUID NOT NULL REFERENCES okey_game_players(id) ON DELETE CASCADE,
  team_score INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(session_id, player1_id, player2_id)
);

-- Okey Game Statistics Table
CREATE TABLE IF NOT EXISTS okey_game_statistics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL, -- Links to auth.users or virtual_currency_users
  total_games_played INTEGER NOT NULL DEFAULT 0,
  total_games_won INTEGER NOT NULL DEFAULT 0,
  total_rounds_played INTEGER NOT NULL DEFAULT 0,
  total_rounds_won INTEGER NOT NULL DEFAULT 0,
  total_chips_won INTEGER NOT NULL DEFAULT 0,
  total_chips_lost INTEGER NOT NULL DEFAULT 0,
  average_score DECIMAL(10, 2) NOT NULL DEFAULT 0,
  best_score INTEGER,
  worst_score INTEGER,
  fastest_win_time INTEGER, -- In seconds
  total_play_time INTEGER NOT NULL DEFAULT 0, -- In seconds
  folding_games_played INTEGER NOT NULL DEFAULT 0,
  nonfolding_games_played INTEGER NOT NULL DEFAULT 0,
  single_games_played INTEGER NOT NULL DEFAULT 0,
  paired_games_played INTEGER NOT NULL DEFAULT 0,
  sets_opened INTEGER NOT NULL DEFAULT 0,
  okey_tiles_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(user_id)
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_okey_rooms_status ON okey_rooms(status);
CREATE INDEX IF NOT EXISTS idx_okey_rooms_owner ON okey_rooms(room_owner);
CREATE INDEX IF NOT EXISTS idx_okey_sessions_room ON okey_game_sessions(room_id);
CREATE INDEX IF NOT EXISTS idx_okey_sessions_phase ON okey_game_sessions(game_phase);
CREATE INDEX IF NOT EXISTS idx_okey_players_session ON okey_game_players(session_id);
CREATE INDEX IF NOT EXISTS idx_okey_players_user ON okey_game_players(user_id);
CREATE INDEX IF NOT EXISTS idx_okey_moves_session ON okey_game_moves(session_id);
CREATE INDEX IF NOT EXISTS idx_okey_moves_player ON okey_game_moves(player_id);
CREATE INDEX IF NOT EXISTS idx_okey_statistics_user ON okey_game_statistics(user_id);

-- Triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_okey_rooms_updated_at BEFORE UPDATE ON okey_rooms FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_okey_sessions_updated_at BEFORE UPDATE ON okey_game_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_okey_statistics_updated_at BEFORE UPDATE ON okey_game_statistics FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) Policies for Supabase
ALTER TABLE okey_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE okey_game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE okey_game_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE okey_game_moves ENABLE ROW LEVEL SECURITY;
ALTER TABLE okey_partnerships ENABLE ROW LEVEL SECURITY;
ALTER TABLE okey_game_statistics ENABLE ROW LEVEL SECURITY;

-- Basic RLS Policies (adjust based on your auth setup)
-- Allow authenticated users to read all rooms
CREATE POLICY \"Users can view okey rooms\" ON okey_rooms FOR SELECT TO authenticated USING (true);

-- Allow users to create rooms
CREATE POLICY \"Users can create okey rooms\" ON okey_rooms FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- Allow room owners to update their rooms
CREATE POLICY \"Room owners can update okey rooms\" ON okey_rooms FOR UPDATE TO authenticated USING (auth.uid() = room_owner);

-- Allow authenticated users to view game sessions
CREATE POLICY \"Users can view okey sessions\" ON okey_game_sessions FOR SELECT TO authenticated USING (true);

-- Allow players to view their game data
CREATE POLICY \"Players can view their okey data\" ON okey_game_players FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Allow players to view their statistics
CREATE POLICY \"Users can view their okey statistics\" ON okey_game_statistics FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Allow users to update their own statistics
CREATE POLICY \"Users can update their okey statistics\" ON okey_game_statistics FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- Sample data for testing (optional)
-- INSERT INTO okey_rooms (name, game_mode, play_type, max_players, room_owner)
-- VALUES 
--   ('Hızlı Okey Masası', 'folding', 'single', 4, null),
--   ('Eşli Turnuva', 'nonfolding', 'paired', 4, null),
--   ('Katlamalı Özel Masa', 'folding', 'single', 4, null);

-- Comments explaining the schema
COMMENT ON TABLE okey_rooms IS '101 Okey game rooms where players can join';
COMMENT ON TABLE okey_game_sessions IS 'Individual game sessions with state and configuration';
COMMENT ON TABLE okey_game_players IS 'Players participating in a specific game session';
COMMENT ON TABLE okey_game_moves IS 'Log of all moves made during a game for history and replay';
COMMENT ON TABLE okey_partnerships IS 'Partnership information for paired games';
COMMENT ON TABLE okey_game_statistics IS 'Player statistics and achievements for 101 Okey';

COMMENT ON COLUMN okey_rooms.game_mode IS 'folding (katlamalı) or nonfolding (katlamasız)';
COMMENT ON COLUMN okey_rooms.play_type IS 'single (tekli) or paired (eşli)';
COMMENT ON COLUMN okey_game_sessions.okey_tile IS 'The okey tile for this game (JSON: {color, number, isOkey, id})';
COMMENT ON COLUMN okey_game_sessions.indicator_tile IS 'The indicator tile that determines the okey';
COMMENT ON COLUMN okey_game_players.tiles IS 'Array of tile objects in player hand';
COMMENT ON COLUMN okey_game_players.opened_sets IS 'Array of tile arrays representing sets/runs opened by player';
COMMENT ON COLUMN okey_game_players.fold_multiplier IS 'Multiplier for folding games (increases when player folds)';