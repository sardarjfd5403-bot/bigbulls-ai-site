do $block$
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='client_wallet_accounts') then
      alter publication supabase_realtime add table public.client_wallet_accounts;
    end if;
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='client_fund_transfers') then
      alter publication supabase_realtime add table public.client_fund_transfers;
    end if;
  end if;
end
$block$;