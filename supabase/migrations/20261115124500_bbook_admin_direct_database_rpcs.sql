-- Direct authenticated database RPCs for the in-house B-Book admin console.
-- Admin authorization is checked inside each SECURITY DEFINER function.
create or replace function public.bb_bbook_admin_status()
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_settings jsonb; v_pool jsonb; v_worker jsonb; v_positions jsonb; v_ledger jsonb; v_exec jsonb;
  v_open integer; v_exposure numeric; v_float numeric;
begin
  if not public.is_bigbulls_admin() then raise exception 'Admin permission required'; end if;
  select to_jsonb(s) into v_settings from public.bb_bbook_settings s where singleton=true;
  select to_jsonb(p) into v_pool from public.bb_bbook_liquidity_pool p where singleton=true;
  select to_jsonb(w)-'worker_secret' into v_worker from public.bb_bbook_worker_config w where singleton=true;
  select to_jsonb(e) into v_exec from public.bb_execution_settings e where singleton=true;
  select count(*),coalesce(sum(case when p.symbol='USDJPY' then p.quantity*p.contract_size else p.entry_price*p.quantity*p.contract_size end),0),coalesce(sum(p.floating_pnl),0)
    into v_open,v_exposure,v_float from public.bb_bbook_positions p where p.status='OPEN';
  select coalesce(jsonb_agg(to_jsonb(x)||jsonb_build_object('trading_accounts',jsonb_build_object('account_number',x.account_number,'display_name',x.display_name)) order by x.opened_at desc),'[]'::jsonb)
    into v_positions from (select p.*,a.account_number,a.display_name from public.bb_bbook_positions p left join public.trading_accounts a on a.id=p.account_id where p.status='OPEN' order by p.opened_at desc limit 500) x;
  select coalesce(jsonb_agg(to_jsonb(l) order by l.created_at desc),'[]'::jsonb) into v_ledger from (select * from public.bb_bbook_liquidity_ledger order by created_at desc limit 100) l;
  return jsonb_build_object('settings',v_settings,'pool',v_pool,'worker',v_worker,'execution',v_exec,'positions',v_positions,'ledger',v_ledger,
    'metrics',jsonb_build_object('open_positions',v_open,'gross_exposure',v_exposure,'floating_client_pnl',v_float,'house_net_pnl',-v_float));
end;
$$;

