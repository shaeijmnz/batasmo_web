-- Restore attorney self-service availability management (alongside admin).
-- Attorneys can view, insert, update, and delete their own unbooked slots.

begin;

create or replace function public.is_attorney(_uid uuid)
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
      and p.role::text = 'Attorney'
  );
$$;

drop policy if exists attorney_availability_slots_select_own on public.availability_slots;
create policy attorney_availability_slots_select_own
on public.availability_slots
for select
to authenticated
using (
  attorney_id = auth.uid()
  and public.is_attorney(auth.uid())
);

drop policy if exists attorney_availability_slots_insert_own on public.availability_slots;
create policy attorney_availability_slots_insert_own
on public.availability_slots
for insert
to authenticated
with check (
  attorney_id = auth.uid()
  and is_booked = false
  and public.is_attorney(auth.uid())
);

drop policy if exists attorney_availability_slots_update_own on public.availability_slots;
create policy attorney_availability_slots_update_own
on public.availability_slots
for update
to authenticated
using (
  attorney_id = auth.uid()
  and public.is_attorney(auth.uid())
)
with check (
  attorney_id = auth.uid()
  and public.is_attorney(auth.uid())
);

drop policy if exists attorney_availability_slots_delete_own on public.availability_slots;
create policy attorney_availability_slots_delete_own
on public.availability_slots
for delete
to authenticated
using (
  attorney_id = auth.uid()
  and is_booked = false
  and public.is_attorney(auth.uid())
);

commit;
