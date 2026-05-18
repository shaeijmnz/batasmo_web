-- Attorney-written consultation summary visible to the client (after session is completed).
-- Run in Supabase SQL Editor.

begin;

alter table public.appointments
  add column if not exists attorney_consultation_summary text;

comment on column public.appointments.attorney_consultation_summary is
  'Summary of the consultation for the client, written by the assigned attorney after the session.';

create or replace function public.set_attorney_consultation_summary(
  p_appointment_id uuid,
  p_summary text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_trimmed text;
  updated_count int;
begin
  if v_uid is null then
    raise exception 'Authentication required.';
  end if;

  v_trimmed := left(trim(coalesce(p_summary, '')), 12000);

  update public.appointments a
  set
    attorney_consultation_summary = nullif(v_trimmed, ''),
    updated_at = now()
  where a.id = p_appointment_id
    and a.attorney_id = v_uid
    and lower(a.status::text) = 'completed';

  get diagnostics updated_count = row_count;

  if updated_count = 0 then
    raise exception 'Unable to save summary (not found, not your appointment, or session not completed).';
  end if;
end;
$$;

revoke all on function public.set_attorney_consultation_summary(uuid, text) from public;
grant execute on function public.set_attorney_consultation_summary(uuid, text) to authenticated;

commit;
