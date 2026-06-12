-- ============================================================
-- GlucoScan — Migration 003: Missing RLS Policies
-- Execute this in Supabase SQL Editor
-- ============================================================

-- 1. Profiles RLS policies
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

-- 2. Plan Recipes RLS policies (with subquery to user_plans)
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

-- 3. AI Conversations RLS policies
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own conversations" ON ai_conversations;
CREATE POLICY "Users can view own conversations"
  ON ai_conversations FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own conversations" ON ai_conversations;
CREATE POLICY "Users can insert own conversations"
  ON ai_conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 4. Streaks additional policies
DROP POLICY IF EXISTS "Users can update own streaks" ON streaks;
CREATE POLICY "Users can update own streaks"
  ON streaks FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own streaks" ON streaks;
CREATE POLICY "Users can delete own streaks"
  ON streaks FOR DELETE
  USING (auth.uid() = user_id);

-- 5. User Plans additional policies
DROP POLICY IF EXISTS "Users can update own plans" ON user_plans;
CREATE POLICY "Users can update own plans"
  ON user_plans FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own plans" ON user_plans;
CREATE POLICY "Users can delete own plans"
  ON user_plans FOR DELETE
  USING (auth.uid() = user_id);

-- 6. Food Scans additional policies
DROP POLICY IF EXISTS "Users can delete own scans" ON food_scans;
CREATE POLICY "Users can delete own scans"
  ON food_scans FOR DELETE
  USING (auth.uid() = user_id);
