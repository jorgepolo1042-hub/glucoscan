-- ============================================================
-- GlucoScan — Migration 004: Auto-Export Settings & Cron
-- ============================================================

-- 0. Enable required extensions
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 1. Auto-Export Settings Table
-- ============================================================
CREATE TABLE IF NOT EXISTS auto_export_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly')) DEFAULT 'daily',
  export_time INTEGER NOT NULL DEFAULT 8 CHECK (export_time >= 0 AND export_time <= 23),
  email TEXT NOT NULL,
  last_sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_auto_export_enabled ON auto_export_settings(enabled, export_time);

ALTER TABLE auto_export_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own export settings" ON auto_export_settings;
CREATE POLICY "Users can view own export settings"
  ON auto_export_settings FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own export settings" ON auto_export_settings;
CREATE POLICY "Users can insert own export settings"
  ON auto_export_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own export settings" ON auto_export_settings;
CREATE POLICY "Users can update own export settings"
  ON auto_export_settings FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own export settings" ON auto_export_settings;
CREATE POLICY "Users can delete own export settings"
  ON auto_export_settings FOR DELETE
  USING (auth.uid() = user_id);

-- 2. Function to trigger auto-export via pg_net
-- ============================================================
-- This function is called by the cron job every hour.
-- It finds users whose auto-export is due and triggers the Edge Function.
CREATE OR REPLACE FUNCTION public.trigger_auto_exports()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  settings_record RECORD;
  project_url TEXT;
  service_key TEXT;
BEGIN
  -- Get secrets from vault
  project_url := 'https://' || current_setting('app.settings.project_ref', TRUE) || '.supabase.co';
  
  -- Fallback: try environment variable
  project_url := COALESCE(NULLIF(current_setting('app.settings.project_url', TRUE), ''), project_url);
  service_key := NULLIF(current_setting('app.settings.service_key', TRUE), '');

  IF service_key IS NULL THEN
    RAISE WARNING 'trigger_auto_exports: service_key not configured';
    RETURN;
  END IF;

  FOR settings_record IN
    SELECT * FROM auto_export_settings
    WHERE enabled = TRUE
      AND export_time = EXTRACT(HOUR FROM NOW() AT TIME ZONE 'UTC')
      AND (
        (frequency = 'daily' AND (last_sent_at IS NULL OR last_sent_at < CURRENT_DATE))
        OR
        (frequency = 'weekly' AND EXTRACT(DOW FROM NOW()) = 1 AND (last_sent_at IS NULL OR last_sent_at < date_trunc('week', NOW())))
      )
  LOOP
    PERFORM net.http_post(
      url := project_url || '/functions/v1/send-auto-export',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_key
      ),
      body := jsonb_build_object(
        'userId', settings_record.user_id,
        'email', settings_record.email,
        'frequency', settings_record.frequency
      )::text::jsonb
    );
  END LOOP;
END;
$$;

-- 3. Schedule the cron job (runs every hour)
-- ============================================================
-- The cron job calls trigger_auto_exports() which checks for due exports.
-- IMPORTANT: After applying this migration, you MUST also configure
-- the project settings:
--   SELECT vault.create_secret('<project-url>', 'project_url');
--   SELECT vault.create_secret('<service-role-key>', 'service_key');
-- Or set them via:
--   ALTER DATABASE postgres SET app.settings.project_url = '<url>';
--   ALTER DATABASE postgres SET app.settings.service_key = '<key>';

-- Schedule: run at minute 0 of every hour
SELECT cron.schedule(
  'auto-export-hourly',
  '0 * * * *',
  $$ SELECT public.trigger_auto_exports(); $$
);

-- Note: To remove the schedule later, run:
-- SELECT cron.unschedule('auto-export-hourly');
