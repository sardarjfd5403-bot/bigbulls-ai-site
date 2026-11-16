-- Native opposite-side hedging for REAL B-Book positions.
-- Matching volume on an existing opposite position carries zero additional margin;
-- any unmatched volume is charged at the account's normal leverage.
create or replace function public.bb_bbook_open_position(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_user uuid := (p->>'user_id')::uuid;
  v_account uuid := (p->>'account_id')::uuid;
  v_symbol text := upper(replace(p->>'symbol','/',''));
  v_side text := upper(p->>'side');
  v_qty numeric := (p->>'quantity')::numeric;
  v_mid numeric := (p->>'mid')::numeric;
  v_bid numeric := (p->>'bid')::numeric;
  v_ask numeric := (p->>'ask')::numeric;
  v_sl numeric := nullif(p->>'stop_loss','')::numeric;
  v_tp numeric := nullif(p->>'take_profit','')::numeric;
  v_contract numeric := (p->>'contract_size')::numeric;
  v_settings public.bb_bbook_settings%rowtype;
  v_exec public.bb_execution_settings%rowtype;
  v_pool public.bb_bbook_liquidity_pool%rowtype;
  v_acc public.trading_accounts%rowtype;
  v_lev integer;
  v_entry numeric;
  v_margin numeric;
  v_full_margin numeric;
  v_hedged_qty numeric := 0;
  v_reserve numeric;
  v_float numeric;
  v_used numeric;
  v_open_count integer;
  v_reserved_withdrawals numeric;
  v_position public.bb_bbook_positions%rowtype;
  v_spread numeric := coalesce((p->>'spread_cost')::numeric,0);
  v_exposure numeric;
begin
  if v_user is null or v_account is null or v_symbol is null or v_side not in ('BUY','SELL')
    or coalesce(v_qty,0)<=0 or coalesce(v_mid,0)<=0 or coalesce(v_bid,0)<=0
    or coalesce(v_ask,0)<=0 or coalesce(v_contract,0)<=0 then
    raise exception 'Invalid B-Book order parameters';
  end if;

  select * into v_settings from public.bb_bbook_settings where singleton=true for update;
  select * into v_exec from public.bb_execution_settings where singleton=true;
  select * into v_pool from public.bb_bbook_liquidity_pool where singleton=true for update;
  if not found or not v_settings.enabled or v_exec.global_halt or not v_exec.live_execution_enabled then
    raise exception 'B-Book REAL execution is locked by platform controls';
  end if;
  if coalesce((v_exec.live_readiness->>'liquidity_verified')::boolean,false)=false
    or coalesce((v_exec.live_readiness->>'settlement_verified')::boolean,false)=false
    or coalesce((v_exec.live_readiness->>'regulatory_authorized')::boolean,false)=false
    or coalesce((v_exec.live_readiness->>'client_funds_controls_verified')::boolean,false)=false
    or coalesce((v_exec.live_readiness->>'reconciliation_verified')::boolean,false)=false then
    raise exception 'B-Book readiness checks are incomplete';
  end if;

  select * into v_acc from public.trading_accounts
    where id=v_account and user_id=v_user and account_mode='real'
      and status='approved' and archived_at is null and deleted_at is null for update;
  if not found then raise exception 'Approved REAL account not found'; end if;
  if not exists(select 1 from public.kyc_submissions where user_id=v_user and status='approved') then
    raise exception 'Approved KYC is required for REAL execution';
  end if;

  v_lev:=least(v_settings.max_leverage,greatest(1,
    coalesce(nullif(split_part(v_acc.requested_leverage,':',2),'')::integer,v_settings.default_leverage)));
  v_entry:=case when v_side='BUY' then v_ask else v_bid end;
  if (v_sl is not null and ((v_side='BUY' and v_sl>=v_entry) or (v_side='SELL' and v_sl<=v_entry)))
    or (v_tp is not null and ((v_side='BUY' and v_tp<=v_entry) or (v_side='SELL' and v_tp>=v_entry))) then
    raise exception 'SL/TP levels are invalid for the selected side';
  end if;

  -- Opposite positions are allowed even while the first leg is in floating profit or loss.
  -- Only the quantity that exceeds the already-open opposite-side volume consumes new margin.
  select least(v_qty,coalesce(sum(quantity),0))
    into v_hedged_qty
    from public.bb_bbook_positions
    where account_id=v_account and user_id=v_user
      and symbol=v_symbol and side<>v_side and status='OPEN';

  v_full_margin:=case when v_symbol='USDJPY' then (v_qty*v_contract)/v_lev
    else (v_entry*v_qty*v_contract)/v_lev end;
  v_margin:=case when v_qty>0 then v_full_margin*(v_qty-v_hedged_qty)/v_qty else 0 end;

  v_reserve:=case when v_tp is null then 0 else greatest(0,(case when v_side='BUY' then v_tp-v_entry else v_entry-v_tp end)*v_qty*v_contract) end;
  if v_symbol='USDJPY' and v_tp is not null then v_reserve:=v_reserve/v_tp; end if;
  v_exposure:=case when v_symbol='USDJPY' then v_qty*v_contract else v_entry*v_qty*v_contract end;

  select count(*),coalesce(sum(margin_used),0),coalesce(sum(floating_pnl),0)
    into v_open_count,v_used,v_float
    from public.bb_bbook_positions where account_id=v_account and status='OPEN';
  select coalesce(sum(amount_usd),0) into v_reserved_withdrawals
    from public.wallet_transactions where account_id=v_account
      and kind='withdrawal' and status in ('pending','otp_pending','processing');

  if v_open_count>=v_settings.max_open_positions then raise exception 'Maximum open positions reached'; end if;
  if v_exposure>v_settings.max_account_exposure then raise exception 'Order exceeds account exposure limit'; end if;
  if v_acc.balance+coalesce(v_acc.credit_bonus,0)+v_float-v_used-v_reserved_withdrawals<v_margin then
    raise exception 'Insufficient free margin after reserved withdrawals'; end if;
  if v_reserve>0 and v_pool.capital_balance-v_pool.reserved_payout<v_reserve then
    raise exception 'Insufficient Funds'; end if;

  insert into public.bb_bbook_positions(
    account_id,user_id,symbol,side,quantity,contract_size,leverage,entry_price,
    mark_price,bid_price,ask_price,stop_loss,take_profit,margin_used,reserved_payout,spread_cost
  ) values (
    v_account,v_user,v_symbol,v_side,v_qty,v_contract,v_lev,v_entry,
    v_mid,v_bid,v_ask,v_sl,v_tp,v_margin,v_reserve,v_spread
  ) returning * into v_position;

  update public.bb_bbook_liquidity_pool
    set reserved_payout=reserved_payout+v_reserve,updated_at=now() where singleton=true;
  if v_reserve>0 then
    insert into public.bb_bbook_liquidity_ledger(
      entry_type,direction,amount,balance_before,balance_after,
      reserved_before,reserved_after,position_id,actor_user_id,note
    ) values (
      'RESERVE','HOLD',v_reserve,v_pool.capital_balance,v_pool.capital_balance,
      v_pool.reserved_payout,v_pool.reserved_payout+v_reserve,
      v_position.id,v_user,'Reserved maximum TP payout'
    );
  end if;

  insert into public.bb_trade_audit_events(
    account_id,user_id,event_type,account_mode,entity_type,entity_id,details
  ) values (
    v_account,v_user,'BBOOK_POSITION_OPENED','real','bbook_position',v_position.id,
    jsonb_build_object('symbol',v_symbol,'side',v_side,'quantity',v_qty,
      'entry_price',v_entry,'margin',v_margin,'hedged_quantity',v_hedged_qty,'leverage',v_lev)
  );
  return jsonb_build_object('position',to_jsonb(v_position),'execution_mode','BBOOK',
    'hedged_quantity',v_hedged_qty,'additional_margin',v_margin);
end;
$function$;
