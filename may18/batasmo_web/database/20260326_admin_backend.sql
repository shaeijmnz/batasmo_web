-- BatasMo Admin backend + RLS hardening
-- Run in Supabase SQL Editor.

begin;

-- 1) Reusable helper for admin authorization checks in policies.
create or replace function public.is_admin(_uid uuid)
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
      and p.role::text = 'Admin'
  );
$$;

-- 2) Ensure RLS is enabled on admin-managed tables.
alter table public.profiles enable row level security;
alter table public.attorney_profiles enable row level security;
alter table public.appointments enable row level security;
alter table public.transactions enable row level security;
alter table public.payout_requests enable row level security;
alter table public.notarial_requests enable row level security;
alter table public.notifications enable row level security;

-- 3) Admin policy set.
drop policy if exists admin_profiles_select_all on public.profiles;
create policy admin_profiles_select_all
on public.profiles for select
using (public.is_admin(auth.uid()));

drop policy if exists admin_profiles_update_all on public.profiles;
create policy admin_profiles_update_all
on public.profiles for update
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists admin_attorney_profiles_select on public.attorney_profiles;
create policy admin_attorney_profiles_select
on public.attorney_profiles for select
using (public.is_admin(auth.uid()));

drop policy if exists admin_attorney_profiles_all on public.attorney_profiles;
create policy admin_attorney_profiles_all
on public.attorney_profiles for all
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists admin_appointments_select on public.appointments;
create policy admin_appointments_select
on public.appointments for select
using (public.is_admin(auth.uid()));

drop policy if exists admin_appointments_update on public.appointments;
create policy admin_appointments_update
on public.appointments for update
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists admin_transactions_select on public.transactions;
create policy admin_transactions_select
on public.transactions for select
using (public.is_admin(auth.uid()));

drop policy if exists admin_payout_requests_all on public.payout_requests;
create policy admin_payout_requests_all
on public.payout_requests for all
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists admin_notarial_select on public.notarial_requests;
create policy admin_notarial_select
on public.notarial_requests for select
using (public.is_admin(auth.uid()));

drop policy if exists admin_notarial_update on public.notarial_requests;
create policy admin_notarial_update
on public.notarial_requests for update
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists admin_notifications_select on public.notifications;
create policy admin_notifications_select
on public.notifications for select
using (public.is_admin(auth.uid()));

drop policy if exists admin_notifications_insert on public.notifications;
create policy admin_notifications_insert
on public.notifications for insert
with check (public.is_admin(auth.uid()));

commit;
