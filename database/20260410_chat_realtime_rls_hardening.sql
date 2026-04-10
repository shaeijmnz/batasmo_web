-- Chat realtime + RLS hardening for consultation messaging
-- Apply this in Supabase SQL editor if attorney/client message sync is inconsistent.

begin;

alter table if exists public.consultation_rooms enable row level security;
alter table if exists public.messages enable row level security;

-- Participants can view their own consultation room rows.
drop policy if exists consultation_rooms_participant_select on public.consultation_rooms;
create policy consultation_rooms_participant_select
on public.consultation_rooms
for select
using (
  exists (
    select 1
    from public.appointments a
    where a.id = consultation_rooms.appointment_id
      and (a.client_id = auth.uid() or a.attorney_id = auth.uid())
  )
);

-- Participants can view all messages inside rooms they belong to.
drop policy if exists messages_participant_select on public.messages;
create policy messages_participant_select
on public.messages
for select
using (
  exists (
    select 1
    from public.consultation_rooms cr
    join public.appointments a on a.id = cr.appointment_id
    where cr.id = messages.room_id
      and (a.client_id = auth.uid() or a.attorney_id = auth.uid())
  )
);

-- Participants can send messages only as themselves.
drop policy if exists messages_participant_insert on public.messages;
create policy messages_participant_insert
on public.messages
for insert
with check (
  auth.uid() = sender_id
  and exists (
    select 1
    from public.consultation_rooms cr
    join public.appointments a on a.id = cr.appointment_id
    where cr.id = messages.room_id
      and (a.client_id = auth.uid() or a.attorney_id = auth.uid())
  )
);

-- Allow sender to delete their own message in their own consultation room.
drop policy if exists messages_sender_delete on public.messages;
create policy messages_sender_delete
on public.messages
for delete
using (
  auth.uid() = sender_id
  and exists (
    select 1
    from public.consultation_rooms cr
    join public.appointments a on a.id = cr.appointment_id
    where cr.id = messages.room_id
      and (a.client_id = auth.uid() or a.attorney_id = auth.uid())
  )
);

-- Ensure realtime has both tables published.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'consultation_rooms'
  ) then
    alter publication supabase_realtime add table public.consultation_rooms;
  end if;
end
$$;

commit;
