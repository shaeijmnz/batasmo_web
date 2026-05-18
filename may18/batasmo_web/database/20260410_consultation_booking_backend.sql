-- 20260410_consultation_booking_backend.sql
-- Full backend setup for consultation booking flow (Step 1-7)
-- Run in Supabase SQL Editor with service-role privileges

BEGIN;

-- ============================================================================
-- Step 1: Ensure availability_slots table has correct structure
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.availability_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attorney_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date date NOT NULL,
  time varchar NOT NULL,
  is_booked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_availability_slots_attorney_date 
  ON public.availability_slots(attorney_id, date);
CREATE INDEX IF NOT EXISTS idx_availability_slots_booked 
  ON public.availability_slots(is_booked);

-- ============================================================================
-- Step 2: Ensure appointments table structure
-- ============================================================================
-- Ensure appointment_status type exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointment_status') THEN
    CREATE TYPE appointment_status AS ENUM ('pending', 'confirmed', 'started', 'completed', 'cancelled', 'rescheduled');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  attorney_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  slot_id uuid REFERENCES public.availability_slots(id) ON DELETE SET NULL,
  title text,
  notes text,
  scheduled_at timestamptz NOT NULL,
  duration_minutes int NOT NULL DEFAULT 60,
  status appointment_status NOT NULL DEFAULT 'pending',
  amount numeric(12,2) NOT NULL DEFAULT 0,
  meeting_link text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT appointment_duration_check CHECK (duration_minutes > 0)
);

CREATE INDEX IF NOT EXISTS idx_appointments_client_id 
  ON public.appointments(client_id);
CREATE INDEX IF NOT EXISTS idx_appointments_attorney_id 
  ON public.appointments(attorney_id);
CREATE INDEX IF NOT EXISTS idx_appointments_scheduled_at 
  ON public.appointments(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_appointments_status 
  ON public.appointments(status);

-- ============================================================================
-- Step 3: Ensure consultation_rooms table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.consultation_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL UNIQUE REFERENCES public.appointments(id) ON DELETE CASCADE,
  is_closed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_consultation_rooms_appointment_id 
  ON public.consultation_rooms(appointment_id);

-- ============================================================================
-- Step 4: RPC Function - book_appointment (MAIN BOOKING FUNCTION)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.book_appointment(
  client_uuid uuid,
  attorney_uuid uuid,
  scheduled_time timestamptz,
  title_text text,
  notes_text text DEFAULT NULL,
  slot_date date DEFAULT NULL,
  slot_time varchar DEFAULT NULL,
  amount_value numeric DEFAULT 0,
  duration_minutes_value int DEFAULT 60
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_appointment_id uuid;
BEGIN
  -- Validate inputs
  IF client_uuid IS NULL OR attorney_uuid IS NULL THEN
    RAISE EXCEPTION 'client_uuid and attorney_uuid are required';
  END IF;
  
  IF scheduled_time IS NULL THEN
    RAISE EXCEPTION 'scheduled_time is required';
  END IF;

  -- Validate scheduled_time is in the future
  IF scheduled_time <= now() THEN
    RAISE EXCEPTION 'scheduled_time must be in the future';
  END IF;

  -- Create the appointment
  INSERT INTO public.appointments (
    client_id,
    attorney_id,
    title,
    notes,
    scheduled_at,
    duration_minutes,
    amount,
    status,
    created_at,
    updated_at
  )
  VALUES (
    client_uuid,
    attorney_uuid,
    COALESCE(title_text, 'Consultation'),
    notes_text,
    scheduled_time,
    GREATEST(duration_minutes_value, 60),
    GREATEST(amount_value, 0),
    'pending',
    now(),
    now()
  )
  RETURNING id INTO v_appointment_id;

  RETURN v_appointment_id;
END;
$$;

-- ============================================================================
-- Step 5: RPC Function - mark_slot_booked
-- ============================================================================
CREATE OR REPLACE FUNCTION public.mark_slot_booked(
  p_attorney_id uuid,
  p_date date,
  p_time varchar
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.availability_slots
  SET 
    is_booked = true,
    updated_at = now()
  WHERE 
    attorney_id = p_attorney_id 
    AND date = p_date 
    AND time = p_time;
END;
$$;

-- ============================================================================
-- Step 6: Trigger Function - Auto-create consultation room on confirmation
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_consultation_room()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Create room for confirmed or rescheduled appointments
  -- (chat remains available after reschedule)
  IF (NEW.status IN ('confirmed', 'rescheduled')) THEN
    INSERT INTO public.consultation_rooms (appointment_id, created_at, updated_at)
    VALUES (NEW.id, now(), now())
    ON CONFLICT (appointment_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop and recreate trigger
DROP TRIGGER IF EXISTS trg_create_room_on_confirmation ON public.appointments;

CREATE TRIGGER trg_create_room_on_confirmation
AFTER UPDATE OR INSERT ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_consultation_room();

-- ============================================================================
-- Step 7: Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS on appointments
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Policy: Both participants can select appointments they're involved in
DROP POLICY IF EXISTS "appointments_participant_select" ON public.appointments;
CREATE POLICY "appointments_participant_select"
ON public.appointments FOR SELECT
USING (auth.uid() = client_id OR auth.uid() = attorney_id);

-- Policy: Clients can insert their own appointments
DROP POLICY IF EXISTS "appointments_client_insert" ON public.appointments;
CREATE POLICY "appointments_client_insert"
ON public.appointments FOR INSERT
WITH CHECK (auth.uid() = client_id);

-- Policy: Both participants can update appointments they're involved in
DROP POLICY IF EXISTS "appointments_participant_update" ON public.appointments;
CREATE POLICY "appointments_participant_update"
ON public.appointments FOR UPDATE
USING (auth.uid() = client_id OR auth.uid() = attorney_id)
WITH CHECK (auth.uid() = client_id OR auth.uid() = attorney_id);

-- Enable RLS on consultation_rooms
ALTER TABLE public.consultation_rooms ENABLE ROW LEVEL SECURITY;

-- Policy: Both participants in appointment can access consultation room
DROP POLICY IF EXISTS "consultation_rooms_participant_select" ON public.consultation_rooms;
CREATE POLICY "consultation_rooms_participant_select"
ON public.consultation_rooms FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.appointments
    WHERE appointments.id = consultation_rooms.appointment_id
    AND (appointments.client_id = auth.uid() OR appointments.attorney_id = auth.uid())
  )
);

-- Enable RLS on availability_slots
ALTER TABLE public.availability_slots ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view unbooked slots
DROP POLICY IF EXISTS "availability_slots_select_unbooked" ON public.availability_slots;
CREATE POLICY "availability_slots_select_unbooked"
ON public.availability_slots FOR SELECT
USING (is_booked = false);

-- Policy: Only attorneys can manage their own slots
DROP POLICY IF EXISTS "availability_slots_attorney_manage" ON public.availability_slots;
CREATE POLICY "availability_slots_attorney_manage"
ON public.availability_slots FOR UPDATE
USING (attorney_id = auth.uid());

COMMIT;
