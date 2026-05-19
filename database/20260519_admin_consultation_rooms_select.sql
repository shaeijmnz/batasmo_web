-- Let Admin read all consultation_rooms (for ongoing video call counts + In Progress status).
-- Run in Supabase SQL Editor after is_admin() exists (see 20260326_admin_backend.sql).

begin;

drop policy if exists admin_consultation_rooms_select on public.consultation_rooms;
create policy admin_consultation_rooms_select
on public.consultation_rooms
for select
to authenticated
using (public.is_admin(auth.uid()));

commit;
