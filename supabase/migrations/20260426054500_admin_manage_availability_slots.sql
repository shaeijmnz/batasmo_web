-- Allow Admin users to manage attorney availability slots.
-- Required now that availability scheduling moved from attorney accounts to admin.

begin;

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

alter table public.availability_slots enable row level security;

drop policy if exists admin_availability_slots_all on public.availability_slots;
create policy admin_availability_slots_all
on public.availability_slots
for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

commit;
