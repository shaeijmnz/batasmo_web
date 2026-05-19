-- TEST-ONLY seed: creates 3 attorney login accounts from Attorney-Information.txt
-- with temporary credentials/IDs for development testing.
--
-- Run in Supabase SQL Editor with service-role privileges.
-- Do NOT use in production.
--
-- Temporary password for all seeded attorneys:
--   BatasMo#AttyTest2026!

DO $$
DECLARE
  v_default_password text := 'BatasMo#AttyTest2026!';
  v_user_id uuid;
  v_instance_id uuid := '00000000-0000-0000-0000-000000000000'::uuid;
  v_has_cms_directory boolean := to_regclass('public.cms_attorney_directory') is not null;
  v_has_audit_logs boolean := to_regclass('public.audit_logs') is not null;
  v_email text;
  v_full_name text;
  v_prc_id text;
  v_specialties text[];
  v_bio text;
  v_image_url text;
  v_row jsonb;
BEGIN
  SELECT COALESCE(
    (SELECT instance_id FROM auth.users ORDER BY created_at DESC LIMIT 1),
    v_instance_id
  )
  INTO v_instance_id;

  ALTER TABLE public.attorney_profiles
  ADD COLUMN IF NOT EXISTS prc_id text;

  FOR v_row IN
    SELECT *
    FROM jsonb_array_elements(
      '[
        {
          "full_name": "Atty. Jeanne Luz Castillo-Anarna",
          "email": "test.jeanne.castillo-anarna@batasmo.app",
          "prc_id": "TEMPORARY-PRC-0001",
          "specialties": [
            "Family Law",
            "Corporate and Business Law",
            "Intellectual Property Law",
            "General Litigation"
          ],
          "profile_image_url": "/assets/attorneys/jeanne-luz-castillo-anarna.jpg",
          "bio": "Atty. Jeanne obtained her law degree from the Faculty of Civil Law, University of Santo Tomas, where she was awarded with a Medal for Leadership. She started her law career in private practice handling civil, criminal, and corporate cases, and later served as Branch Clerk of Court in the Regional Trial Court of Quezon City."
        },
        {
          "full_name": "Atty. Alston Kevin Anarna",
          "email": "test.alston.anarna@batasmo.app",
          "prc_id": "TEMPORARY-PRC-0002",
          "specialties": [
            "Real Estate and Land Registration Law",
            "Election and Administrative Law",
            "Labor Law"
          ],
          "profile_image_url": "/assets/attorneys/alston-kevin-anarna.jpg",
          "bio": "Atty. Kevin obtained his Bachelor of Laws degree from the University of Santo Tomas and holds a double degree in Political Science and Legal Management from De La Salle University Manila. He has represented clients in courts and tribunals and has also served in local governance as Provincial Board Member of Cavite."
        },
        {
          "full_name": "Atty. Allen Kristopher Anarna",
          "email": "test.allen.anarna@batasmo.app",
          "prc_id": "TEMPORARY-PRC-0003",
          "specialties": [
            "Real Estate and Land Registration Law",
            "Law on Public Officials",
            "Administrative Law",
            "Taxation"
          ],
          "profile_image_url": "/assets/attorneys/allen-kristopher-anarna.png",
          "bio": "Atty. Allen earned his law degree and accountancy degree from the University of Santo Tomas and passed the CPA board exam. He served as Attorney for the Presidential Anti-Corruption Commission and was later appointed Deputy Register of Deeds of the Registry of Deeds - Taguig City."
        }
      ]'::jsonb
    )
  LOOP
    v_email := lower(trim(v_row->>'email'));
    v_full_name := trim(v_row->>'full_name');
    v_prc_id := trim(v_row->>'prc_id');
    v_specialties := ARRAY(SELECT jsonb_array_elements_text(v_row->'specialties'));
    v_bio := v_row->>'bio';
    v_image_url := v_row->>'profile_image_url';

    SELECT id INTO v_user_id
    FROM auth.users
    WHERE lower(email) = v_email
    ORDER BY updated_at DESC NULLS LAST
    LIMIT 1;

    IF v_user_id IS NULL THEN
      v_user_id := gen_random_uuid();

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
        updated_at
      )
      VALUES (
        v_user_id,
        v_instance_id,
        'authenticated',
        'authenticated',
        v_email,
        crypt(v_default_password, gen_salt('bf')),
        now(),
        jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
        jsonb_build_object('full_name', v_full_name, 'role', 'Attorney'),
        now(),
        now()
      );

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
      ON CONFLICT (provider, provider_id) DO NOTHING;
    ELSE
      UPDATE auth.users
      SET
        aud = 'authenticated',
        role = 'authenticated',
        email = v_email,
        encrypted_password = crypt(v_default_password, gen_salt('bf')),
        raw_app_meta_data = jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('full_name', v_full_name, 'role', 'Attorney'),
        updated_at = now()
      WHERE id = v_user_id;
    END IF;

    DELETE FROM auth.identities
    WHERE provider = 'email'
      AND provider_id = v_email
      AND user_id <> v_user_id;

    DELETE FROM auth.identities
    WHERE provider = 'email'
      AND user_id = v_user_id
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

    IF v_has_audit_logs THEN
      DELETE FROM public.audit_logs
      WHERE lower(email) = v_email;
    END IF;

    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (v_user_id, v_email, v_full_name, 'Attorney'::user_role)
    ON CONFLICT (id) DO UPDATE
    SET
      email = EXCLUDED.email,
      full_name = EXCLUDED.full_name,
      role = 'Attorney'::user_role,
      updated_at = now();

    INSERT INTO public.attorney_profiles (
      user_id,
      prc_id,
      specialties,
      years_experience,
      consultation_fee,
      bio,
      is_verified,
      updated_at
    )
    VALUES (
      v_user_id,
      v_prc_id,
      v_specialties,
      0,
      2000,
      v_bio,
      true,
      now()
    )
    ON CONFLICT (user_id) DO UPDATE
    SET
      prc_id = EXCLUDED.prc_id,
      specialties = EXCLUDED.specialties,
      years_experience = EXCLUDED.years_experience,
      consultation_fee = EXCLUDED.consultation_fee,
      bio = EXCLUDED.bio,
      is_verified = true,
      updated_at = now();

    IF v_has_cms_directory THEN
      INSERT INTO public.cms_attorney_directory (
        user_id,
        display_name,
        profile_image_url,
        expertise_fields,
        practice_areas,
        biography,
        is_published,
        updated_at
      )
      VALUES (
        v_user_id,
        v_full_name,
        v_image_url,
        v_specialties,
        v_specialties,
        v_bio,
        true,
        now()
      )
      ON CONFLICT (user_id) DO UPDATE
      SET
        display_name = EXCLUDED.display_name,
        profile_image_url = EXCLUDED.profile_image_url,
        expertise_fields = EXCLUDED.expertise_fields,
        practice_areas = EXCLUDED.practice_areas,
        biography = EXCLUDED.biography,
        is_published = EXCLUDED.is_published,
        updated_at = now();
    END IF;
  END LOOP;
END $$;
