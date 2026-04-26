-- 20260427_double_booking_allow_second_confirmed.sql
-- Aligns the database guard with the app flow:
--   prevent_double_booking = true  -> allow up to 2 active bookings, block the 3rd
--   prevent_double_booking = false -> allow unlimited bookings for testing
--
-- Run in the Supabase SQL Editor if the previous double-booking trigger
-- has already been applied to the project database.

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

  IF v_active_count >= 2 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'DOUBLE_BOOKING_BLOCKED: You already have two active appointments. Please finish or cancel one first.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_no_double_booking_trigger ON public.appointments;
CREATE TRIGGER enforce_no_double_booking_trigger
BEFORE INSERT ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.enforce_no_double_booking();

COMMIT;
