-- 20260410_transactions_backfill_and_client_rls.sql
-- Purpose:
-- 1) Backfill legacy transactions.client_id/attorney_id from linked appointments/notarial requests.
-- 2) Ensure clients can read their own historical transactions.
-- Safe to run multiple times.

begin;

alter table public.transactions enable row level security;

-- Backfill using appointment links.
update public.transactions t
set
  client_id = coalesce(t.client_id, a.client_id),
  attorney_id = coalesce(t.attorney_id, a.attorney_id),
  updated_at = now()
from public.appointments a
where t.appointment_id = a.id
  and (t.client_id is null or t.attorney_id is null);

-- Backfill using notarial links when the column exists.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'transactions'
      and column_name = 'notarial_request_id'
  ) then
    execute $sql$
      update public.transactions t
      set
        client_id = coalesce(t.client_id, nr.client_id),
        attorney_id = coalesce(t.attorney_id, nr.attorney_id),
        updated_at = now()
      from public.notarial_requests nr
      where t.notarial_request_id = nr.id
        and (t.client_id is null or t.attorney_id is null)
    $sql$;
  end if;
end $$;

-- Client and attorney access policies for transactions.
drop policy if exists transactions_client_select on public.transactions;
create policy transactions_client_select
on public.transactions
for select
using (
  auth.uid() = client_id
  or exists (
    select 1
    from public.appointments a
    where a.id = transactions.appointment_id
      and a.client_id = auth.uid()
  )
);

drop policy if exists transactions_client_select_notarial on public.transactions;
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'transactions'
      and column_name = 'notarial_request_id'
  ) then
    execute $sql$
      create policy transactions_client_select_notarial
      on public.transactions
      for select
      using (
        exists (
          select 1
          from public.notarial_requests nr
          where nr.id = transactions.notarial_request_id
            and nr.client_id = auth.uid()
        )
      )
    $sql$;
  end if;
end $$;

drop policy if exists transactions_attorney_select on public.transactions;
create policy transactions_attorney_select
on public.transactions
for select
using (
  auth.uid() = attorney_id
  or exists (
    select 1
    from public.appointments a
    where a.id = transactions.appointment_id
      and a.attorney_id = auth.uid()
  )
);

drop policy if exists transactions_client_insert on public.transactions;
create policy transactions_client_insert
on public.transactions
for insert
with check (auth.uid() = client_id);

drop policy if exists transactions_client_update on public.transactions;
create policy transactions_client_update
on public.transactions
for update
using (auth.uid() = client_id)
with check (auth.uid() = client_id);

commit;
