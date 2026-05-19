begin;

alter table public.profiles
  add column if not exists sex text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_sex_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_sex_check
      check (sex is null or sex in ('male', 'female', 'others'));
  end if;
end;
$$;

commit;
