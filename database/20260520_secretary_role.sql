-- Secretary role: staff-level access (lighter than Admin in the app UI).
-- Run once in Supabase SQL Editor after reviewing credentials below.

begin;

-- 1) Extend enum (safe if already applied)
do $$
begin
  alter type public.user_role add value if not exists 'Secretary';
exception
  when duplicate_object then null;
end $$;

-- 2) Staff helper (Admin + Secretary) for operational RLS
create or replace function public.is_staff(_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = _uid
      and p.role::text in ('Admin', 'Secretary')
  );
$$;

-- 3) Operational tables: allow Secretary the same access as Admin had via is_admin()
--    (Admin-only settings/CMS stay on is_admin — see other migrations)

-- profiles
drop policy if exists staff_profiles_select_all on public.profiles;
create policy staff_profiles_select_all
on public.profiles for select
using (public.is_staff(auth.uid()));

drop policy if exists admin_profiles_select_all on public.profiles;
drop policy if exists admin_profiles_update_all on public.profiles;
create policy admin_profiles_update_all
on public.profiles for update
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

-- attorney_profiles
drop policy if exists staff_attorney_profiles_select on public.attorney_profiles;
create policy staff_attorney_profiles_select
on public.attorney_profiles for select
using (public.is_staff(auth.uid()));

drop policy if exists admin_attorney_profiles_select on public.attorney_profiles;
drop policy if exists admin_attorney_profiles_all on public.attorney_profiles;
create policy admin_attorney_profiles_all
on public.attorney_profiles for all
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

-- appointments
drop policy if exists staff_appointments_select on public.appointments;
create policy staff_appointments_select
on public.appointments for select
using (public.is_staff(auth.uid()));

drop policy if exists staff_appointments_update on public.appointments;
create policy staff_appointments_update
on public.appointments for update
using (public.is_staff(auth.uid()))
with check (public.is_staff(auth.uid()));

drop policy if exists admin_appointments_select on public.appointments;
drop policy if exists admin_appointments_update on public.appointments;

-- transactions (read-only for staff)
drop policy if exists staff_transactions_select on public.transactions;
create policy staff_transactions_select
on public.transactions for select
using (public.is_staff(auth.uid()));

drop policy if exists admin_transactions_select on public.transactions;

-- payout_requests (admin only — sensitive)
drop policy if exists admin_payout_requests_all on public.payout_requests;

-- notarial_requests
drop policy if exists staff_notarial_select on public.notarial_requests;
create policy staff_notarial_select
on public.notarial_requests for select
using (public.is_staff(auth.uid()));

drop policy if exists staff_notarial_update on public.notarial_requests;
create policy staff_notarial_update
on public.notarial_requests for update
using (public.is_staff(auth.uid()))
with check (public.is_staff(auth.uid()));

drop policy if exists admin_notarial_select on public.notarial_requests;
drop policy if exists admin_notarial_update on public.notarial_requests;

-- notifications (read for staff; insert admin only)
drop policy if exists staff_notifications_select on public.notifications;
create policy staff_notifications_select
on public.notifications for select
using (public.is_staff(auth.uid()));

drop policy if exists admin_notifications_select on public.notifications;

-- support_messages
drop policy if exists support_messages_staff_select on public.support_messages;
create policy support_messages_staff_select
on public.support_messages for select
using (public.is_staff(auth.uid()));

drop policy if exists support_messages_staff_insert on public.support_messages;
create policy support_messages_staff_insert
on public.support_messages for insert
with check (public.is_staff(auth.uid()) and sender_role = 'admin');

drop policy if exists support_messages_staff_update on public.support_messages;
create policy support_messages_staff_update
on public.support_messages for update
using (public.is_staff(auth.uid()))
with check (public.is_staff(auth.uid()));

drop policy if exists support_messages_admin_select on public.support_messages;
drop policy if exists support_messages_admin_insert on public.support_messages;
drop policy if exists support_messages_admin_update on public.support_messages;

-- consultation_rooms (admin dashboard in-progress count)
alter table if exists public.consultation_rooms enable row level security;
drop policy if exists staff_consultation_rooms_select on public.consultation_rooms;
create policy staff_consultation_rooms_select
on public.consultation_rooms for select
using (public.is_staff(auth.uid()));

drop policy if exists admin_consultation_rooms_select on public.consultation_rooms;

-- availability_slots (view/manage slots — staff can help scheduling)
drop policy if exists staff_availability_slots_select on public.availability_slots;
create policy staff_availability_slots_select
on public.availability_slots for select
using (public.is_staff(auth.uid()));

drop policy if exists staff_availability_slots_all on public.availability_slots;
create policy staff_availability_slots_all
on public.availability_slots for all
using (public.is_staff(auth.uid()))
with check (public.is_staff(auth.uid()));

drop policy if exists admin_availability_slots_all on public.availability_slots;

commit;

-- ── Default Secretary account (change password after first login) ─────────────
-- Email:    secretary@batasmo.app
-- Password: BatasMo#Secretary2026!

do $$
declare
  v_email text := 'secretary@batasmo.app';
  v_password text := 'BatasMo#Secretary2026!';
  v_full_name text := 'BatasMo Secretary';
  v_user_id uuid;
begin
  select id into v_user_id from auth.users where email = v_email limit 1;

  if v_user_id is null then
    v_user_id := gen_random_uuid();
    insert into auth.users (
      id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) values (
      v_user_id, 'authenticated', 'authenticated', v_email,
      crypt(v_password, gen_salt('bf')), now(),
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
      jsonb_build_object('full_name', v_full_name, 'role', 'Secretary'),
      now(), now()
    );
    insert into auth.identities (
      id, user_id, identity_data, provider, provider_id,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', v_email),
      'email', v_user_id::text, now(), now(), now()
    ) on conflict (provider, provider_id) do nothing;
  end if;

  insert into public.profiles (id, email, full_name, role)
  values (v_user_id, v_email, v_full_name, 'Secretary'::user_role)
  on conflict (id) do update
  set email = excluded.email, full_name = excluded.full_name,
      role = 'Secretary'::user_role, updated_at = now();
end $$;
