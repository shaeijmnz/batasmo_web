-- 20260422_double_booking_trigger_patch.sql
-- Tightens the enforce_no_double_booking trigger so it blocks any
-- insert while the client already has an in-flight appointment,
-- regardless of the exact status label (pending / confirmed /
-- rescheduled / started / in_progress / active / etc.).
--
-- Requires the previous migration:
--   20260422_app_config_double_booking_toggle.sql
--
-- Run in the Supabase SQL Editor (service_role).

BEGIN;

CREATE OR REPLACE FUNCTION public.enforce_no_double_booking()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_enabled boolean;
  v_active_count integer;
BEGIN
  SELECT COALESCE(
          (SELECT (value)::text::boolean
             FROM public.app_config
            WHERE key = 'prevent_double_booking'),
          true
        )
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
     AND LOWER(COALESCE(status::text, '')) NOT IN (
           'completed', 'cancelled', 'canceled',
           'rejected', 'declined', 'failed',
           'expired', 'no_show', 'noshow'
         )
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
