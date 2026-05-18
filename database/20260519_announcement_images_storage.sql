-- Announcement images for admin "Send Announcement" (public read, admin upload).
-- 1) Supabase Dashboard → Storage → New bucket: announcement-images (public)
-- 2) Run this script in SQL Editor.

begin;

drop policy if exists "announcement_images_public_read" on storage.objects;
create policy "announcement_images_public_read"
on storage.objects
for select
to public
using (bucket_id = 'announcement-images');

drop policy if exists "announcement_images_admin_insert" on storage.objects;
create policy "announcement_images_admin_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'announcement-images'
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and lower(trim(p.role)) = 'admin'
  )
);

drop policy if exists "announcement_images_admin_update" on storage.objects;
create policy "announcement_images_admin_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'announcement-images'
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and lower(trim(p.role)) = 'admin'
  )
)
with check (
  bucket_id = 'announcement-images'
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and lower(trim(p.role)) = 'admin'
  )
);

drop policy if exists "announcement_images_admin_delete" on storage.objects;
create policy "announcement_images_admin_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'announcement-images'
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and lower(trim(p.role)) = 'admin'
  )
);

commit;