create or replace function public.bb_bbook_admin_control(p_action text,p_payload jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_user uuid:=auth.uid(); v_settings public.bb_bbook_settings%rowtype; v_exec public.bb_execution_settings%rowtype;
  v_pool public.bb_bbook_liquidity_pool%rowtype; v_worker public.bb_bbook_worker_config%rowtype;
  v_patch jsonb:='{}'::jsonb; v_result jsonb; v_amount numeric; v_direction text; v_note text; v_checks jsonb;
begin
  if not public.is_bigbulls_admin() or v_user is null then raise exception 'Admin permission required'; end if;
  select * into v_settings from public.bb_bbook_settings where singleton=true for update;
  select * into v_exec from public.bb_execution_settings where singleton=true;
  select * into v_pool from public.bb_bbook_liquidity_pool where singleton=true for update;
  select * into v_worker from public.bb_bbook_worker_config where singleton=true for update;
  if p_action='worker_toggle' then
    update public.bb_bbook_worker_config set enabled=coalesce((p_payload->>'enabled')::boolean,false),updated_at=now() where singleton=true returning * into v_worker;
    insert into public.bb_trade_audit_events(actor_user_id,event_type,entity_type,details)
      values(v_user,case when v_worker.enabled then 'BBOOK_RISK_WORKER_ENABLED' else 'BBOOK_RISK_WORKER_PAUSED' end,'bbook_worker_config',jsonb_build_object('enabled',v_worker.enabled));
    return jsonb_build_object('success',true,'worker',to_jsonb(v_worker)-'worker_secret');
  elsif p_action='adjust_liquidity' then
    v_amount:=(p_payload->>'amount')::numeric; v_direction:=upper(coalesce(p_payload->>'direction','')); v_note:=left(trim(coalesce(p_payload->>'note','')),250);
    if v_amount is null or v_amount<=0 or v_amount>1000000000 or v_direction not in ('DEPOSIT','WITHDRAWAL') or length(v_note)<8 then raise exception 'Valid amount, direction and verified audit reference (8+ characters) are required'; end if;
    select public.bb_bbook_adjust_liquidity(v_amount,v_direction,v_user,v_note) into v_result;
    return jsonb_build_object('success',true,'pool',v_result);
  elsif p_action='update_settings' then
    if p_payload ? 'default_leverage' then if (p_payload->>'default_leverage')::integer not between 1 and 500 then raise exception 'Default leverage must be 1–500'; end if; v_patch:=v_patch||jsonb_build_object('default_leverage',(p_payload->>'default_leverage')::integer); end if;
    if p_payload ? 'max_leverage' then if (p_payload->>'max_leverage')::integer not between 1 and 1000 then raise exception 'Maximum leverage must be 1–1000'; end if; v_patch:=v_patch||jsonb_build_object('max_leverage',(p_payload->>'max_leverage')::integer); end if;
    if p_payload ? 'spread_bps' then
      v_checks:=p_payload->'spread_bps';
      if jsonb_typeof(v_checks)<>'object' or exists(select 1 from jsonb_each_text(v_checks) e where e.key not in ('FX','XAUUSD','CRYPTO','INDEX','OIL') or e.value::numeric<0 or e.value::numeric>100) then raise exception 'Spread values must be 0–100 bps'; end if;
      v_patch:=v_patch||jsonb_build_object('spread_bps',v_settings.spread_bps||v_checks);
    end if;
    if p_payload ? 'margin_call_level_pct' then if (p_payload->>'margin_call_level_pct')::numeric not between 50 and 1000 then raise exception 'Margin call level must be 50–1000'; end if; v_patch:=v_patch||jsonb_build_object('margin_call_level_pct',(p_payload->>'margin_call_level_pct')::numeric); end if;
    if p_payload ? 'stop_out_level_pct' then if (p_payload->>'stop_out_level_pct')::numeric not between 10 and 100 then raise exception 'Stop-out level must be 10–100'; end if; v_patch:=v_patch||jsonb_build_object('stop_out_level_pct',(p_payload->>'stop_out_level_pct')::numeric); end if;
    if p_payload ? 'enabled' then
      if (p_payload->>'enabled')::boolean then
        v_checks:=v_exec.live_readiness;
        if v_exec.live_execution_enabled is not true or v_exec.global_halt is true
          or coalesce((v_checks->>'liquidity_verified')::boolean,false) is not true
          or coalesce((v_checks->>'settlement_verified')::boolean,false) is not true
          or coalesce((v_checks->>'regulatory_authorized')::boolean,false) is not true
          or coalesce((v_checks->>'client_funds_controls_verified')::boolean,false) is not true
          or coalesce((v_checks->>'reconciliation_verified')::boolean,false) is not true
          or (v_pool.capital_balance-v_pool.reserved_payout)<=0 or v_worker.enabled is not true or v_worker.last_error is not null then
          raise exception 'REAL B-Book readiness failed: verify live execution, halt, compliance, available pool capital and risk worker';
        end if;
      end if;
      v_patch:=v_patch||jsonb_build_object('enabled',(p_payload->>'enabled')::boolean);
    end if;
    update public.bb_bbook_settings set enabled=coalesce((v_patch->>'enabled')::boolean,enabled),
      default_leverage=coalesce((v_patch->>'default_leverage')::integer,default_leverage),
      max_leverage=coalesce((v_patch->>'max_leverage')::integer,max_leverage),
      spread_bps=coalesce(v_patch->'spread_bps',spread_bps),
      margin_call_level_pct=coalesce((v_patch->>'margin_call_level_pct')::numeric,margin_call_level_pct),
      stop_out_level_pct=coalesce((v_patch->>'stop_out_level_pct')::numeric,stop_out_level_pct),
      updated_at=now(),updated_by=v_user where singleton=true returning to_jsonb(bb_bbook_settings.*) into v_result;
    insert into public.bb_trade_audit_events(actor_user_id,event_type,entity_type,details) values(v_user,'BBOOK_SETTINGS_UPDATED','bbook_settings',v_patch);
    return jsonb_build_object('success',true,'settings',v_result);
  end if;
  raise exception 'Unsupported B-Book admin action';
end;
$$;

revoke all on function public.bb_bbook_admin_status() from public,anon;
revoke all on function public.bb_bbook_admin_control(text,jsonb) from public,anon;
grant execute on function public.bb_bbook_admin_status() to authenticated;
grant execute on function public.bb_bbook_admin_control(text,jsonb) to authenticated;
