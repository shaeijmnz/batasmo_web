-- ============================================================================
-- BATASMO CONSULTATION BOOKING - SUPABASE BACKEND SETUP
-- Complete database configuration for consultation booking flow
-- Run this entire script in Supabase SQL Editor
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. CREATE APPOINTMENT STATUS TYPE
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointment_status') THEN
    CREATE TYPE appointment_status AS ENUM ('pending', 'confirmed', 'started', 'completed', 'cancelled', 'rescheduled');
  END IF;
END $$;

-- ============================================================================
-- 2. CREATE AVAILABILITY_SLOTS TABLE
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
-- 3. UPDATE APPOINTMENTS TABLE (if needed)
-- ============================================================================
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
-- 4. CREATE CONSULTATION_ROOMS TABLE
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
-- 5. CREATE MESSAGES TABLE (for consultation chat)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.consultation_rooms(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message text,
  message_type varchar DEFAULT 'text',
  file_bucket varchar,
  file_path varchar,
  file_name varchar,
  mime_type varchar,
  file_size_bytes bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_room_id 
  ON public.messages(room_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id 
  ON public.messages(sender_id);

-- ============================================================================
-- 6. CREATE RPC: BOOK_APPOINTMENT
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
SET search_path = public
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
-- 7. CREATE RPC: MARK_SLOT_BOOKED
-- ============================================================================
CREATE OR REPLACE FUNCTION public.mark_slot_booked(
  p_attorney_id uuid,
  p_date date,
  p_time varchar
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
-- 8. CREATE TRIGGER FUNCTION: AUTO-CREATE CONSULTATION ROOM
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_consultation_room()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create room for confirmed or rescheduled appointments
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
-- 9. ENABLE ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultation_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 10. CREATE RLS POLICIES FOR APPOINTMENTS
-- ============================================================================

-- Policy: Both participants can select appointments
DROP POLICY IF EXISTS "appointments_participant_select" ON public.appointments;
CREATE POLICY "appointments_participant_select"
ON public.appointments FOR SELECT
USING (auth.uid() = client_id OR auth.uid() = attorney_id);

-- Policy: Clients can insert their own appointments
DROP POLICY IF EXISTS "appointments_client_insert" ON public.appointments;
CREATE POLICY "appointments_client_insert"
ON public.appointments FOR INSERT
WITH CHECK (auth.uid() = client_id);

-- Policy: Both participants can update appointments
DROP POLICY IF EXISTS "appointments_participant_update" ON public.appointments;
CREATE POLICY "appointments_participant_update"
ON public.appointments FOR UPDATE
USING (auth.uid() = client_id OR auth.uid() = attorney_id)
WITH CHECK (auth.uid() = client_id OR auth.uid() = attorney_id);

-- ============================================================================
-- 11. CREATE RLS POLICIES FOR CONSULTATION_ROOMS
-- ============================================================================

-- Policy: Both participants can select consultation rooms
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

-- ============================================================================
-- 12. CREATE RLS POLICIES FOR AVAILABILITY_SLOTS
-- ============================================================================

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

-- ============================================================================
-- 13. CREATE RLS POLICIES FOR MESSAGES
-- ============================================================================

-- Policy: Both participants can select messages in their consultation room
DROP POLICY IF EXISTS "messages_participant_select" ON public.messages;
CREATE POLICY "messages_participant_select"
ON public.messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.consultation_rooms cr
    JOIN public.appointments a ON cr.appointment_id = a.id
    WHERE cr.id = messages.room_id
    AND (a.client_id = auth.uid() OR a.attorney_id = auth.uid())
  )
);

-- Policy: Authenticated users can insert messages in their consultation rooms
DROP POLICY IF EXISTS "messages_participant_insert" ON public.messages;
CREATE POLICY "messages_participant_insert"
ON public.messages FOR INSERT
WITH CHECK (
  auth.uid() = sender_id
  AND EXISTS (
    SELECT 1 FROM public.consultation_rooms cr
    JOIN public.appointments a ON cr.appointment_id = a.id
    WHERE cr.id = messages.room_id
    AND (a.client_id = auth.uid() OR a.attorney_id = auth.uid())
  )
);

-- ============================================================================
-- SUMMARY OF CHANGES
-- ============================================================================
-- ✅ appointment_status ENUM type
-- ✅ availability_slots table + indexes
-- ✅ appointments table + indexes (may already exist)
-- ✅ consultation_rooms table + index
-- ✅ messages table + indexes
-- ✅ book_appointment() RPC function
-- ✅ mark_slot_booked() RPC function
-- ✅ handle_new_consultation_room() trigger
-- ✅ RLS enabled on all tables
-- ✅ RLS policies for appointments, consultation_rooms, availability_slots, messages
-- ✅ All policies configured for secure data access

COMMIT;
