-- 20260512_support_messages.sql
-- Purpose: 1:1 messaging between clients and the Admin support team.
-- Run this once in Supabase SQL editor.

begin;

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete set null,
  sender_role text not null check (sender_role in ('client','admin')),
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists support_messages_client_idx
  on public.support_messages (client_id, created_at desc);

create index if not exists support_messages_unread_client_idx
  on public.support_messages (client_id, sender_role, is_read);

alter table public.support_messages enable row level security;

-- Clients: full access to their own thread (insert as themselves, role='client').
drop policy if exists support_messages_client_select on public.support_messages;
create policy support_messages_client_select
on public.support_messages
for select
using (auth.uid() = client_id);

drop policy if exists support_messages_client_insert on public.support_messages;
create policy support_messages_client_insert
on public.support_messages
for insert
with check (
  auth.uid() = client_id
  and sender_role = 'client'
  and sender_id = auth.uid()
);

drop policy if exists support_messages_client_update on public.support_messages;
create policy support_messages_client_update
on public.support_messages
for update
using (auth.uid() = client_id)
with check (auth.uid() = client_id);

-- Admins: read/insert/update everything.
drop policy if exists support_messages_admin_select on public.support_messages;
create policy support_messages_admin_select
on public.support_messages
for select
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role::text = 'Admin'
  )
);

drop policy if exists support_messages_admin_insert on public.support_messages;
create policy support_messages_admin_insert
on public.support_messages
for insert
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role::text = 'Admin'
  )
  and sender_role = 'admin'
);

drop policy if exists support_messages_admin_update on public.support_messages;
create policy support_messages_admin_update
on public.support_messages
for update
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role::text = 'Admin'
  )
);

commit;

-- Enable realtime so both sides receive postgres_changes events.
-- (Run separately; some Supabase projects throw if a table is already in the
-- publication, in which case it is safe to ignore the error.)
alter publication supabase_realtime add table public.support_messages;
