-- ============================================================
-- GlucoScan — Initial Schema Migration
-- Run this in the Supabase SQL Editor to set up the database
-- ============================================================

-- 0. Extensions
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Profiles
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  daily_scan_count INTEGER DEFAULT 0,
  last_scan_date DATE,
  sugar_free_streak INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own profile" ON profiles;
CREATE POLICY "Users can create own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, user_id, display_name)
  VALUES (NEW.id, NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Food Scans
-- ============================================================
CREATE TABLE IF NOT EXISTS food_scans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  scan_type TEXT NOT NULL CHECK (scan_type IN ('barcode', 'photo', 'manual')),
  barcode TEXT,
  product_name TEXT,
  brand TEXT,
  calories INTEGER,
  sugar_grams REAL,
  carbs_grams REAL,
  protein_grams REAL,
  fat_grams REAL,
  fiber_grams REAL,
  image_url TEXT,
  ingredients TEXT,
  nutritional_score TEXT,
  ai_analysis JSONB,
  is_sugar_free BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_food_scans_user_date ON food_scans(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_food_scans_user_sugar_free ON food_scans(user_id, is_sugar_free);

ALTER TABLE food_scans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own scans" ON food_scans;
CREATE POLICY "Users can view own scans"
  ON food_scans FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own scans" ON food_scans;
CREATE POLICY "Users can insert own scans"
  ON food_scans FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own scans" ON food_scans;
CREATE POLICY "Users can delete own scans"
  ON food_scans FOR DELETE
  USING (auth.uid() = user_id);

-- Function to get daily scan count
CREATE OR REPLACE FUNCTION get_daily_scan_count(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  today_start TIMESTAMP WITH TIME ZONE := date_trunc('day', NOW());
  scan_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO scan_count
  FROM food_scans
  WHERE user_id = p_user_id
    AND created_at >= today_start;
  RETURN scan_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Streaks
-- ============================================================
CREATE TABLE IF NOT EXISTS streaks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  is_sugar_free BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_streaks_user_date ON streaks(user_id, date DESC);

ALTER TABLE streaks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own streaks" ON streaks;
CREATE POLICY "Users can view own streaks"
  ON streaks FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own streaks" ON streaks;
CREATE POLICY "Users can insert own streaks"
  ON streaks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own streaks" ON streaks;
CREATE POLICY "Users can update own streaks"
  ON streaks FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own streaks" ON streaks;
CREATE POLICY "Users can delete own streaks"
  ON streaks FOR DELETE
  USING (auth.uid() = user_id);

-- 4. User Plans
-- ============================================================
CREATE TABLE IF NOT EXISTS user_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  plan_data JSONB DEFAULT '{}'::jsonb,
  ai_generated BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_plans_user ON user_plans(user_id, created_at DESC);

ALTER TABLE user_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own plans" ON user_plans;
CREATE POLICY "Users can view own plans"
  ON user_plans FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own plans" ON user_plans;
CREATE POLICY "Users can insert own plans"
  ON user_plans FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own plans" ON user_plans;
CREATE POLICY "Users can update own plans"
  ON user_plans FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own plans" ON user_plans;
CREATE POLICY "Users can delete own plans"
  ON user_plans FOR DELETE
  USING (auth.uid() = user_id);

-- 5. Plan Recipes
-- ============================================================
CREATE TABLE IF NOT EXISTS plan_recipes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID REFERENCES user_plans(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  ingredients JSONB DEFAULT '[]'::jsonb,
  instructions JSONB,
  calories INTEGER,
  sugar_grams REAL,
  protein_grams REAL,
  carbs_grams REAL,
  fat_grams REAL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plan_recipes_plan ON plan_recipes(plan_id);

ALTER TABLE plan_recipes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own plan recipes" ON plan_recipes;
CREATE POLICY "Users can view own plan recipes"
  ON plan_recipes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_plans
      WHERE user_plans.id = plan_recipes.plan_id
        AND user_plans.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert plan recipes" ON plan_recipes;
CREATE POLICY "Users can insert plan recipes"
  ON plan_recipes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_plans
      WHERE user_plans.id = plan_recipes.plan_id
        AND user_plans.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete own plan recipes" ON plan_recipes;
CREATE POLICY "Users can delete own plan recipes"
  ON plan_recipes FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_plans
      WHERE user_plans.id = plan_recipes.plan_id
        AND user_plans.user_id = auth.uid()
    )
  );

-- 6. AI Conversations (for RAG module)
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_session ON ai_conversations(user_id, session_id, created_at);

ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own conversations" ON ai_conversations;
CREATE POLICY "Users can view own conversations"
  ON ai_conversations FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own conversations" ON ai_conversations;
CREATE POLICY "Users can insert own conversations"
  ON ai_conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- Seed: default anonymous user placeholder
-- ============================================================
-- (No seed data needed — everything is user-created)
