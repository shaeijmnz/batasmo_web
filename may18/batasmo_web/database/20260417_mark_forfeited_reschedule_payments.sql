-- 20260417_mark_forfeited_reschedule_payments.sql
-- Marks paid consultation payments as forfeited when a rescheduled appointment is already missed.
-- Scope: current authenticated client only.

begin;

create or replace function public.mark_client_forfeited_rescheduled_payments()
returns table (
  appointment_id uuid,
  title text,
  attorney_name text,
  scheduled_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;

  -- Convert eligible paid transactions to forfeited.
  with converted as (
    update public.transactions t
    set payment_status = 'forfeited',
        updated_at = now()
    from public.appointments a
    where t.appointment_id = a.id
      and a.client_id = v_user_id
      and lower(coalesce(a.status::text, '')) = 'rescheduled'
      and a.scheduled_at < now()
      and lower(coalesce(t.payment_status::text, '')) = 'paid'
    returning t.appointment_id
  )
  select count(*) from converted;

  -- Return all converted rows.
  return query
  with converted_rows as (
    select a.id as appointment_id
    from public.appointments a
    join public.transactions t on t.appointment_id = a.id
    where a.client_id = v_user_id
      and lower(coalesce(a.status::text, '')) = 'rescheduled'
      and a.scheduled_at < now()
      and lower(coalesce(t.payment_status::text, '')) = 'forfeited'
  )
  select
    a.id,
    coalesce(a.title, 'Consultation') as title,
    coalesce(p.full_name, 'your attorney') as attorney_name,
    a.scheduled_at
  from converted_rows c
  join public.appointments a on a.id = c.appointment_id
  left join public.profiles p on p.id = a.attorney_id
  order by a.scheduled_at desc;
end;
$$;

revoke all on function public.mark_client_forfeited_rescheduled_payments() from public;
grant execute on function public.mark_client_forfeited_rescheduled_payments() to authenticated;

commit;
