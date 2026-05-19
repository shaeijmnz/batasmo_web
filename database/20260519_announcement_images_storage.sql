-- Announcement images for admin "Send Announcement"
-- BEFORE running: Storage → New bucket → name: announcement-images → Public bucket ON
-- Then paste this entire file in Supabase SQL Editor → Run

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
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'Admin'::user_role
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
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'Admin'::user_role
  )
)
with check (
  bucket_id = 'announcement-images'
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'Admin'::user_role
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
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'Admin'::user_role
  )
);

commit;
