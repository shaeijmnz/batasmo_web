-- 20260527_client_availability_calendar_rpc.sql
-- Lets clients see per-day open vs booked slot counts (for booking calendar UI).
-- Run in Supabase SQL Editor.

CREATE OR REPLACE FUNCTION public.get_attorney_availability_by_day(
  p_attorney_id uuid,
  p_from_date date,
  p_to_date date
)
RETURNS TABLE (
  slot_date date,
  open_count bigint,
  booked_count bigint,
  total_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.date AS slot_date,
    COUNT(*) FILTER (WHERE NOT COALESCE(s.is_booked, false)) AS open_count,
    COUNT(*) FILTER (WHERE COALESCE(s.is_booked, false)) AS booked_count,
    COUNT(*)::bigint AS total_count
  FROM public.availability_slots s
  WHERE s.attorney_id = p_attorney_id
    AND s.date IS NOT NULL
    AND s.date >= p_from_date
    AND s.date <= p_to_date
  GROUP BY s.date
  ORDER BY s.date;
$$;

GRANT EXECUTE ON FUNCTION public.get_attorney_availability_by_day(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_attorney_availability_by_day(uuid, date, date) TO anon;
