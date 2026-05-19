-- 20260422_app_config_double_booking_toggle.sql
-- Generic app-level settings table with an admin-controlled toggle
-- that decides whether clients are allowed to double-book
-- consultations. Default ON (enforce prevention).
--
-- Run this in the Supabase SQL Editor (service_role).

BEGIN;

-- ============================================================================
-- Step 1: app_config key/value table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.app_config (
  key         text PRIMARY KEY,
  value       jsonb NOT NULL DEFAULT 'null'::jsonb,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Seed the prevent_double_booking flag (ON by default for safety)
INSERT INTO public.app_config (key, value)
VALUES ('prevent_double_booking', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Auto-bump updated_at + stamp updated_by on any write
CREATE OR REPLACE FUNCTION public.app_config_touch() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  IF auth.uid() IS NOT NULL THEN
    NEW.updated_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS app_config_touch_trigger ON public.app_config;
CREATE TRIGGER app_config_touch_trigger
BEFORE INSERT OR UPDATE ON public.app_config
FOR EACH ROW EXECUTE FUNCTION public.app_config_touch();

-- ============================================================================
-- Step 2: Row Level Security
-- ============================================================================
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- Anyone logged in can READ config (clients need to see the flag)
DROP POLICY IF EXISTS "app_config_read_authenticated" ON public.app_config;
CREATE POLICY "app_config_read_authenticated"
  ON public.app_config
  FOR SELECT
  TO authenticated
  USING (true);

-- Only Admin profiles can INSERT/UPDATE/DELETE
DROP POLICY IF EXISTS "app_config_write_admin_only" ON public.app_config;
CREATE POLICY "app_config_write_admin_only"
  ON public.app_config
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'Admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'Admin'
    )
  );

-- ============================================================================
-- Step 3: Helper RPCs so clients can read/admins can write without
--          worrying about RLS edge cases.
-- ============================================================================

-- Read helper: anyone signed in can fetch a config value.
CREATE OR REPLACE FUNCTION public.get_app_config(p_key text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT value FROM public.app_config WHERE key = p_key LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_app_config(text) TO authenticated, anon;

-- Write helper: only admins can upsert.
CREATE OR REPLACE FUNCTION public.set_app_config(p_key text, p_value jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin boolean;
  new_value jsonb;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'Admin'
  ) INTO is_admin;

  IF NOT is_admin THEN
    RAISE EXCEPTION 'Only administrators can update app configuration.';
  END IF;

  INSERT INTO public.app_config (key, value, updated_by, updated_at)
  VALUES (p_key, p_value, auth.uid(), now())
  ON CONFLICT (key)
  DO UPDATE SET value = EXCLUDED.value,
                updated_by = auth.uid(),
                updated_at = now()
  RETURNING value INTO new_value;

  RETURN new_value;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_app_config(text, jsonb) TO authenticated;

-- ============================================================================
-- Step 4: (Optional) Block appointments at the DB level as a belt-and-
-- suspenders check so bypassing the client-side check still fails.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.enforce_no_double_booking()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_enabled boolean;
  v_active_count integer;
BEGIN
  SELECT COALESCE( (SELECT (value)::text::boolean
                    FROM public.app_config
                    WHERE key = 'prevent_double_booking'), true)
    INTO v_enabled;

  IF v_enabled IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  IF NEW.client_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*)
    INTO v_active_count
    FROM public.appointments
   WHERE client_id = NEW.client_id
     AND status IN ('pending', 'confirmed', 'rescheduled',
                    'started', 'in_progress', 'active')
     AND (TG_OP = 'INSERT' OR id <> NEW.id);

  IF v_active_count > 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'DOUBLE_BOOKING_BLOCKED: You already have an active appointment. Please finish or cancel it first.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_no_double_booking_trigger ON public.appointments;
CREATE TRIGGER enforce_no_double_booking_trigger
BEFORE INSERT ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.enforce_no_double_booking();

COMMIT;
