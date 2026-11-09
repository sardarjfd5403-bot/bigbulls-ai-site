-- BIGBULLS website-only trading account manager
-- Run once in Supabase Dashboard > SQL Editor.
-- IMPORTANT: These are website records only, NOT live MT5/broker accounts.

begin;

create sequence if not exists public.bigbulls_account_number_seq
  start with 567541 increment by 1 no cycle;

alter table public.trading_accounts
  add column if not exists account_mode text not null default 'real',
  add column if not exists account_number bigint,
  add column if not exists display_name text,
  add column if not exists server_name text,
  add column if not exists balance numeric(18,2) not null default 0,
  add column if not exists zero_balance_since timestamptz,
  add column if not exists archived_at timestamptz,
  add column if not exists deleted_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname='trading_accounts_mode_check') then
    alter table public.trading_accounts
      add constraint trading_accounts_mode_check check (account_mode in ('real','demo'));
  end if;
  if not exists (select 1 from pg_constraint where conname='trading_accounts_balance_nonnegative') then
    alter table public.trading_accounts
      add constraint trading_accounts_balance_nonnegative check (balance >= 0);
  end if;
end $$;

-- Give any pre-existing rows a unique number; new numbers start at 567541 and never recycle.
update public.trading_accounts
set account_number = nextval('public.bigbulls_account_number_seq')
where account_number is null;

update public.trading_accounts
set server_name = case when account_mode='demo' then 'BIGBULLS-Demo' else 'BIGBULLS-MT5Real' end
where server_name is null;

update public.trading_accounts
set zero_balance_since = created_at
where balance=0 and zero_balance_since is null;

select setval(
  'public.bigbulls_account_number_seq',
  greatest(567540, coalesce((select max(account_number) from public.trading_accounts),567540)),
  true
);

create or replace function public.bigbulls_account_defaults()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if new.account_number is null then
    new.account_number := nextval('public.bigbulls_account_number_seq');
  end if;
  new.server_name := case when new.account_mode='demo'
    then 'BIGBULLS-Demo' else 'BIGBULLS-MT5Real' end;

  if new.balance > 0 then
    new.zero_balance_since := null;
  elsif tg_op='INSERT' then
    new.zero_balance_since := coalesce(new.zero_balance_since, now());
  elsif old.balance > 0 and new.balance=0 then
    new.zero_balance_since := now();
  elsif old.balance=0 and new.balance=0 then
    new.zero_balance_since := coalesce(old.zero_balance_since, now());
  end if;
  return new;
end;
$$;

drop trigger if exists trg_bigbulls_account_defaults on public.trading_accounts;
create trigger trg_bigbulls_account_defaults
before insert or update of balance, account_mode
on public.trading_accounts
for each row execute function public.bigbulls_account_defaults();

-- Client creates a website account record. No password is collected or stored.
create or replace function public.create_client_trading_account(
  p_account_mode text,
  p_account_type text,
  p_currency text,
  p_display_name text
)
returns bigint
language plpgsql
security definer
set search_path=public
as $$
declare
  v_number bigint;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_account_mode not in ('real','demo') then raise exception 'Invalid account environment'; end if;
  if p_account_type not in ('Pro','Zero','Speed','Cent') then raise exception 'Invalid account type'; end if;
  if p_currency not in ('USD','EUR','GBP','JPY','USDT') then raise exception 'Unsupported currency'; end if;
  if length(trim(coalesce(p_display_name,''))) not between 1 and 40 then
    raise exception 'Account name must be 1-40 characters';
  end if;

  insert into public.trading_accounts
    (user_id, account_type, platform, currency, status, account_mode, display_name)
  values
    (auth.uid(), p_account_type, 'MT5', p_currency, 'approved', p_account_mode, trim(p_display_name))
  returning account_number into v_number;

  return v_number;
end;
$$;

-- Client actions are restricted to records owned by the signed-in user.
create or replace function public.manage_client_trading_account(
  p_account_id uuid,
  p_action text,
  p_display_name text default null
)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  if p_action='rename' then
    if length(trim(coalesce(p_display_name,''))) not between 1 and 40 then
      raise exception 'Account name must be 1-40 characters';
    end if;
    update public.trading_accounts
      set display_name=trim(p_display_name)
      where id=p_account_id and user_id=auth.uid()
        and archived_at is null and deleted_at is null;
  elsif p_action='archive' then
    update public.trading_accounts set archived_at=now()
      where id=p_account_id and user_id=auth.uid()
        and archived_at is null and deleted_at is null;
  elsif p_action='restore' then
    update public.trading_accounts
      set archived_at=null,
          zero_balance_since=case when balance=0 then now() else null end
      where id=p_account_id and user_id=auth.uid()
        and archived_at is not null and deleted_at is null;
  elsif p_action='delete' then
    update public.trading_accounts set deleted_at=now()
      where id=p_account_id and user_id=auth.uid() and deleted_at is null;
  else
    raise exception 'Unsupported account action';
  end if;

  if not found then raise exception 'Account not found or action not allowed'; end if;
end;
$$;

-- Archive only after 21 uninterrupted days at zero balance.
create or replace function public.archive_zero_balance_trading_accounts()
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  v_count integer;
begin
  update public.trading_accounts
    set archived_at=now()
    where archived_at is null and deleted_at is null
      and balance=0
      and zero_balance_since is not null
      and zero_balance_since <= now() - interval '21 days';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.create_client_trading_account(text,text,text,text) from public, anon;
revoke all on function public.manage_client_trading_account(uuid,text,text) from public, anon;
revoke all on function public.archive_zero_balance_trading_accounts() from public, anon;
grant execute on function public.create_client_trading_account(text,text,text,text) to authenticated;
grant execute on function public.manage_client_trading_account(uuid,text,text) to authenticated;
grant execute on function public.archive_zero_balance_trading_accounts() to authenticated;

-- Daily automatic archive job, where Supabase pg_cron is available.
do $$
begin
  if exists (select 1 from pg_extension where extname='pg_cron') then
    execute $job$
      select cron.schedule(
        'bigbulls-auto-archive-zero-balance',
        '15 0 * * *',
        'select public.archive_zero_balance_trading_accounts();'
      )
    $job$;
  else
    raise notice 'pg_cron is not enabled. Enable pg_cron in Supabase Database > Extensions, then schedule public.archive_zero_balance_trading_accounts() daily.';
  end if;
exception when others then
  raise notice 'Daily archive scheduling was not installed: %', sqlerrm;
end;
$$;

notify pgrst, 'reload schema';
commit;
