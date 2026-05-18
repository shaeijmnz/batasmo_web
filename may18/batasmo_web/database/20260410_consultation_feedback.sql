-- 20260410_consultation_feedback.sql
-- Purpose: Create normalized client feedback storage for completed consultations.
-- Safe to run in Supabase SQL Editor.

begin;

create table if not exists public.consultation_feedback (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  attorney_id uuid not null references public.profiles(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint consultation_feedback_one_per_appointment unique (appointment_id),
  constraint consultation_feedback_one_per_client_appointment unique (appointment_id, client_id)
);

create index if not exists consultation_feedback_attorney_idx
  on public.consultation_feedback (attorney_id, created_at desc);

create index if not exists consultation_feedback_client_idx
  on public.consultation_feedback (client_id, created_at desc);

create index if not exists consultation_feedback_rating_idx
  on public.consultation_feedback (rating);

alter table public.consultation_feedback enable row level security;

-- Client can read/insert/update only their own feedback tied to their appointment.
drop policy if exists consultation_feedback_client_read on public.consultation_feedback;
create policy consultation_feedback_client_read
on public.consultation_feedback
for select
using (
  auth.uid() = client_id
);

drop policy if exists consultation_feedback_client_insert on public.consultation_feedback;
create policy consultation_feedback_client_insert
on public.consultation_feedback
for insert
with check (
  auth.uid() = client_id
  and exists (
    select 1
    from public.appointments a
    where a.id = appointment_id
      and a.client_id = auth.uid()
      and a.attorney_id = consultation_feedback.attorney_id
  )
);

drop policy if exists consultation_feedback_client_update on public.consultation_feedback;
create policy consultation_feedback_client_update
on public.consultation_feedback
for update
using (
  auth.uid() = client_id
)
with check (
  auth.uid() = client_id
);

-- Attorney can read feedback received for their appointments.
drop policy if exists consultation_feedback_attorney_read on public.consultation_feedback;
create policy consultation_feedback_attorney_read
on public.consultation_feedback
for select
using (
  auth.uid() = attorney_id
);

-- Admin can read all feedback.
drop policy if exists consultation_feedback_admin_read on public.consultation_feedback;
create policy consultation_feedback_admin_read
on public.consultation_feedback
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role::text = 'Admin'
  )
);

commit;
