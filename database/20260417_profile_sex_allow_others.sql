-- Run this if you already applied `20260417_add_profile_sex_column.sql` with only male/female.
-- It replaces the check constraint so `others` is allowed.

begin;

alter table public.profiles drop constraint if exists profiles_sex_check;

alter table public.profiles
  add constraint profiles_sex_check
  check (sex is null or sex in ('male', 'female', 'others'));

commit;
