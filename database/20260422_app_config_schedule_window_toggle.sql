-- 20260422_app_config_schedule_window_toggle.sql
-- Adds the "enforce_schedule_window" admin toggle.
-- When ON (default), clients/attorneys can only enter the consultation
-- chat room at or after the scheduled start time. When OFF, anyone who
-- has paid can enter the room anytime (bypass mode for the demo).
--
-- Requires the app_config table from the previous migration
-- (20260422_app_config_double_booking_toggle.sql).
--
-- Run this in the Supabase SQL Editor (service_role).

BEGIN;

-- Seed default: enforce_schedule_window = ON
INSERT INTO public.app_config (key, value)
VALUES ('enforce_schedule_window', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Make sure the app_config changes stream through Realtime so clients
-- can react to admin toggles without reloading.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'app_config'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.app_config';
  END IF;
EXCEPTION WHEN others THEN
  -- Publication may not exist on older projects; ignore.
  RAISE NOTICE 'Skipping realtime publication for app_config: %', SQLERRM;
END $$;

COMMIT;
