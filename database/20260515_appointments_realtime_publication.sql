-- Enable Supabase Realtime for appointments / payments / notifications
-- so attorney & client dashboards update without manual browser refresh.
-- Run once in Supabase SQL Editor (Dashboard → SQL).

begin;

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'appointments',
    'transactions',
    'notifications',
    'availability_slots',
    'consultation_rooms'
  ]
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = tbl
    ) then
      execute format('alter publication supabase_realtime add table public.%I', tbl);
    end if;
  end loop;
end
$$;

commit;
