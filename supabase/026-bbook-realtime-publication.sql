do $$
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='bb_bbook_quotes') then
      execute 'alter publication supabase_realtime add table public.bb_bbook_quotes';
    end if;
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='bb_bbook_positions') then
      execute 'alter publication supabase_realtime add table public.bb_bbook_positions';
    end if;
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='bb_bbook_liquidity_pool') then
      execute 'alter publication supabase_realtime add table public.bb_bbook_liquidity_pool';
    end if;
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='bb_bbook_liquidity_ledger') then
      execute 'alter publication supabase_realtime add table public.bb_bbook_liquidity_ledger';
    end if;
  end if;
end $$;