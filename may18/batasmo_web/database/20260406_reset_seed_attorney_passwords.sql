-- TEST-ONLY: force-create/fix auth credentials for seeded attorney test accounts
-- Run in Supabase SQL Editor.

DO $$
DECLARE
  v_password text := 'BatasMo#AttyTest2026!';
  v_email text;
  v_user_id uuid;
  v_profile_id uuid;
  v_profile_name text;
  v_has_audit_logs boolean := to_regclass('public.audit_logs') is not null;
  v_instance_id uuid := '00000000-0000-0000-0000-000000000000'::uuid;
BEGIN
  SELECT COALESCE(
    (SELECT instance_id FROM auth.users ORDER BY created_at DESC LIMIT 1),
    v_instance_id
  )
  INTO v_instance_id;

  FOREACH v_email IN ARRAY ARRAY[
    'test.jeanne.castillo-anarna@batasmo.app',
    'test.alston.anarna@batasmo.app',
    'test.allen.anarna@batasmo.app'
  ]
  LOOP
    v_email := lower(trim(v_email));

    SELECT id, full_name
    INTO v_profile_id, v_profile_name
    FROM public.profiles
    WHERE lower(email) = v_email
    ORDER BY updated_at DESC NULLS LAST
    LIMIT 1;

    IF v_profile_id IS NOT NULL THEN
      v_user_id := v_profile_id;
    ELSE
      SELECT id
      INTO v_user_id
      FROM auth.users
      WHERE lower(email) = v_email
      ORDER BY updated_at DESC NULLS LAST
      LIMIT 1;
    END IF;

    IF v_user_id IS NULL THEN
      v_user_id := gen_random_uuid();
    END IF;

    -- Prevent email unique conflicts from stale duplicate auth users.
    DELETE FROM auth.identities
    WHERE user_id IN (
      SELECT id
      FROM auth.users
      WHERE lower(email) = v_email
        AND id <> v_user_id
    );

    DELETE FROM auth.users
    WHERE lower(email) = v_email
      AND id <> v_user_id;

    INSERT INTO auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    )
    VALUES (
      v_user_id,
      v_instance_id,
      'authenticated',
      'authenticated',
      v_email,
      crypt(v_password, gen_salt('bf')),
      now(),
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
      jsonb_build_object('full_name', COALESCE(NULLIF(v_profile_name, ''), 'Attorney Test User'), 'role', 'Attorney'),
      now(),
      now(),
      '',
      '',
      '',
      ''
    )
    ON CONFLICT (id) DO UPDATE
    SET
      instance_id = EXCLUDED.instance_id,
      aud = EXCLUDED.aud,
      role = EXCLUDED.role,
      email = EXCLUDED.email,
      encrypted_password = EXCLUDED.encrypted_password,
      email_confirmed_at = COALESCE(auth.users.email_confirmed_at, now()),
      raw_app_meta_data = EXCLUDED.raw_app_meta_data,
      raw_user_meta_data = COALESCE(auth.users.raw_user_meta_data, '{}'::jsonb) || EXCLUDED.raw_user_meta_data,
      confirmation_token = '',
      email_change = '',
      email_change_token_new = '',
      recovery_token = '',
      updated_at = now();

    DELETE FROM auth.identities
    WHERE user_id = v_user_id
      AND provider = 'email'
      AND provider_id <> v_email;

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
      jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true),
      'email',
      v_email,
      now(),
      now(),
      now()
    )
    ON CONFLICT (provider, provider_id) DO UPDATE
    SET
      user_id = EXCLUDED.user_id,
      identity_data = EXCLUDED.identity_data,
      last_sign_in_at = now(),
      updated_at = now();

    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
      v_user_id,
      v_email,
      COALESCE(NULLIF(v_profile_name, ''), 'Attorney Test User'),
      'Attorney'::user_role
    )
    ON CONFLICT (id) DO UPDATE
    SET
      email = EXCLUDED.email,
      full_name = EXCLUDED.full_name,
      role = 'Attorney'::user_role,
      updated_at = now();

    IF v_has_audit_logs THEN
      DELETE FROM public.audit_logs
      WHERE lower(email) = v_email;
    END IF;

    RAISE NOTICE 'Auth reset OK for % (user_id=%)', v_email, v_user_id;
  END LOOP;
END $$;
