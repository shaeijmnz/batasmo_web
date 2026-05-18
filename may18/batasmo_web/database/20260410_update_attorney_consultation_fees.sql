-- 20260410_update_attorney_consultation_fees.sql
-- Updates all attorney consultation fees to 2,000 PHP
-- Run in Supabase SQL Editor with service-role privileges.

BEGIN;

-- Update all attorneys' consultation fees to 2,000 PHP
UPDATE public.attorney_profiles
SET 
  consultation_fee = 2000,
  updated_at = now()
WHERE consultation_fee = 0 OR consultation_fee IS NULL;

-- Log the update
SELECT 
  COUNT(*) as updated_count,
  SUM(CASE WHEN consultation_fee = 2000 THEN 1 ELSE 0 END) as verified_count
FROM public.attorney_profiles;

COMMIT;
