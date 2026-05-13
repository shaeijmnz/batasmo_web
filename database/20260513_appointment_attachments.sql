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
-- 2) Storage bucket RLS: Supabase still requires policies on storage.objects
--    for uploads. Without them, uploads fail with "new row violates row-level
--    security policy". Run AFTER creating the bucket:
--      database/20260514_appointment_attachments_storage_rls.sql
