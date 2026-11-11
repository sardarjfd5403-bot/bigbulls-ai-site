alter table public.bb_paper_execution_accounts drop constraint if exists bb_paper_execution_accounts_pkey;
alter table public.bb_paper_execution_accounts add column if not exists id uuid default gen_random_uuid();
update public.bb_paper_execution_accounts set id=gen_random_uuid() where id is null;
alter table public.bb_paper_execution_accounts alter column id set not null;
alter table public.bb_paper_execution_accounts add constraint bb_paper_execution_accounts_pkey primary key (id);
alter table public.bb_paper_execution_accounts alter column account_id drop not null;
alter table public.bb_paper_execution_accounts add constraint bb_paper_execution_accounts_user_mode_account_key
  unique nulls not distinct (user_id,account_mode,account_id);

alter table public.bb_paper_execution_trades alter column account_id drop not null;
alter table public.bb_paper_execution_trades add column if not exists paper_account_id uuid references public.bb_paper_execution_accounts(id) on delete cascade;
update public.bb_paper_execution_trades t set paper_account_id=a.id
from public.bb_paper_execution_accounts a where t.account_id=a.account_id and t.paper_account_id is null;
alter table public.bb_paper_execution_trades alter column paper_account_id set not null;
create index if not exists bb_paper_execution_trades_ledger_status_idx
  on public.bb_paper_execution_trades(paper_account_id,status,opened_at desc);

create or replace function public.bb_paper_open_position(p jsonb)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare
  v_account public.trading_accounts%rowtype;
  v_settings public.bb_execution_settings%rowtype;
  v_ledger public.bb_paper_execution_accounts%rowtype;
  v_user uuid := (p->>'user_id')::uuid;
  v_account_id uuid := nullif(p->>'account_id','')::uuid;
  v_paper_id uuid := (p->>'paper_account_id')::uuid;
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
  v_contract numeric; v_risk numeric; v_cost numeric;
  v_open_count integer; v_open_risk numeric;
  v_trade public.bb_paper_execution_trades%rowtype;
  v_today date := (now() at time zone 'utc')::date;
begin
  if v_user is null or v_paper_id is null or v_mode not in ('demo','real') then raise exception 'Invalid account context'; end if;
  if v_account_id is null and v_mode <> 'demo' then raise exception 'A linked Real account is required'; end if;
  if v_symbol not in ('EURUSD','GBPUSD','USDJPY','XAUUSD','BTCUSDT','ETHUSDT','BNBUSDT','SOLUSDT','XRPUSDT','DOGEUSDT') then raise exception 'Unsupported instrument'; end if;
  if v_side not in ('BUY','SELL') or coalesce(v_qty,0)<=0 or coalesce(v_price,0)<=0 or coalesce(v_sl,0)<=0 then raise exception 'Invalid order parameters'; end if;
  if (v_side='BUY' and v_sl>=v_price) or (v_side='SELL' and v_sl<=v_price) then raise exception 'Stop loss is on the wrong side of entry'; end if;
  if v_tp is not null and ((v_side='BUY' and v_tp<=v_price) or (v_side='SELL' and v_tp>=v_price)) then raise exception 'Take profit is on the wrong side of entry'; end if;

  if v_account_id is not null then
    select * into v_account from public.trading_accounts where id=v_account_id and user_id=v_user
      and account_mode=v_mode and status='approved' and archived_at is null and deleted_at is null for update;
    if not found then raise exception 'Approved trading account not found'; end if;
  end if;

  select * into v_settings from public.bb_execution_settings where singleton=true;
  if not found or v_settings.global_halt or not v_settings.paper_execution_enabled
     or (v_mode='demo' and not v_settings.demo_execution_enabled) then raise exception 'Paper execution is disabled by administrator'; end if;

  select * into v_ledger from public.bb_paper_execution_accounts
    where id=v_paper_id and user_id=v_user and account_mode=v_mode and account_id is not distinct from v_account_id for update;
  if not found then raise exception 'Paper ledger unavailable'; end if;
  if v_ledger.emergency_stop then raise exception 'Emergency stop is active'; end if;
  if v_ledger.current_day<>v_today then
    update public.bb_paper_execution_accounts set current_day=v_today,daily_realized=0,updated_at=now() where id=v_paper_id;
    v_ledger.daily_realized:=0;
  end if;

  v_contract:=case when v_symbol in ('EURUSD','GBPUSD','USDJPY') then 100000 when v_symbol='XAUUSD' then 100 else 1 end;
  v_risk:=abs(v_price-v_sl)*v_qty*v_contract; v_cost:=v_spread+v_commission+v_slippage;
  select count(*),coalesce(sum(risk_amount),0) into v_open_count,v_open_risk
    from public.bb_paper_execution_trades where paper_account_id=v_paper_id and status='OPEN';
  if v_open_count>=v_settings.max_open_positions then raise exception 'Maximum open positions reached'; end if;
  if v_risk>v_ledger.virtual_balance*v_settings.max_risk_per_trade_pct/100 then raise exception 'Trade exceeds per-trade risk limit'; end if;
  if v_open_risk+v_risk>v_ledger.virtual_balance*v_settings.max_aggregate_risk_pct/100 then raise exception 'Trade exceeds aggregate risk limit'; end if;
  if v_ledger.daily_realized<=-(v_ledger.starting_balance*v_settings.max_daily_loss_pct/100) then raise exception 'Daily loss limit reached'; end if;
  if v_ledger.virtual_balance<v_cost then raise exception 'Insufficient virtual balance for costs'; end if;

  insert into public.bb_paper_execution_trades(account_id,paper_account_id,user_id,account_mode,execution_mode,symbol,side,quantity,
    entry_price,mark_price,stop_loss,take_profit,spread_cost,commission,slippage,risk_amount,source)
  values(v_account_id,v_paper_id,v_user,v_mode,'PAPER',v_symbol,v_side,v_qty,v_price,v_price,v_sl,v_tp,
    v_spread,v_commission,v_slippage,v_risk,left(coalesce(p->>'source','MANUAL'),80)) returning * into v_trade;

  update public.bb_paper_execution_accounts set virtual_balance=virtual_balance-v_cost,daily_realized=daily_realized-v_cost,updated_at=now()
    where id=v_paper_id;
  insert into public.bb_trade_audit_events(account_id,user_id,event_type,account_mode,entity_type,entity_id,details)
  values(v_account_id,v_user,'PAPER_POSITION_OPENED',v_mode,'paper_trade',v_trade.id,
    jsonb_build_object('execution_mode','PAPER','symbol',v_symbol,'side',v_side,'quantity',v_qty,'fill_price',v_price));
  return jsonb_build_object('trade',to_jsonb(v_trade),'execution_mode','PAPER');
