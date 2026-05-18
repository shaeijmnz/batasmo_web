-- Enable Supabase Realtime for BatasMo tables (instant dashboard updates).
-- Run in Supabase SQL Editor on the SAME project as batasmo-web (not auth-lab / empty projects).
--
-- First verify you're on the right DB:
--   select tablename from pg_tables where schemaname = 'public' and tablename = 'appointments';
-- Should return one row. If empty, switch project or run database/SUPABASE_SETUP.sql first.

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
    if exists (
      select 1
      from pg_tables
      where schemaname = 'public'
        and tablename = tbl
    )
    and not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = tbl
    ) then
      execute format('alter publication supabase_realtime add table public.%I', tbl);
      raise notice 'Added public.% to supabase_realtime', tbl;
    elsif not exists (
      select 1
      from pg_tables
      where schemaname = 'public'
        and tablename = tbl
    ) then
      raise notice 'Skipped % — table does not exist in this database', tbl;
    else
      raise notice 'Skipped % — already on supabase_realtime', tbl;
    end if;
  end loop;
end
$$;

commit;
