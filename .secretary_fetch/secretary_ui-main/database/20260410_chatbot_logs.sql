-- Chatbot conversation logs for analytics and quality improvements.
create table if not exists public.chatbot_logs (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'Client',
  message text not null,
  response text not null,
  intent text,
  created_at timestamptz not null default now()
);

alter table public.chatbot_logs enable row level security;

-- Clients, attorneys, and admins can insert their own chatbot exchanges.
create policy if not exists "chatbot_logs_insert_own"
on public.chatbot_logs
for insert
to authenticated
with check (auth.uid() = user_id);

-- Users can review only their own logs.
create policy if not exists "chatbot_logs_select_own"
on public.chatbot_logs
for select
to authenticated
using (auth.uid() = user_id);

create index if not exists chatbot_logs_user_created_idx
on public.chatbot_logs(user_id, created_at desc);
