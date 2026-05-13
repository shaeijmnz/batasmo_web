-- 20260513_reset_consultation_queue.sql
-- Purpose: Hard reset ALL consultation records (testing helper).
-- Deletes: appointments + transactions + consultation chat (rooms & messages)
--          + consultation feedback + queue-related notifications.
-- Frees:   all availability_slots (is_booked = false).
-- Keeps:   profiles, attorney_profiles, notarial_requests, support_messages,
--          announcements/admin notifications that are not tied to appointments.
--
-- RUN ONCE in Supabase SQL editor when you want a fresh queue.
-- All statements are wrapped in a transaction so it's all-or-nothing.

begin;

-- 1) Chat messages inside each consultation room.
delete from public.messages
where room_id in (select id from public.consultation_rooms);

-- 2) Consultation rooms themselves.
delete from public.consultation_rooms;

-- 3) Feedback ratings tied to appointments (if the table exists).
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'consultation_feedback'
  ) then
    execute 'delete from public.consultation_feedback';
  end if;
end $$;

-- 4) Transactions tied to appointments (keep notarial transactions intact:
--    they have a NULL appointment_id).
delete from public.transactions
where appointment_id is not null;

-- 5) Queue-related notifications (booking/consultation/payment/reschedule/reminder).
delete from public.notifications
where lower(coalesce(type, '')) in (
  'booking', 'consultation', 'payment', 'reschedule', 'reminder'
)
   or body ilike '%[adminresched:%'
   or body ilike '%[admincxl:%'
   or body ilike '%[schreminder:%'
   or body ilike '%[noshow:%'
   or body ilike '%[admnoshow:%';

-- 6) Appointments themselves.
delete from public.appointments;

-- 7) Free up every availability slot so the time blocks can be rebooked.
update public.availability_slots
set is_booked = false,
    updated_at = now()
where is_booked = true;

commit;

-- Quick sanity check (run separately if you want to verify counts after the
-- transaction commits):
--   select count(*) as appointments_left from public.appointments;
--   select count(*) as txn_left from public.transactions where appointment_id is not null;
--   select count(*) as rooms_left from public.consultation_rooms;
--   select count(*) as booked_slots_left from public.availability_slots where is_booked = true;
