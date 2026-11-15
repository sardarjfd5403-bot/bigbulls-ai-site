-- Authenticated direct database gateway for REAL B-Book client actions.
-- Identity is always taken from auth.uid(); the browser cannot impersonate another client.
create or replace function public.bb_client_bbook_action(p_action text,p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_user uuid := auth.uid();
  v_account uuid := nullif(p_payload->>'account_id','')::uuid;
  v_id uuid;
  v_payload jsonb;
  v_result jsonb;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_action not in ('open','close','modify','pending','cancel_pending','status') then raise exception 'Unsupported B-Book action'; end if;
  if v_account is null or not exists(select 1 from public.trading_accounts where id=v_account and user_id=v_user and account_mode='real' and archived_at is null and deleted_at is null) then
    raise exception 'REAL trading account not found';
  end if;
  if p_action='status' then
    return jsonb_build_object(
      'account',(select to_jsonb(a) from public.trading_accounts a where a.id=v_account and a.user_id=v_user),
      'positions',(select coalesce(jsonb_agg(to_jsonb(p) order by p.opened_at desc),'[]'::jsonb) from public.bb_bbook_positions p where p.account_id=v_account and p.user_id=v_user),
      'pending_orders',(select coalesce(jsonb_agg(to_jsonb(o) order by o.created_at desc),'[]'::jsonb) from public.bb_bbook_pending_orders o where o.account_id=v_account and o.user_id=v_user and o.status='PENDING'),
      'metrics',(select jsonb_build_object('balance',a.balance,'credit_bonus',a.credit_bonus,'margin',coalesce((select sum(x.margin_used) from public.bb_bbook_positions x where x.account_id=a.id and x.status='OPEN'),0),'floating_pnl',coalesce((select sum(x.floating_pnl) from public.bb_bbook_positions x where x.account_id=a.id and x.status='OPEN'),0)) from public.trading_accounts a where a.id=v_account and a.user_id=v_user)
    );
  end if;
  if p_action='open' then
    if coalesce((p_payload->>'mid')::numeric,0)<=0 or coalesce((p_payload->>'bid')::numeric,0)<=0 or coalesce((p_payload->>'ask')::numeric,0)<=0 then raise exception 'A valid live bid/ask quote is required'; end if;
    v_payload:=p_payload||jsonb_build_object('user_id',v_user);
    return public.bb_bbook_open_position(v_payload);
  elsif p_action='close' then
    v_id:=nullif(p_payload->>'position_id','')::uuid;
    if v_id is null or not exists(select 1 from public.bb_bbook_positions where id=v_id and account_id=v_account and user_id=v_user and status='OPEN') then raise exception 'Open REAL position not found'; end if;
    if coalesce((p_payload->>'exit_price')::numeric,0)<=0 then raise exception 'A valid live exit price is required'; end if;
    v_payload:=p_payload||jsonb_build_object('user_id',v_user,'reason',coalesce(p_payload->>'reason','MANUAL CLOSE'));
    return public.bb_bbook_close_position(v_payload);
  elsif p_action='modify' then
    v_id:=nullif(p_payload->>'position_id','')::uuid;
    if v_id is null or not exists(select 1 from public.bb_bbook_positions where id=v_id and account_id=v_account and user_id=v_user and status='OPEN') then raise exception 'Open REAL position not found'; end if;
    v_payload:=p_payload||jsonb_build_object('user_id',v_user);
    return public.bb_bbook_modify_position(v_payload);
  elsif p_action='pending' then
    v_payload:=p_payload||jsonb_build_object('user_id',v_user);
    return public.bb_bbook_create_pending_order(v_payload);
  elsif p_action='cancel_pending' then
    v_id:=nullif(p_payload->>'order_id','')::uuid;
    if v_id is null or not exists(select 1 from public.bb_bbook_pending_orders where id=v_id and account_id=v_account and user_id=v_user and status='PENDING') then raise exception 'Pending REAL order not found'; end if;
    if public.bb_bbook_cancel_pending_order(v_id,v_user) then return jsonb_build_object('success',true,'order_id',v_id); end if;
    raise exception 'Pending order could not be cancelled';
  end if;
  raise exception 'Unsupported B-Book action';
end; $$;
revoke all on function public.bb_client_bbook_action(text,jsonb) from public,anon;
grant execute on function public.bb_client_bbook_action(text,jsonb) to authenticated;