end; $$;

create or replace function public.bb_paper_close_position(p jsonb)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare
  v_user uuid := (p->>'user_id')::uuid;
  v_paper_id uuid := (p->>'paper_account_id')::uuid;
  v_trade_id uuid := (p->>'trade_id')::uuid;
  v_exit numeric := (p->>'exit_price')::numeric;
  v_spread numeric := coalesce(nullif(p->>'spread_cost','')::numeric,0);
  v_commission numeric := coalesce(nullif(p->>'commission','')::numeric,0);
  v_slippage numeric := coalesce(nullif(p->>'slippage','')::numeric,0);
  v_trade public.bb_paper_execution_trades%rowtype;
  v_contract numeric; v_gross numeric; v_net numeric; v_cost numeric;
begin
  if v_user is null or v_paper_id is null or v_trade_id is null or coalesce(v_exit,0)<=0 then raise exception 'Invalid close request'; end if;
  select * into v_trade from public.bb_paper_execution_trades where id=v_trade_id and paper_account_id=v_paper_id
    and user_id=v_user and status='OPEN' for update;
  if not found then raise exception 'Open paper position not found'; end if;
  perform 1 from public.bb_paper_execution_accounts where id=v_paper_id and user_id=v_user for update;
  if not found then raise exception 'Paper ledger not found'; end if;
  v_contract:=case when v_trade.symbol in ('EURUSD','GBPUSD','USDJPY') then 100000 when v_trade.symbol='XAUUSD' then 100 else 1 end;
  v_gross:=(case when v_trade.side='BUY' then v_exit-v_trade.entry_price else v_trade.entry_price-v_exit end)*v_trade.quantity*v_contract;
  v_cost:=v_spread+v_commission+v_slippage; v_net:=v_gross-v_cost;
  update public.bb_paper_execution_trades set mark_price=v_exit,exit_price=v_exit,spread_cost=spread_cost+v_spread,
    commission=commission+v_commission,slippage=slippage+v_slippage,realized_pnl=v_net,unrealized_pnl=0,
    status='CLOSED',close_reason=left(coalesce(p->>'reason','MANUAL CLOSE'),100),closed_at=now()
    where id=v_trade_id returning * into v_trade;
  update public.bb_paper_execution_accounts set virtual_balance=virtual_balance+v_gross-v_cost,daily_realized=daily_realized+v_net,updated_at=now()
    where id=v_paper_id;
  insert into public.bb_trade_audit_events(account_id,user_id,event_type,account_mode,entity_type,entity_id,details)
  values(v_trade.account_id,v_user,'PAPER_POSITION_CLOSED',v_trade.account_mode,'paper_trade',v_trade.id,
    jsonb_build_object('execution_mode','PAPER','exit_price',v_exit,'realized_pnl',v_net,'reason',coalesce(p->>'reason','MANUAL CLOSE')));
  return jsonb_build_object('trade',to_jsonb(v_trade),'execution_mode','PAPER');
end; $$;

revoke all on function public.bb_paper_open_position(jsonb) from public,anon,authenticated;
revoke all on function public.bb_paper_close_position(jsonb) from public,anon,authenticated;
grant execute on function public.bb_paper_open_position(jsonb) to service_role;
grant execute on function public.bb_paper_close_position(jsonb) to service_role;
