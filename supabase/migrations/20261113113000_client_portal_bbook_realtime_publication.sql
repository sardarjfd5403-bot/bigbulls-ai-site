do $$
declare t text;
begin
 foreach t in array array['trading_accounts','wallet_transactions','account_balance_ledger','bb_bbook_positions','bb_bbook_pending_orders','bb_bbook_quotes','bb_paper_execution_accounts','bb_paper_execution_trades','client_wallet_accounts','client_notifications','bb_market_signal_feed','kyc_submissions'] loop
  if to_regclass('public.'||t) is not null and exists(select 1 from pg_publication where pubname='supabase_realtime')
   and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
   execute format('alter publication supabase_realtime add table public.%I',t);
  end if;
 end loop;
end $$;