-- 20260417_reset_consultation_bookings.sql
-- Purpose: Clear all consultation bookings for clean end-to-end retesting.
-- Run in Supabase SQL Editor with an account that has write permissions.

begin;

-- Keep list of appointments to remove.
with target_appointments as (
  select id
  from public.appointments
),
-- Unbook all slot rows referenced by appointments before deleting appointments.
unbooked_slots as (
  update public.availability_slots s
  set is_booked = false,
      updated_at = now()
  where exists (
    select 1
    from public.appointments a
    where a.id in (select id from target_appointments)
      and a.attorney_id = s.attorney_id
      and (
        (a.slot_date is not null and a.slot_time is not null and s.date = a.slot_date and s.time = a.slot_time)
        or
        (a.slot_date is null and a.slot_time is null and s.start_time = a.scheduled_at)
      )
  )
  returning s.id
),
deleted_feedback as (
  delete from public.consultation_feedback f
  where f.appointment_id in (select id from target_appointments)
  returning f.id
),
deleted_transactions as (
  delete from public.transactions t
  where t.appointment_id in (select id from target_appointments)
  returning t.id
),
deleted_notifications as (
  delete from public.notifications n
  where n.type in ('appointment_booking', 'appointment_update', 'appointment_status')
  returning n.id
)
delete from public.appointments a
where a.id in (select id from target_appointments);

commit;

-- Notes:
-- 1) consultation_rooms and messages are removed automatically by cascade from appointments.
-- 2) If you also want to clear notarial requests, do that separately.
