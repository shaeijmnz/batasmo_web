-- Clear ACTIVE consultation queue only (test / upcoming bookings).
-- KEEPS: status = 'completed' (admin reports, logs) + all transaction rows.
-- Run the ENTIRE script at once in Supabase SQL Editor (BatasMo project).

begin;

-- 1) Detach transactions for queue appointments only.
update public.transactions t
set appointment_id = null,
    updated_at = now()
where t.appointment_id in (
  select a.id
  from public.appointments a
  where a.status is distinct from 'completed'::appointment_status
);

-- 2) Remove chat for queue appointments only.
delete from public.messages m
where m.room_id in (
  select cr.id
  from public.consultation_rooms cr
  where cr.appointment_id in (
    select a.id
    from public.appointments a
    where a.status is distinct from 'completed'::appointment_status
  )
);

delete from public.consultation_rooms cr
where cr.appointment_id in (
  select a.id
  from public.appointments a
  where a.status is distinct from 'completed'::appointment_status
);

-- 3) Feedback for queue appointments (skip if table missing).
do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'consultation_feedback'
  ) then
    delete from public.consultation_feedback f
    where f.appointment_id in (
      select a.id
      from public.appointments a
      where a.status is distinct from 'completed'::appointment_status
    );
  end if;
end $$;

-- 4) Queue-related notifications.
delete from public.notifications
where lower(coalesce(type, '')) in (
  'booking', 'consultation', 'payment', 'reschedule', 'reminder',
  'appointment_booking', 'appointment_update', 'appointment_status'
)
   or body ilike '%[adminresched:%'
   or body ilike '%[admincxl:%'
   or body ilike '%[schreminder:%'
   or body ilike '%[noshow:%'
   or body ilike '%[admnoshow:%';

-- 5) Free slots before deleting appointments.
update public.availability_slots s
set is_booked = false,
    updated_at = now()
where s.id in (
  select distinct a.slot_id
  from public.appointments a
  where a.status is distinct from 'completed'::appointment_status
    and a.slot_id is not null
);

-- 6) Remove queue appointments (completed stay for reports).
delete from public.appointments a
where a.status is distinct from 'completed'::appointment_status;

commit;

-- Sanity (run separately after success):
-- select status, count(*) from public.appointments group by status;
-- select count(*) as completed_kept from public.appointments where status = 'completed';
