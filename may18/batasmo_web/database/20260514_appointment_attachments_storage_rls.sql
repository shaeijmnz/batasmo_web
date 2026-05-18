-- 20260514_appointment_attachments_storage_rls.sql
--
-- Clients upload consultation attachments to bucket "appointment-attachments"
-- under paths:  {client_uuid}/{timestamp}_{filename}
--
-- Without policies on storage.objects, Supabase rejects uploads with:
--   "new row violates row-level security policy"
--
-- Run once in Supabase SQL Editor (after the bucket exists).

begin;

-- Anyone can read public objects (matches a public bucket; attorneys open URLs directly).
drop policy if exists "appointment_attachments_public_read"
  on storage.objects;
create policy "appointment_attachments_public_read"
on storage.objects
for select
to public
using (bucket_id = 'appointment-attachments');

-- Logged-in clients may upload only into their own UUID folder prefix.
drop policy if exists "appointment_attachments_authenticated_insert"
  on storage.objects;
create policy "appointment_attachments_authenticated_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'appointment-attachments'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Optional: let the uploader update/delete their own files (replace/remove in UI).
drop policy if exists "appointment_attachments_authenticated_update"
  on storage.objects;
create policy "appointment_attachments_authenticated_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'appointment-attachments'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'appointment-attachments'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "appointment_attachments_authenticated_delete"
  on storage.objects;
create policy "appointment_attachments_authenticated_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'appointment-attachments'
  and (storage.foldername(name))[1] = auth.uid()::text
);

commit;
