-- Persisted B-Book positions may close only for explicit manual actions or server risk exits.
create or replace function public.bb_bbook_close_position(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_user uuid := (p->>'user_id')::uuid;
  v_position_id uuid := (p->>'position_id')::uuid;
  v_exit numeric := (p->>'exit_price')::numeric;
  v_conversion numeric := nullif(p->>'conversion_rate','')::numeric;
  v_reason text := left(coalesce(p->>'reason','MANUAL CLOSE'),100);
  v_pos public.bb_bbook_positions%rowtype;
  v_acc public.trading_accounts%rowtype;
  v_pool public.bb_bbook_liquidity_pool%rowtype;
  v_gross numeric;
  v_net numeric;
  v_balance_after numeric;
  v_reserved_after numeric;
begin
  if upper(trim(v_reason)) not in (
    'MANUAL CLOSE',
    'CLOSED MANUALLY',
    'CLOSED ALL POSITIONS',
    'STOP LOSS',
    'TAKE PROFIT',
    'MARGIN STOP OUT',
    'STOP LOSS · SERVER RISK WORKER',
    'TAKE PROFIT · SERVER RISK WORKER',
    'MARGIN STOP OUT · SERVER RISK WORKER'
  ) then
    raise exception 'Position close rejected: only manual close, Stop Loss, Take Profit, or margin stop-out are permitted.';
  end if;

  select * into v_pos from public.bb_bbook_positions
    where id=v_position_id and user_id=v_user and status='OPEN' for update;
  if not found or coalesce(v_exit,0)<=0 then raise exception 'Open B-Book position not found'; end if;
  select * into v_acc from public.trading_accounts where id=v_pos.account_id for update;
  select * into v_pool from public.bb_bbook_liquidity_pool where singleton=true for update;
  v_gross:=(case when v_pos.side='BUY' then v_exit-v_pos.entry_price else v_pos.entry_price-v_exit end)*v_pos.quantity*v_pos.contract_size;
  if right(v_pos.symbol,3)='JPY' then
    if left(v_pos.symbol,3)='USD' then
      v_gross:=v_gross/v_exit;
    else
      if coalesce(v_conversion,0)<=0 then raise exception 'USDJPY conversion quote is required to close this JPY cross'; end if;
      v_gross:=v_gross/v_conversion;
    end if;
  elsif v_pos.symbol in ('USDCAD','USDCHF') then
    v_gross:=v_gross/v_exit;
  elsif v_pos.symbol='EURGBP' then
    if coalesce(v_conversion,0)<=0 then raise exception 'GBPUSD conversion quote is required to close EURGBP'; end if;
    v_gross:=v_gross*v_conversion;
  end if;
  v_net:=v_gross;
  v_balance_after:=round(v_acc.balance+v_net,2);
  if v_balance_after<0 then raise exception 'Close would create a negative client account balance'; end if;
  v_reserved_after:=greatest(0,v_pool.reserved_payout-v_pos.reserved_payout);
  if v_pool.capital_balance-v_net-v_reserved_after<0 then raise exception 'Insufficient unreserved house liquidity to settle this client profit'; end if;
  update public.trading_accounts set balance=v_balance_after,updated_at=now() where id=v_pos.account_id;
  if v_net<>0 then
    insert into public.account_balance_ledger(account_id,user_id,transaction_id,actor_user_id,entry_type,amount,balance_before,balance_after,note)
    values(v_pos.account_id,v_user,null,v_user,case when v_net>0 then 'trade_profit' else 'trade_loss' end,abs(v_net),v_acc.balance,v_balance_after,
      'B-Book realized P/L · '||v_pos.symbol||' '||v_pos.side||' · position '||v_position_id::text);
  end if;
  update public.bb_bbook_liquidity_pool
    set capital_balance=capital_balance-v_net,
        reserved_payout=v_reserved_after,
        total_client_profit=total_client_profit+greatest(v_net,0),
        total_client_loss=total_client_loss+greatest(-v_net,0),
        updated_at=now()
    where singleton=true;
  update public.bb_bbook_positions
    set mark_price=v_exit,bid_price=coalesce((p->>'bid')::numeric,v_exit),
        ask_price=coalesce((p->>'ask')::numeric,v_exit),floating_pnl=0,
        realized_pnl=v_net,status='CLOSED',close_reason=v_reason,closed_at=now()
    where id=v_position_id returning * into v_pos;
  if v_net<>0 then
    insert into public.bb_bbook_liquidity_ledger(
      entry_type,direction,amount,balance_before,balance_after,reserved_before,reserved_after,
      position_id,actor_user_id,note
    ) values(
      case when v_net>0 then 'CLIENT_PROFIT' else 'CLIENT_LOSS' end,
      case when v_net>0 then 'DEBIT' else 'CREDIT' end,
      abs(v_net),v_pool.capital_balance,v_pool.capital_balance-v_net,
      v_pool.reserved_payout,v_reserved_after,v_position_id,v_user,v_reason
    );
  end if;
  insert into public.bb_trade_audit_events(account_id,user_id,event_type,account_mode,entity_type,entity_id,details)
  values(v_pos.account_id,v_user,'BBOOK_POSITION_CLOSED','real','bbook_position',v_position_id,
    jsonb_build_object('exit_price',v_exit,'realized_pnl',v_net,'reason',v_reason,'conversion_rate',v_conversion));
  return jsonb_build_object('position',to_jsonb(v_pos),'realized_pnl',v_net,
    'account_balance',v_balance_after,'execution_mode','BBOOK');
end;
$function$;
