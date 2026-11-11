-- Admin monitoring for the MT5-style simulated trading accounts.
begin;
create index if not exists bb_paper_accounts_updated_at_idx on public.bb_paper_accounts(updated_at desc);
drop policy if exists "paper accounts admin read" on public.bb_paper_accounts;
create policy "paper accounts admin read" on public.bb_paper_accounts
 for select to authenticated using ((select public.is_bigbulls_admin()));
grant select on public.bb_paper_accounts to authenticated;
commit;
