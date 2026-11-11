-- Publish demo account changes to authenticated Admin realtime subscribers.
do $$
begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='bb_paper_accounts') then
  alter publication supabase_realtime add table public.bb_paper_accounts;
 end if;
end $$;
