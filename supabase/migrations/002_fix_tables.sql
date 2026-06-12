-- ============================================================
-- GlucoScan — Migration 002: Fix missing columns & add tables
-- ============================================================

-- Add user_id column to profiles if missing (Supabase sometimes creates profiles without it)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    UPDATE profiles SET user_id = id WHERE user_id IS NULL;
    ALTER TABLE profiles ALTER COLUMN user_id SET NOT NULL;
  END IF;
END $$;

-- Add columns that might be missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'display_name') THEN
    ALTER TABLE profiles ADD COLUMN display_name TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'daily_scan_count') THEN
    ALTER TABLE profiles ADD COLUMN daily_scan_count INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'sugar_free_streak') THEN
    ALTER TABLE profiles ADD COLUMN sugar_free_streak INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'updated_at') THEN
    ALTER TABLE profiles ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;
END $$;

-- Create tables that don't exist yet
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

CREATE TABLE IF NOT EXISTS streaks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  is_sugar_free BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, date)
);

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

CREATE TABLE IF NOT EXISTS ai_conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes (IF NOT EXISTS check)
CREATE INDEX IF NOT EXISTS idx_food_scans_user_date ON food_scans(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_food_scans_user_sugar_free ON food_scans(user_id, is_sugar_free);
CREATE INDEX IF NOT EXISTS idx_streaks_user_date ON streaks(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_user_plans_user ON user_plans(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_plan_recipes_plan ON plan_recipes(plan_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_session ON ai_conversations(user_id, session_id, created_at);
