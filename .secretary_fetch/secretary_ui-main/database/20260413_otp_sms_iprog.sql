-- OTP delivery preference + optional SMS-only phone (does not replace existing phone column usage)
-- Rate-limit helpers for Edge Functions (service_role only)
-- Run in Supabase SQL Editor after review.

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS otp_sms_number text,
  ADD COLUMN IF NOT EXISTS preferred_otp_channel text;

COMMENT ON COLUMN public.profiles.otp_sms_number IS 'Optional mobile number used only for SMS OTP delivery; leave null to use phone when available.';
COMMENT ON COLUMN public.profiles.preferred_otp_channel IS 'User preference: email | sms';

CREATE TABLE IF NOT EXISTS public.signup_sms_send_log (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_signup_sms_send_log_user_time
  ON public.signup_sms_send_log (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.signup_sms_verify_fail_log (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_signup_sms_verify_fail_user_time
  ON public.signup_sms_verify_fail_log (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.signup_sms_lookup_log (
  id bigserial PRIMARY KEY,
  email_norm text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_signup_sms_lookup_email_time
  ON public.signup_sms_lookup_log (email_norm, created_at DESC);

-- Resolve unconfirmed auth user by email (for SMS OTP send after login failure). Service role only.
CREATE OR REPLACE FUNCTION public.get_unconfirmed_user_id_by_email(p_email text)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
  SELECT u.id
  FROM auth.users u
  WHERE lower(trim(u.email)) = lower(trim(p_email))
    AND u.email_confirmed_at IS NULL
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_unconfirmed_user_id_by_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_unconfirmed_user_id_by_email(text) TO service_role;

COMMIT;
