-- Pending client signups: no auth.users row until OTP verified + account created.
-- Run in Supabase SQL Editor (service role / postgres).

CREATE TABLE IF NOT EXISTS public.pending_client_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_norm text NOT NULL,
  password_hash text NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL DEFAULT 'Client',
  sex text,
  phone text,
  age integer,
  address text,
  guardian_name text,
  guardian_contact text,
  preferred_otp_channel text NOT NULL DEFAULT 'email',
  otp_hash text,
  otp_expires_at timestamptz,
  otp_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS pending_client_signups_email_unique
  ON public.pending_client_signups (email_norm);

CREATE INDEX IF NOT EXISTS pending_client_signups_expires_idx
  ON public.pending_client_signups (otp_expires_at);

CREATE TABLE IF NOT EXISTS public.pending_client_signup_send_log (
  id bigserial PRIMARY KEY,
  pending_id uuid NOT NULL REFERENCES public.pending_client_signups (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pending_client_signup_send_log_pending_time
  ON public.pending_client_signup_send_log (pending_id, created_at DESC);

ALTER TABLE public.pending_client_signups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_client_signup_send_log ENABLE ROW LEVEL SECURITY;

-- No anon/authenticated policies — backend service role only.
