-- TEST-ONLY: force reset credentials for seeded attorney test accounts
-- Run in Supabase SQL Editor.

DO $$
DECLARE
  v_password text := 'BatasMo#AttyTest2026!';
  v_email text;
  v_user_id uuid;
  v_profile_id uuid;
  v_profile_name text;
  v_has_audit_logs boolean := to_regclass('public.audit_logs') is not null;
BEGIN
  FOREACH v_email IN ARRAY ARRAY[
    'test.jeanne.castillo-anarna@batasmo.app',
    'test.alston.anarna@batasmo.app',
    'test.allen.anarna@batasmo.app'
  ]
  LOOP
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE lower(email) = v_email
    ORDER BY deleted_at IS NULL DESC, updated_at DESC
    LIMIT 1;

    IF v_user_id IS NULL THEN
      SELECT id, full_name
      INTO v_profile_id, v_profile_name
      FROM public.profiles
      WHERE lower(email) = v_email
      LIMIT 1;

      IF v_profile_id IS NULL THEN
        RAISE NOTICE 'Skipping %, no matching profile row found', v_email;
        CONTINUE;
      END IF;

      v_user_id := v_profile_id;

      INSERT INTO auth.users (
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at
      )
      VALUES (
        v_user_id,
        'authenticated',
        'authenticated',
        v_email,
        crypt(v_password, gen_salt('bf')),
        now(),
        jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
        jsonb_build_object('full_name', COALESCE(v_profile_name, 'Attorney Test User'), 'role', 'Attorney'),
        now(),
        now()
      )
      ON CONFLICT (id) DO NOTHING;
    END IF;

    UPDATE auth.users
    SET
      aud = 'authenticated',
      role = 'authenticated',
      email = v_email,
      encrypted_password = crypt(v_password, gen_salt('bf')),
      raw_app_meta_data = jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
      raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'Attorney'),
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      deleted_at = null,
      banned_until = null,
      is_sso_user = false,
      is_anonymous = false,
      updated_at = now()
    WHERE id = v_user_id;

    IF EXISTS (
      SELECT 1
      FROM auth.identities
      WHERE user_id = v_user_id
        AND provider = 'email'
    ) THEN
      UPDATE auth.identities
      SET
        identity_data = jsonb_build_object('sub', v_user_id::text, 'email', v_email),
        last_sign_in_at = now(),
        updated_at = now()
      WHERE user_id = v_user_id
        AND provider = 'email';
    ELSE
      INSERT INTO auth.identities (
        id,
        user_id,
        identity_data,
        provider,
        provider_id,
        last_sign_in_at,
        created_at,
        updated_at
      )
      VALUES (
        gen_random_uuid(),
        v_user_id,
        jsonb_build_object('sub', v_user_id::text, 'email', v_email),
        'email',
        v_user_id::text,
        now(),
        now(),
        now()
      )
      ON CONFLICT (provider, provider_id) DO NOTHING;
    END IF;

    IF v_has_audit_logs THEN
      DELETE FROM public.audit_logs WHERE lower(email) = v_email;
    END IF;

    RAISE NOTICE 'Reset OK for %', v_email;
  END LOOP;
END $$;
