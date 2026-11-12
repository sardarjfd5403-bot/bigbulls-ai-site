create or replace function public.bb_bbook_open_position(p jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_user uuid := (p->>'user_id')::uuid; v_account uuid := (p->>'account_id')::uuid;
  v_symbol text := upper(replace(p->>'symbol','/','')); v_side text := upper(p->>'side');
  v_qty numeric := (p->>'quantity')::numeric; v_mid numeric := (p->>'mid')::numeric;
  v_bid numeric := (p->>'bid')::numeric; v_ask numeric := (p->>'ask')::numeric;
  v_sl numeric := (p->>'stop_loss')::numeric; v_tp numeric := (p->>'take_profit')::numeric;
  v_contract numeric := (p->>'contract_size')::numeric;
  v_settings public.bb_bbook_settings%rowtype; v_exec public.bb_execution_settings%rowtype;
  v_pool public.bb_bbook_liquidity_pool%rowtype; v_acc public.trading_accounts%rowtype;
  v_lev integer; v_entry numeric; v_margin numeric; v_reserve numeric;
  v_float numeric; v_used numeric; v_open_count integer;
  v_position public.bb_bbook_positions%rowtype; v_spread numeric := coalesce((p->>'spread_cost')::numeric,0);
  v_exposure numeric;
begin
  if v_user is null or v_account is null or v_symbol is null or v_side not in ('BUY','SELL') or coalesce(v_qty,0)<=0 or coalesce(v_mid,0)<=0 or coalesce(v_bid,0)<=0 or coalesce(v_ask,0)<=0 or coalesce(v_contract,0)<=0 or coalesce(v_sl,0)<=0 or coalesce(v_tp,0)<=0 then raise exception 'Invalid B-Book order parameters'; end if;
  select * into v_settings from public.bb_bbook_settings where singleton=true for update;
  select * into v_exec from public.bb_execution_settings where singleton=true;
  select * into v_pool from public.bb_bbook_liquidity_pool where singleton=true for update;
  if not found or not v_settings.enabled or v_exec.global_halt or not v_exec.live_execution_enabled then raise exception 'B-Book REAL execution is locked by platform controls'; end if;
  if coalesce((v_exec.live_readiness->>'liquidity_verified')::boolean,false)=false or coalesce((v_exec.live_readiness->>'settlement_verified')::boolean,false)=false or coalesce((v_exec.live_readiness->>'regulatory_authorized')::boolean,false)=false or coalesce((v_exec.live_readiness->>'client_funds_controls_verified')::boolean,false)=false or coalesce((v_exec.live_readiness->>'reconciliation_verified')::boolean,false)=false then raise exception 'B-Book readiness checks are incomplete'; end if;
  select * into v_acc from public.trading_accounts where id=v_account and user_id=v_user and account_mode='real' and status='approved' and archived_at is null and deleted_at is null for update;
  if not found then raise exception 'Approved REAL account not found'; end if;
  if not exists(select 1 from public.kyc_submissions where user_id=v_user and status='approved') then raise exception 'Approved KYC is required for REAL execution'; end if;
  v_lev:=least(v_settings.max_leverage,greatest(1,coalesce(nullif(split_part(v_acc.requested_leverage,':',2),'')::integer,v_settings.default_leverage)));
  v_entry:=case when v_side='BUY' then v_ask else v_bid end;
  if (v_side='BUY' and (v_sl>=v_entry or v_tp<=v_entry)) or (v_side='SELL' and (v_sl<=v_entry or v_tp>=v_entry)) then raise exception 'SL/TP levels are invalid for the selected side'; end if;
  v_margin:=case when v_symbol='USDJPY' then (v_qty*v_contract)/v_lev else (v_entry*v_qty*v_contract)/v_lev end;
  v_reserve:=greatest(0,(case when v_side='BUY' then v_tp-v_entry else v_entry-v_tp end)*v_qty*v_contract);
  if v_symbol='USDJPY' then v_reserve:=v_reserve/v_tp; end if;
  v_exposure:=case when v_symbol='USDJPY' then v_qty*v_contract else v_entry*v_qty*v_contract end;
  select count(*),coalesce(sum(margin_used),0),coalesce(sum(floating_pnl),0) into v_open_count,v_used,v_float from public.bb_bbook_positions where account_id=v_account and status='OPEN';
  if v_open_count>=v_settings.max_open_positions then raise exception 'Maximum open positions reached'; end if;
  if v_exposure>v_settings.max_account_exposure then raise exception 'Order exceeds account exposure limit'; end if;
  if v_acc.balance+v_float-v_used<v_margin then raise exception 'Insufficient free margin'; end if;
  if v_pool.capital_balance-v_pool.reserved_payout<v_reserve then raise exception 'House liquidity is insufficient to reserve the maximum TP payout'; end if;
  insert into public.bb_bbook_positions(account_id,user_id,symbol,side,quantity,contract_size,leverage,entry_price,mark_price,bid_price,ask_price,stop_loss,take_profit,margin_used,reserved_payout,spread_cost)
  values(v_account,v_user,v_symbol,v_side,v_qty,v_contract,v_lev,v_entry,v_mid,v_bid,v_ask,v_sl,v_tp,v_margin,v_reserve,v_spread) returning * into v_position;
  update public.bb_bbook_liquidity_pool set reserved_payout=reserved_payout+v_reserve,updated_at=now() where singleton=true;
  if v_reserve>0 then insert into public.bb_bbook_liquidity_ledger(entry_type,direction,amount,balance_before,balance_after,reserved_before,reserved_after,position_id,actor_user_id,note) values('RESERVE','HOLD',v_reserve,v_pool.capital_balance,v_pool.capital_balance,v_pool.reserved_payout,v_pool.reserved_payout+v_reserve,v_position.id,v_user,'Reserved maximum TP payout'); end if;
  insert into public.bb_trade_audit_events(account_id,user_id,event_type,account_mode,entity_type,entity_id,details) values(v_account,v_user,'BBOOK_POSITION_OPENED','real','bbook_position',v_position.id,jsonb_build_object('symbol',v_symbol,'side',v_side,'quantity',v_qty,'entry_price',v_entry,'margin',v_margin,'leverage',v_lev));
  return jsonb_build_object('position',to_jsonb(v_position),'execution_mode','BBOOK');
end; $$;
revoke all on function public.bb_bbook_open_position(jsonb) from public,anon,authenticated;
grant execute on function public.bb_bbook_open_position(jsonb) to service_role;
create or replace function public.bb_bbook_close_position(p jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_user uuid := (p->>'user_id')::uuid; v_position_id uuid := (p->>'position_id')::uuid;
  v_exit numeric := (p->>'exit_price')::numeric; v_reason text := left(coalesce(p->>'reason','MANUAL CLOSE'),100);
  v_pos public.bb_bbook_positions%rowtype; v_acc public.trading_accounts%rowtype; v_pool public.bb_bbook_liquidity_pool%rowtype;
  v_gross numeric; v_net numeric; v_balance_after numeric; v_reserved_after numeric;
begin
  select * into v_pos from public.bb_bbook_positions where id=v_position_id and user_id=v_user and status='OPEN' for update;
  if not found or coalesce(v_exit,0)<=0 then raise exception 'Open B-Book position not found'; end if;
  select * into v_acc from public.trading_accounts where id=v_pos.account_id for update;
  select * into v_pool from public.bb_bbook_liquidity_pool where singleton=true for update;
  v_gross:=(case when v_pos.side='BUY' then v_exit-v_pos.entry_price else v_pos.entry_price-v_exit end)*v_pos.quantity*v_pos.contract_size;
  if v_pos.symbol='USDJPY' then v_gross:=v_gross/v_exit; end if;
  v_net:=v_gross; v_balance_after:=v_acc.balance+v_net;
  if v_balance_after<0 then raise exception 'Close would create a negative client account balance'; end if;
  v_reserved_after:=greatest(0,v_pool.reserved_payout-v_pos.reserved_payout);
  if v_pool.capital_balance-v_net-v_reserved_after<0 then raise exception 'Insufficient unreserved house liquidity to settle this client profit'; end if;
  update public.trading_accounts set balance=v_balance_after,updated_at=now() where id=v_pos.account_id;
  update public.bb_bbook_liquidity_pool set capital_balance=capital_balance-v_net,reserved_payout=v_reserved_after,total_client_profit=total_client_profit+greatest(v_net,0),total_client_loss=total_client_loss+greatest(-v_net,0),updated_at=now() where singleton=true;
  update public.bb_bbook_positions set mark_price=v_exit,bid_price=coalesce((p->>'bid')::numeric,v_exit),ask_price=coalesce((p->>'ask')::numeric,v_exit),floating_pnl=0,realized_pnl=v_net,status='CLOSED',close_reason=v_reason,closed_at=now() where id=v_position_id returning * into v_pos;
  if v_net<>0 then insert into public.bb_bbook_liquidity_ledger(entry_type,direction,amount,balance_before,balance_after,reserved_before,reserved_after,position_id,actor_user_id,note) values(case when v_net>0 then 'CLIENT_PROFIT' else 'CLIENT_LOSS' end,case when v_net>0 then 'DEBIT' else 'CREDIT' end,abs(v_net),v_pool.capital_balance,v_pool.capital_balance-v_net,v_pool.reserved_payout,v_reserved_after,v_position_id,v_user,v_reason); end if;
  insert into public.bb_trade_audit_events(account_id,user_id,event_type,account_mode,entity_type,entity_id,details) values(v_pos.account_id,v_user,'BBOOK_POSITION_CLOSED','real','bbook_position',v_position_id,jsonb_build_object('exit_price',v_exit,'realized_pnl',v_net,'reason',v_reason));
  return jsonb_build_object('position',to_jsonb(v_pos),'realized_pnl',v_net,'account_balance',v_balance_after,'execution_mode','BBOOK');
end; $$;
revoke all on function public.bb_bbook_close_position(jsonb) from public,anon,authenticated;
grant execute on function public.bb_bbook_close_position(jsonb) to service_role;