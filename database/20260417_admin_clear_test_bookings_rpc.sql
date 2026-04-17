-- 20260417_admin_clear_test_bookings_rpc.sql
-- Purpose: Allow Admin users to clear all consultation bookings for retesting.
-- Run in Supabase SQL Editor.

begin;

create or replace function public.admin_clear_test_bookings()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_deleted_appointments integer := 0;
  v_deleted_transactions integer := 0;
  v_deleted_feedback integer := 0;
  v_reset_slots integer := 0;
begin
  if v_user_id is null or not public.is_admin(v_user_id) then
    raise exception 'Only admin accounts can run admin_clear_test_bookings().';
  end if;

  -- Reset booked availability slots linked by slot_id.
  with appointment_slots as (
    select distinct slot_id
    from public.appointments
    where slot_id is not null
  ),
  reset_slot_rows as (
    update public.availability_slots s
    set is_booked = false,
        updated_at = now()
    where s.id in (select slot_id from appointment_slots)
    returning s.id
  )
  select count(*)::int into v_reset_slots
  from reset_slot_rows;

  -- Remove dependent rows first where needed.
  with deleted_tx as (
    delete from public.transactions t
    where t.appointment_id in (select id from public.appointments)
    returning t.id
  )
  select count(*)::int into v_deleted_transactions from deleted_tx;

  with deleted_feedback as (
    delete from public.consultation_feedback f
    where f.appointment_id in (select id from public.appointments)
    returning f.id
  )
  select count(*)::int into v_deleted_feedback from deleted_feedback;

  -- Delete appointments; consultation_rooms/messages are deleted by cascade.
  with deleted_appointments as (
    delete from public.appointments a
    returning a.id
  )
  select count(*)::int into v_deleted_appointments from deleted_appointments;

  -- Best effort: remove common consultation notifications used by this app flow.
  delete from public.notifications
  where type in ('consultation', 'appointment_booking', 'appointment_update', 'appointment_status');

  return jsonb_build_object(
    'ok', true,
    'deleted_appointments', v_deleted_appointments,
    'deleted_transactions', v_deleted_transactions,
    'deleted_feedback', v_deleted_feedback,
    'reset_slots', v_reset_slots
  );
end;
$$;

revoke all on function public.admin_clear_test_bookings() from public;
grant execute on function public.admin_clear_test_bookings() to authenticated;

commit;
