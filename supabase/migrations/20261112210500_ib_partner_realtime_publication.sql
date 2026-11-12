do $$
declare
  t text;
begin
  foreach t in array array[
    'partner_referrals',
    'partner_commission_ledger',
    'partner_wallet_accounts',
    'partner_wallet_ledger',
    'partner_payout_requests',
    'partner_wallet_transfers'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname='supabase_realtime' and schemaname='public' and tablename=t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;