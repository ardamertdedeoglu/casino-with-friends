-- Virtual Currency System Schema for Supabase

-- 1. User Profiles Table (kullanıcı profilleri ve chip bakiyeleri)
CREATE TABLE user_profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    chips BIGINT DEFAULT 1000, -- Başlangıç chipi 1000
    total_winnings BIGINT DEFAULT 0,
    total_losses BIGINT DEFAULT 0,
    games_played INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Game Rooms Table (oyun odaları ve kasa durumu)
CREATE TABLE game_rooms (
    id TEXT PRIMARY KEY,
    game_type TEXT NOT NULL, -- 'blackjack', 'poker', etc.
    house_chips BIGINT DEFAULT 10000, -- Kasa başlangıç chipi
    status TEXT DEFAULT 'active', -- 'active', 'finished'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Game Sessions Table (oyun oturumları)
CREATE TABLE game_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    room_id TEXT REFERENCES game_rooms(id),
    user_id UUID REFERENCES auth.users(id),
    bet_amount BIGINT NOT NULL,
    result TEXT, -- 'win', 'loss', 'draw', 'blackjack'
    payout BIGINT DEFAULT 0,
    chips_before BIGINT NOT NULL,
    chips_after BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Chip Transactions Table (chip işlemleri geçmişi)
CREATE TABLE chip_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    transaction_type TEXT NOT NULL, -- 'deposit', 'win', 'loss', 'bet'
    amount BIGINT NOT NULL,
    balance_before BIGINT NOT NULL,
    balance_after BIGINT NOT NULL,
    game_session_id UUID REFERENCES game_sessions(id) NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Row Level Security (RLS) Policies
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chip_transactions ENABLE ROW LEVEL SECURITY;

-- User Profiles Policies
CREATE POLICY "Users can view their own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON user_profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Game Rooms Policies  
CREATE POLICY "Anyone can view game rooms" ON game_rooms
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Anyone can create game rooms" ON game_rooms
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Anyone can update game rooms" ON game_rooms
    FOR UPDATE TO authenticated USING (true);

-- Game Sessions Policies
CREATE POLICY "Users can view their own sessions" ON game_sessions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own sessions" ON game_sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Chip Transactions Policies
CREATE POLICY "Users can view their own transactions" ON chip_transactions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own transactions" ON chip_transactions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Functions for automatic profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (id, username, chips)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
        1000
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile when user signs up
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update user profile timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_updated_at BEFORE UPDATE ON game_rooms
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
