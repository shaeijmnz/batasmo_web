-- Clear consultation queue (appointments + chat) but KEEP transaction rows.
-- Run once in Supabase SQL Editor (BatasMo project, not auth-lab).
--
-- After this:
--   - Attorney/client "Consultation Queue" dashboards are empty
--   - Transaction History still shows past payments (appointment_id set to NULL)

begin;

-- Detach transactions so appointments can be removed without FK errors.
update public.transactions
set appointment_id = null,
    updated_at = now()
where appointment_id is not null;

delete from public.messages
where room_id in (select id from public.consultation_rooms);

delete from public.consultation_rooms;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'consultation_feedback'
  ) then
    execute 'delete from public.consultation_feedback';
  end if;
end $$;

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

delete from public.appointments;

update public.availability_slots
set is_booked = false,
    updated_at = now()
where is_booked = true;

commit;

-- Sanity (run separately):
-- select count(*) from public.appointments;
-- select count(*) from public.transactions;
-- select count(*) from public.transactions where appointment_id is not null;
