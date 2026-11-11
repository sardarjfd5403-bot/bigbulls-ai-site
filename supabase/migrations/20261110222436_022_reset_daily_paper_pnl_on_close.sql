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
  v_ledger public.bb_paper_execution_accounts%rowtype;
  v_contract numeric; v_gross numeric; v_net numeric; v_cost numeric;
  v_today date := (now() at time zone 'utc')::date;
begin
  if v_user is null or v_paper_id is null or v_trade_id is null or coalesce(v_exit,0)<=0 then raise exception 'Invalid close request'; end if;
  select * into v_trade from public.bb_paper_execution_trades where id=v_trade_id and paper_account_id=v_paper_id
    and user_id=v_user and status='OPEN' for update;
  if not found then raise exception 'Open paper position not found'; end if;
  select * into v_ledger from public.bb_paper_execution_accounts where id=v_paper_id and user_id=v_user for update;
  if not found then raise exception 'Paper ledger not found'; end if;
  if v_ledger.current_day<>v_today then
    update public.bb_paper_execution_accounts set current_day=v_today,daily_realized=0,updated_at=now() where id=v_paper_id;
  end if;
  v_contract:=case when v_trade.symbol in ('EURUSD','GBPUSD','USDJPY') then 100000 when v_trade.symbol='XAUUSD' then 100 else 1 end;
  v_gross:=(case when v_trade.side='BUY' then v_exit-v_trade.entry_price else v_trade.entry_price-v_exit end)*v_trade.quantity*v_contract;
  v_cost:=v_spread+v_commission+v_slippage; v_net:=v_gross-v_cost;
  update public.bb_paper_execution_trades set mark_price=v_exit,exit_price=v_exit,spread_cost=spread_cost+v_spread,
    commission=commission+v_commission,slippage=slippage+v_slippage,realized_pnl=v_net,unrealized_pnl=0,
    status='CLOSED',close_reason=left(coalesce(p->>'reason','MANUAL CLOSE'),100),closed_at=now()
    where id=v_trade_id returning * into v_trade;
  update public.bb_paper_execution_accounts set virtual_balance=virtual_balance+v_gross-v_cost,
    daily_realized=(case when current_day=v_today then daily_realized else 0 end)+v_net, current_day=v_today,updated_at=now()
    where id=v_paper_id;
  insert into public.bb_trade_audit_events(account_id,user_id,event_type,account_mode,entity_type,entity_id,details)
  values(v_trade.account_id,v_user,'PAPER_POSITION_CLOSED',v_trade.account_mode,'paper_trade',v_trade.id,
    jsonb_build_object('execution_mode','PAPER','exit_price',v_exit,'realized_pnl',v_net,'reason',coalesce(p->>'reason','MANUAL CLOSE')));
  return jsonb_build_object('trade',to_jsonb(v_trade),'execution_mode','PAPER');
end; $$;
revoke all on function public.bb_paper_close_position(jsonb) from public,anon,authenticated;
grant execute on function public.bb_paper_close_position(jsonb) to service_role;
