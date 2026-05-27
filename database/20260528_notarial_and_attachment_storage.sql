-- Creates Supabase Storage buckets required for:
--   • notarial document uploads (standalone + bundled booking)
--   • consultation appointment attachments
--
-- Run once in Supabase Dashboard → SQL Editor.

begin;

insert into storage.buckets (id, name, public)
values
  ('notarial-documents', 'notarial-documents', true),
  ('appointment-attachments', 'appointment-attachments', true)
on conflict (id) do update
set public = excluded.public;

-- ── notarial-documents ───────────────────────────────────────────────────────

drop policy if exists "notarial_documents_public_read" on storage.objects;
create policy "notarial_documents_public_read"
on storage.objects
for select
to public
using (bucket_id = 'notarial-documents');

drop policy if exists "notarial_documents_authenticated_insert" on storage.objects;
create policy "notarial_documents_authenticated_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'notarial-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "notarial_documents_authenticated_update" on storage.objects;
create policy "notarial_documents_authenticated_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'notarial-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'notarial-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "notarial_documents_authenticated_delete" on storage.objects;
create policy "notarial_documents_authenticated_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'notarial-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- ── appointment-attachments (idempotent with 20260514 script) ────────────────

drop policy if exists "appointment_attachments_public_read" on storage.objects;
create policy "appointment_attachments_public_read"
on storage.objects
for select
to public
using (bucket_id = 'appointment-attachments');

drop policy if exists "appointment_attachments_authenticated_insert" on storage.objects;
create policy "appointment_attachments_authenticated_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'appointment-attachments'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "appointment_attachments_authenticated_update" on storage.objects;
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

drop policy if exists "appointment_attachments_authenticated_delete" on storage.objects;
create policy "appointment_attachments_authenticated_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'appointment-attachments'
  and (storage.foldername(name))[1] = auth.uid()::text
);

commit;
