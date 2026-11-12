begin;

create or replace function public.bb_bbook_adjust_liquidity(
  p_amount numeric,
  p_direction text,
  p_actor uuid,
  p_note text default null
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_pool public.bb_bbook_liquidity_pool%rowtype;
  v_after numeric;
begin
  if p_amount is null or p_amount<=0 or p_direction not in ('DEPOSIT','WITHDRAWAL') or p_actor is null then
    raise exception 'Invalid liquidity adjustment';
  end if;
  select * into v_pool from public.bb_bbook_liquidity_pool where singleton=true for update;
  if not found then raise exception 'Master liquidity pool is unavailable'; end if;
  if p_direction='DEPOSIT' then
    v_after:=v_pool.capital_balance+p_amount;
  else
    if v_pool.capital_balance-v_pool.reserved_payout<p_amount then
      raise exception 'Withdrawal exceeds unreserved liquidity capital';
    end if;
    v_after:=v_pool.capital_balance-p_amount;
  end if;
  update public.bb_bbook_liquidity_pool set capital_balance=v_after,updated_at=now() where singleton=true;
  insert into public.bb_bbook_liquidity_ledger(entry_type,direction,amount,balance_before,balance_after,
    reserved_before,reserved_after,actor_user_id,note)
  values(p_direction,case when p_direction='DEPOSIT' then 'CREDIT' else 'DEBIT' end,p_amount,
    v_pool.capital_balance,v_after,v_pool.reserved_payout,v_pool.reserved_payout,p_actor,left(coalesce(p_note,''),250));
  return jsonb_build_object('capital_balance',v_after,'reserved_payout',v_pool.reserved_payout,
    'available_liquidity',v_after-v_pool.reserved_payout);
end; $$;

revoke all on function public.bb_bbook_adjust_liquidity(numeric,text,uuid,text) from public,anon,authenticated;
grant execute on function public.bb_bbook_adjust_liquidity(numeric,text,uuid,text) to service_role;

create or replace function public.bb_bbook_close_position(p jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_user uuid := (p->>'user_id')::uuid;
  v_position_id uuid := (p->>'position_id')::uuid;
  v_exit numeric := (p->>'exit_price')::numeric;
  v_reason text := left(coalesce(p->>'reason','MANUAL CLOSE'),100);
  v_pos public.bb_bbook_positions%rowtype;
  v_acc public.trading_accounts%rowtype;
  v_pool public.bb_bbook_liquidity_pool%rowtype;
  v_gross numeric;
  v_net numeric;
  v_balance_after numeric;
  v_reserved_after numeric;
begin
  select * into v_pos from public.bb_bbook_positions where id=v_position_id and user_id=v_user and status='OPEN' for update;
  if not found or coalesce(v_exit,0)<=0 then raise exception 'Open B-Book position not found'; end if;
  select * into v_acc from public.trading_accounts where id=v_pos.account_id for update;
  select * into v_pool from public.bb_bbook_liquidity_pool where singleton=true for update;
  v_gross := (case when v_pos.side='BUY' then v_exit-v_pos.entry_price else v_pos.entry_price-v_exit end)*v_pos.quantity*v_pos.contract_size;
  -- Bid/Ask fills already include the spread; do not deduct the spread a second time.
  v_net := v_gross;
  v_balance_after := v_acc.balance + v_net;
  if v_balance_after < 0 then raise exception 'Close would create a negative client account balance'; end if;
  v_reserved_after := greatest(0,v_pool.reserved_payout-v_pos.reserved_payout);
  if v_pool.capital_balance-v_net-v_reserved_after < 0 then
    raise exception 'Insufficient unreserved house liquidity to settle this client profit';
  end if;
  update public.trading_accounts set balance=v_balance_after,updated_at=now() where id=v_pos.account_id;
  update public.bb_bbook_liquidity_pool set capital_balance=capital_balance-v_net,reserved_payout=v_reserved_after,
    total_client_profit=total_client_profit+greatest(v_net,0),total_client_loss=total_client_loss+greatest(-v_net,0),updated_at=now()
    where singleton=true;
  update public.bb_bbook_positions set mark_price=v_exit,bid_price=coalesce((p->>'bid')::numeric,v_exit),
    ask_price=coalesce((p->>'ask')::numeric,v_exit),floating_pnl=0,realized_pnl=v_net,status='CLOSED',
    close_reason=v_reason,closed_at=now() where id=v_position_id returning * into v_pos;
  if v_net<>0 then
    insert into public.bb_bbook_liquidity_ledger(entry_type,direction,amount,balance_before,balance_after,
      reserved_before,reserved_after,position_id,actor_user_id,note)
    values(case when v_net>0 then 'CLIENT_PROFIT' else 'CLIENT_LOSS' end,
      case when v_net>0 then 'DEBIT' else 'CREDIT' end,abs(v_net),v_pool.capital_balance,
      v_pool.capital_balance-v_net,v_pool.reserved_payout,v_reserved_after,v_position_id,v_user,v_reason);
  end if;
  insert into public.bb_trade_audit_events(account_id,user_id,event_type,account_mode,entity_type,entity_id,details)
  values(v_pos.account_id,v_user,'BBOOK_POSITION_CLOSED','real','bbook_position',v_position_id,
    jsonb_build_object('exit_price',v_exit,'realized_pnl',v_net,'reason',v_reason));
  return jsonb_build_object('position',to_jsonb(v_pos),'realized_pnl',v_net,'account_balance',v_balance_after,'execution_mode','BBOOK');
end; $$;

revoke all on function public.bb_bbook_close_position(jsonb) from public,anon,authenticated;
grant execute on function public.bb_bbook_close_position(jsonb) to service_role;
commit;