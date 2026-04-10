-- 20260408_booking_attorneys_visibility_and_slots.sql
-- Purpose:
-- 1) Verify which attorneys are visible/bookable data-wise.
-- 2) Optionally mark specific test attorneys as verified.
-- 3) Optionally add one future open availability slot per attorney if none exists.
--
-- Safe to run in Supabase SQL Editor.
-- The UPDATE/INSERT section is optional; run only if needed.

-- =====================================================
-- A) DIAGNOSTIC CHECK (read-only)
-- =====================================================
SELECT
  p.full_name,
  p.email,
  p.role,
  ap.is_verified,
  COUNT(s.id) FILTER (WHERE s.is_booked = false AND s.start_time > now()) AS open_future_slots
FROM public.profiles p
JOIN public.attorney_profiles ap
  ON ap.user_id = p.id
LEFT JOIN public.availability_slots s
  ON s.attorney_id = p.id
WHERE p.role = 'Attorney'
GROUP BY p.id, p.full_name, p.email, p.role, ap.is_verified
ORDER BY p.full_name;


-- =====================================================
-- B) OPTIONAL FIXES
-- Uncomment and run this block if attorneys are not verified
-- or have zero future open slots.
-- =====================================================
BEGIN;

-- 1) Ensure target attorneys are verified.
UPDATE public.attorney_profiles ap
SET
  is_verified = true,
  updated_at = now()
FROM public.profiles p
WHERE ap.user_id = p.id
  AND p.email IN (
    'parawanangelica25@gmail.com',
    'test.alston.anarna@batasmo.app',
    'test.allen.anarna@batasmo.app',
    'test.jeanne.castillo-anarna@batasmo.app'
  );

-- 2) Add one future slot only if the attorney currently has no future open slot.
INSERT INTO public.availability_slots (
  attorney_id,
  start_time,
  end_time,
  is_booked,
  created_at,
  updated_at
)
SELECT
  p.id,
  now() + interval '2 days',
  now() + interval '2 days 1 hour',
  false,
  now(),
  now()
FROM public.profiles p
WHERE p.email IN (
  'parawanangelica25@gmail.com',
  'test.alston.anarna@batasmo.app',
  'test.allen.anarna@batasmo.app',
  'test.jeanne.castillo-anarna@batasmo.app'
)
AND NOT EXISTS (
  SELECT 1
  FROM public.availability_slots s
  WHERE s.attorney_id = p.id
    AND s.is_booked = false
    AND s.start_time > now()
);

COMMIT;


-- =====================================================
-- C) POST-CHECK (read-only)
-- =====================================================
SELECT
  p.full_name,
  p.email,
  ap.is_verified,
  COUNT(s.id) FILTER (WHERE s.is_booked = false AND s.start_time > now()) AS open_future_slots
FROM public.profiles p
JOIN public.attorney_profiles ap
  ON ap.user_id = p.id
LEFT JOIN public.availability_slots s
  ON s.attorney_id = p.id
WHERE p.role = 'Attorney'
GROUP BY p.id, p.full_name, p.email, ap.is_verified
ORDER BY p.full_name;
