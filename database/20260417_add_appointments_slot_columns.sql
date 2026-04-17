-- Optional: align older databases with SUPABASE_SETUP.sql / booking RPCs that reference slot_date + slot_time.
-- Run in Supabase SQL Editor if you want those columns (not required for chat — scheduled_at is enough).

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS slot_date date DEFAULT NULL;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS slot_time varchar DEFAULT NULL;
