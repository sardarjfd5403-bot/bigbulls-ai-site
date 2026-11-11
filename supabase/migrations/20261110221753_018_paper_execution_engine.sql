alter table public.bb_execution_settings
  add column if not exists paper_execution_enabled boolean not null default true;

create table if not exists public.bb_paper_execution_accounts (
  account_id uuid primary key references public.trading_accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  account_mode text not null check (account_mode in ('demo','real')),
  starting_balance numeric(20,2) not null default 10000 check (starting_balance > 0),
  virtual_balance numeric(20,2) not null default 10000 check (virtual_balance >= 0),
  daily_realized numeric(20,2) not null default 0,
  current_day date not null default (now() at time zone 'utc')::date,
  emergency_stop boolean not null default false,
  auto_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists bb_paper_execution_accounts_user_idx
  on public.bb_paper_execution_accounts(user_id, account_mode);

create table if not exists public.bb_paper_execution_trades (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.trading_accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  account_mode text not null check (account_mode in ('demo','real')),
  execution_mode text not null default 'PAPER' check (execution_mode = 'PAPER'),
  symbol text not null,
  side text not null check (side in ('BUY','SELL')),
  quantity numeric(20,8) not null check (quantity > 0),
  entry_price numeric(24,10) not null check (entry_price > 0),
  mark_price numeric(24,10),
  exit_price numeric(24,10),
  stop_loss numeric(24,10) not null check (stop_loss > 0),
  take_profit numeric(24,10),
  spread_cost numeric(20,8) not null default 0,
  commission numeric(20,8) not null default 0,
  slippage numeric(20,8) not null default 0,
  risk_amount numeric(20,8) not null default 0,
  unrealized_pnl numeric(20,8) not null default 0,
  realized_pnl numeric(20,8) not null default 0,
  status text not null default 'OPEN' check (status in ('OPEN','CLOSED')),
  source text not null default 'MANUAL',
  close_reason text,
  opened_at timestamptz not null default now(),
  closed_at timestamptz
);
create index if not exists bb_paper_execution_trades_account_status_idx
  on public.bb_paper_execution_trades(account_id,status,opened_at desc);
create index if not exists bb_paper_execution_trades_user_idx
  on public.bb_paper_execution_trades(user_id,opened_at desc);

alter table public.bb_paper_execution_accounts enable row level security;
alter table public.bb_paper_execution_trades enable row level security;

drop policy if exists "paper execution account owner read" on public.bb_paper_execution_accounts;
create policy "paper execution account owner read"
  on public.bb_paper_execution_accounts for select to authenticated
  using (user_id = (select auth.uid()) or (select is_bigbulls_admin()));

drop policy if exists "paper execution trades owner read" on public.bb_paper_execution_trades;
create policy "paper execution trades owner read"
  on public.bb_paper_execution_trades for select to authenticated
  using (user_id = (select auth.uid()) or (select is_bigbulls_admin()));

revoke all on public.bb_paper_execution_accounts from anon, authenticated;
revoke all on public.bb_paper_execution_trades from anon, authenticated;
grant select on public.bb_paper_execution_accounts to authenticated;
grant select on public.bb_paper_execution_trades to authenticated;

create or replace function public.bb_paper_open_position(p jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_account public.trading_accounts%rowtype;
  v_settings public.bb_execution_settings%rowtype;
  v_ledger public.bb_paper_execution_accounts%rowtype;
  v_user uuid := (p->>'user_id')::uuid;
  v_account_id uuid := (p->>'account_id')::uuid;
  v_mode text := p->>'account_mode';
  v_symbol text := upper(replace(p->>'symbol','/',''));
  v_side text := p->>'side';
  v_qty numeric := (p->>'quantity')::numeric;
  v_price numeric := (p->>'fill_price')::numeric;
  v_sl numeric := (p->>'stop_loss')::numeric;
  v_tp numeric := nullif(p->>'take_profit','')::numeric;
  v_spread numeric := coalesce(nullif(p->>'spread_cost','')::numeric,0);
  v_commission numeric := coalesce(nullif(p->>'commission','')::numeric,0);
  v_slippage numeric := coalesce(nullif(p->>'slippage','')::numeric,0);
  v_contract numeric;
  v_risk numeric;
  v_cost numeric;
  v_open_count integer;
  v_open_risk numeric;
  v_trade public.bb_paper_execution_trades%rowtype;
  v_today date := (now() at time zone 'utc')::date;
begin
  if v_user is null or v_account_id is null or v_mode not in ('demo','real') then
    raise exception 'Invalid account context';
  end if;
  if v_symbol not in ('EURUSD','GBPUSD','USDJPY','XAUUSD','BTCUSDT','ETHUSDT','BNBUSDT','SOLUSDT','XRPUSDT','DOGEUSDT') then
    raise exception 'Unsupported instrument';
  end if;
  if v_side not in ('BUY','SELL') or v_qty <= 0 or v_price <= 0 or v_sl <= 0 then
    raise exception 'Invalid order parameters';
  end if;
  if (v_side='BUY' and v_sl >= v_price) or (v_side='SELL' and v_sl <= v_price) then
    raise exception 'Stop loss is on the wrong side of the entry';
  end if;
  if v_tp is not null and ((v_side='BUY' and v_tp <= v_price) or (v_side='SELL' and v_tp >= v_price)) then
    raise exception 'Take profit is on the wrong side of the entry';
  end if;

  select * into v_account from public.trading_accounts
    where id=v_account_id and user_id=v_user and account_mode=v_mode
      and status='approved' and archived_at is null and deleted_at is null
    for update;
  if not found then raise exception 'Approved account not found'; end if;

  select * into v_settings from public.bb_execution_settings where singleton=true;
  if not found or v_settings.global_halt or not v_settings.paper_execution_enabled
     or (v_mode='demo' and not v_settings.demo_execution_enabled) then
    raise exception 'Paper execution is currently disabled by the administrator';
  end if;

  insert into public.bb_paper_execution_accounts(account_id,user_id,account_mode)
    values(v_account_id,v_user,v_mode)
    on conflict(account_id) do nothing;
  select * into v_ledger from public.bb_paper_execution_accounts
    where account_id=v_account_id and user_id=v_user and account_mode=v_mode
    for update;
  if not found then raise exception 'Paper ledger unavailable'; end if;
  if v_ledger.current_day <> v_today then
    update public.bb_paper_execution_accounts
      set current_day=v_today,daily_realized=0,updated_at=now()
      where account_id=v_account_id;
    v_ledger.daily_realized := 0;
  end if;
  if v_ledger.emergency_stop then raise exception 'Emergency stop is active'; end if;

  v_contract := case
    when v_symbol in ('EURUSD','GBPUSD','USDJPY') then 100000
    when v_symbol='XAUUSD' then 100
    else 1
  end;
  v_risk := abs(v_price-v_sl)*v_qty*v_contract;
  v_cost := v_spread+v_commission+v_slippage;
  select count(*),coalesce(sum(risk_amount),0)
    into v_open_count,v_open_risk
    from public.bb_paper_execution_trades
    where account_id=v_account_id and status='OPEN';
  if v_open_count >= v_settings.max_open_positions then raise exception 'Maximum open positions reached'; end if;
  if v_risk > v_ledger.virtual_balance*v_settings.max_risk_per_trade_pct/100 then
    raise exception 'Trade exceeds per-trade risk limit';
  end if;
  if v_open_risk+v_risk > v_ledger.virtual_balance*v_settings.max_aggregate_risk_pct/100 then
    raise exception 'Trade exceeds aggregate risk limit';
  end if;
  if v_ledger.daily_realized <= -(v_ledger.starting_balance*v_settings.max_daily_loss_pct/100) then
    raise exception 'Daily loss limit reached';
  end if;
  if v_ledger.virtual_balance < v_cost then raise exception 'Insufficient virtual balance for execution costs'; end if;

  insert into public.bb_paper_execution_trades(
    account_id,user_id,account_mode,execution_mode,symbol,side,quantity,
    entry_price,mark_price,stop_loss,take_profit,spread_cost,commission,
    slippage,risk_amount,source
  ) values (
    v_account_id,v_user,v_mode,'PAPER',v_symbol,v_side,v_qty,
    v_price,v_price,v_sl,v_tp,v_spread,v_commission,v_slippage,v_risk,
    left(coalesce(p->>'source','MANUAL'),80)
  ) returning * into v_trade;

  update public.bb_paper_execution_accounts
    set virtual_balance=virtual_balance-v_cost,
        daily_realized=daily_realized-v_cost,
        updated_at=now()
    where account_id=v_account_id;

  insert into public.bb_trade_audit_events(
    account_id,user_id,event_type,account_mode,entity_type,entity_id,details
  ) values (
    v_account_id,v_user,'PAPER_POSITION_OPENED',v_mode,'paper_trade',v_trade.id,
    jsonb_build_object('execution_mode','PAPER','symbol',v_symbol,'side',v_side,'quantity',v_qty,'fill_price',v_price)
  );
  return jsonb_build_object('trade',to_jsonb(v_trade),'execution_mode','PAPER');
end;
$$;

create or replace function public.bb_paper_close_position(p jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user uuid := (p->>'user_id')::uuid;
  v_account_id uuid := (p->>'account_id')::uuid;
  v_trade_id uuid := (p->>'trade_id')::uuid;
  v_exit numeric := (p->>'exit_price')::numeric;
  v_spread numeric := coalesce(nullif(p->>'spread_cost','')::numeric,0);
  v_commission numeric := coalesce(nullif(p->>'commission','')::numeric,0);
  v_slippage numeric := coalesce(nullif(p->>'slippage','')::numeric,0);
  v_trade public.bb_paper_execution_trades%rowtype;
  v_ledger public.bb_paper_execution_accounts%rowtype;
  v_contract numeric;
  v_gross numeric;
  v_net numeric;
  v_cost numeric;
begin
  if v_user is null or v_account_id is null or v_trade_id is null or v_exit <= 0 then
    raise exception 'Invalid close request';
  end if;
  select * into v_trade from public.bb_paper_execution_trades
    where id=v_trade_id and account_id=v_account_id and user_id=v_user and status='OPEN'
    for update;
  if not found then raise exception 'Open paper position not found'; end if;
  select * into v_ledger from public.bb_paper_execution_accounts
    where account_id=v_account_id and user_id=v_user for update;
  if not found then raise exception 'Paper ledger not found'; end if;
  v_contract := case
    when v_trade.symbol in ('EURUSD','GBPUSD','USDJPY') then 100000
    when v_trade.symbol='XAUUSD' then 100
    else 1
  end;
  v_gross := (case when v_trade.side='BUY' then v_exit-v_trade.entry_price else v_trade.entry_price-v_exit end)*v_trade.quantity*v_contract;
  v_cost := v_spread+v_commission+v_slippage;
  v_net := v_gross-v_cost;
  update public.bb_paper_execution_trades
    set mark_price=v_exit,exit_price=v_exit,spread_cost=spread_cost+v_spread,
        commission=commission+v_commission,slippage=slippage+v_slippage,
        realized_pnl=v_net,unrealized_pnl=0,status='CLOSED',
        close_reason=left(coalesce(p->>'reason','MANUAL CLOSE'),100),
        closed_at=now()
    where id=v_trade_id returning * into v_trade;
  update public.bb_paper_execution_accounts
    set virtual_balance=virtual_balance+v_gross-v_cost,
        daily_realized=daily_realized+v_net,updated_at=now()
    where account_id=v_account_id;
  insert into public.bb_trade_audit_events(
    account_id,user_id,event_type,account_mode,entity_type,entity_id,details
  ) values (
    v_account_id,v_user,'PAPER_POSITION_CLOSED',v_trade.account_mode,'paper_trade',v_trade.id,
    jsonb_build_object('execution_mode','PAPER','exit_price',v_exit,'realized_pnl',v_net,'reason',coalesce(p->>'reason','MANUAL CLOSE'))
  );
  return jsonb_build_object('trade',to_jsonb(v_trade),'execution_mode','PAPER');
end;
$$;

revoke all on function public.bb_paper_open_position(jsonb) from public, anon, authenticated;
revoke all on function public.bb_paper_close_position(jsonb) from public, anon, authenticated;
grant execute on function public.bb_paper_open_position(jsonb) to service_role;
grant execute on function public.bb_paper_close_position(jsonb) to service_role;
