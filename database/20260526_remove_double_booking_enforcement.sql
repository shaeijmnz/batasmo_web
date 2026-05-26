-- 20260526_remove_double_booking_enforcement.sql
-- Panel allows clients to book multiple active consultations.
-- Run in the Supabase SQL Editor.

DROP TRIGGER IF EXISTS enforce_no_double_booking_trigger ON public.appointments;
DROP FUNCTION IF EXISTS public.enforce_no_double_booking();
