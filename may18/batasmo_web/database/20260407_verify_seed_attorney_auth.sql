-- TEST-ONLY diagnostics for seeded attorney auth records
-- Run after 20260406_reset_seed_attorney_passwords.sql

WITH target_emails AS (
  SELECT unnest(ARRAY[
    'test.jeanne.castillo-anarna@batasmo.app',
    'test.alston.anarna@batasmo.app',
    'test.allen.anarna@batasmo.app'
  ]::text[]) AS email
),
auth_rows AS (
  SELECT
    lower(u.email) AS email,
    u.id AS auth_user_id,
    u.email_confirmed_at,
    u.created_at AS auth_created_at,
    u.updated_at AS auth_updated_at
  FROM auth.users u
),
identity_rows AS (
  SELECT
    lower(i.provider_id) AS email,
    i.user_id,
    i.provider,
    i.created_at AS identity_created_at,
    i.updated_at AS identity_updated_at
  FROM auth.identities i
  WHERE i.provider = 'email'
),
profile_rows AS (
  SELECT
    lower(p.email) AS email,
    p.id AS profile_id,
    p.role,
    p.full_name,
    p.updated_at AS profile_updated_at
  FROM public.profiles p
)
SELECT
  t.email,
  a.auth_user_id,
  p.profile_id,
  (a.auth_user_id IS NOT NULL) AS has_auth_user,
  (i.user_id IS NOT NULL) AS has_email_identity,
  (p.profile_id IS NOT NULL) AS has_profile,
  (a.auth_user_id IS NOT NULL AND p.profile_id IS NOT NULL AND a.auth_user_id = p.profile_id) AS auth_profile_id_match,
  (i.user_id IS NOT NULL AND a.auth_user_id IS NOT NULL AND i.user_id = a.auth_user_id) AS identity_user_match,
  p.role,
  p.full_name,
  a.email_confirmed_at,
  a.auth_updated_at,
  p.profile_updated_at
FROM target_emails t
LEFT JOIN auth_rows a ON a.email = t.email
LEFT JOIN identity_rows i ON i.email = t.email
LEFT JOIN profile_rows p ON p.email = t.email
ORDER BY t.email;
