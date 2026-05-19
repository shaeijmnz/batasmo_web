-- TEST-ONLY seed for fixed attorney account and CMS gallery entry.
-- Do not use in production.

DO $$
DECLARE
  v_email text := 'test.attorney@batasmo.app';
  v_password text := 'BatasMo#AttyTest2026!';
  v_full_name text := 'Atty. Jeanne Luz Castillo-Anarna';
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = v_email
  LIMIT 1;

  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();

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
      jsonb_build_object('full_name', v_full_name),
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
      jsonb_build_object('sub', v_user_id::text, 'email', v_email),
      'email',
      v_user_id::text,
      now(),
      now(),
      now()
    )
    ON CONFLICT (provider, provider_id) DO NOTHING;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (v_user_id, v_email, v_full_name, 'Attorney'::user_role)
  ON CONFLICT (id) DO UPDATE
  SET
    email = excluded.email,
    full_name = excluded.full_name,
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
    'PRC-TEST-0001',
    ARRAY['Family Law', 'Corporate and Business Law', 'Intellectual Property Law', 'General Litigation'],
    8,
    2000,
    'UST Faculty of Civil Law alumna with extensive private practice and litigation experience in family and corporate legal matters.',
    true,
    now()
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    prc_id = excluded.prc_id,
    specialties = excluded.specialties,
    years_experience = excluded.years_experience,
    consultation_fee = excluded.consultation_fee,
    bio = excluded.bio,
    is_verified = true,
    updated_at = now();

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
    '/assets/attorneys/jeanne-luz-castillo-anarna.jpg',
    ARRAY['Family Law', 'Corporate and Business Law', 'Intellectual Property Law'],
    ARRAY['General Litigation', 'Corporate Compliance', 'Family Court Cases'],
    'Atty. Jeanne earned her law degree from the University of Santo Tomas and has extensive private practice and court litigation experience, including family and corporate legal work.',
    true,
    now()
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    display_name = excluded.display_name,
    profile_image_url = excluded.profile_image_url,
    expertise_fields = excluded.expertise_fields,
    practice_areas = excluded.practice_areas,
    biography = excluded.biography,
    is_published = excluded.is_published,
    updated_at = now();

  INSERT INTO public.availability_slots (attorney_id, start_time, end_time, is_booked, updated_at)
  VALUES
    (v_user_id, now() + interval '2 days', now() + interval '2 days 1 hour', false, now()),
    (v_user_id, now() + interval '3 days', now() + interval '3 days 1 hour', false, now())
  ON CONFLICT DO NOTHING;
END $$;
