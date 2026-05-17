-- Enable Supabase Realtime for notarial_requests so client Notary Status
-- updates when admin changes status (In Process, Ready for Pickup, etc.).
-- Run once in Supabase SQL Editor (Dashboard → SQL).

begin;

do $$
declare
  tbl text;
begin
  foreach tbl in array array['notarial_requests']
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
