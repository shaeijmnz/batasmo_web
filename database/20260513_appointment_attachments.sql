-- 20260513_appointment_attachments.sql
-- Purpose: Let clients attach a single file (PDF/image/doc) when booking a
-- consultation. Attorneys can then view it from their consultation queue.
--
-- Run once in Supabase SQL editor.

begin;

alter table public.appointments
  add column if not exists attachment_url text,
  add column if not exists attachment_name text;

commit;

-- Storage bucket setup (run separately if not yet created):
--
-- 1) In Supabase Dashboard → Storage → Create a new bucket named
--    "appointment-attachments" and set it to PUBLIC (so signed URLs are not
--    required). Or keep it private and the app will store the path.
--
-- 2) Optional RLS for stricter control. If you keep it public, no policies
--    are required. The web client uploads with the anon key and we save the
--    public URL into appointments.attachment_url.
