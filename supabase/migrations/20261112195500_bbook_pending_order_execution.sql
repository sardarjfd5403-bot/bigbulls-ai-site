create table if not exists public.bb_bbook_pending_orders (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.trading_accounts(id) on delete cascade, symbol text not null,
  side text not null check (side in ('BUY','SELL')),
  order_type text not null check (order_type in ('BUY_LIMIT','SELL_LIMIT','BUY_STOP','SELL_STOP')),
  quantity numeric(18,8) not null check (quantity>0), contract_size numeric(18,8) not null check (contract_size>0),
  target_price numeric(24,10) not null check (target_price>0), stop_loss numeric(24,10), take_profit numeric(24,10),
  status text not null default 'PENDING' check (status in ('PENDING','FILLED','CANCELLED','REJECTED')),
  position_id uuid references public.bb_bbook_positions(id), reject_reason text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), filled_at timestamptz
);
create index if not exists bb_bbook_pending_orders_worker_idx on public.bb_bbook_pending_orders(status,created_at) where status='PENDING';
create index if not exists bb_bbook_pending_orders_account_idx on public.bb_bbook_pending_orders(user_id,account_id,created_at desc);
alter table public.bb_bbook_pending_orders enable row level security;
drop policy if exists bb_bbook_pending_orders_read_own on public.bb_bbook_pending_orders;
create policy bb_bbook_pending_orders_read_own on public.bb_bbook_pending_orders for select to authenticated using (user_id=auth.uid() or public.is_bigbulls_admin());
revoke all on public.bb_bbook_pending_orders from anon,authenticated;
grant select on public.bb_bbook_pending_orders to authenticated;

create or replace function public.bb_bbook_create_pending_order(p jsonb)
returns jsonb language plpgsql security definer set search_path='public','pg_temp' as $function$
declare
 v_user uuid:=(p->>'user_id')::uuid; v_account uuid:=(p->>'account_id')::uuid;
 v_symbol text:=upper(replace(p->>'symbol','/','')); v_side text:=upper(p->>'side'); v_type text:=upper(p->>'order_type');
 v_qty numeric:=(p->>'quantity')::numeric; v_contract numeric:=(p->>'contract_size')::numeric;
 v_target numeric:=(p->>'target_price')::numeric; v_sl numeric:=nullif(p->>'stop_loss','')::numeric;
 v_tp numeric:=nullif(p->>'take_profit','')::numeric; v_acc public.trading_accounts%rowtype; v_order public.bb_bbook_pending_orders%rowtype;
begin
 if v_user is null or v_account is null or v_symbol is null or v_side not in ('BUY','SELL')
 or v_type not in ('BUY_LIMIT','SELL_LIMIT','BUY_STOP','SELL_STOP') or coalesce(v_qty,0)<=0
 or coalesce(v_contract,0)<=0 or coalesce(v_target,0)<=0 then raise exception 'Invalid pending order parameters'; end if;
 if (v_type in ('BUY_LIMIT','BUY_STOP') and v_side<>'BUY') or (v_type in ('SELL_LIMIT','SELL_STOP') and v_side<>'SELL') then raise exception 'Pending order side/type mismatch'; end if;
 select * into v_acc from public.trading_accounts where id=v_account and user_id=v_user and account_mode='real' and status='approved' and archived_at is null and deleted_at is null for update;
 if not found then raise exception 'Approved REAL account not found'; end if;
 insert into public.bb_bbook_pending_orders(user_id,account_id,symbol,side,order_type,quantity,contract_size,target_price,stop_loss,take_profit)
 values(v_user,v_account,v_symbol,v_side,v_type,v_qty,v_contract,v_target,v_sl,v_tp) returning * into v_order;
 insert into public.bb_trade_audit_events(account_id,user_id,event_type,account_mode,entity_type,entity_id,details)
 values(v_account,v_user,'BBOOK_PENDING_ORDER_PLACED','real','bbook_pending_order',v_order.id,jsonb_build_object('symbol',v_symbol,'side',v_side,'order_type',v_type,'quantity',v_qty,'target_price',v_target));
 return jsonb_build_object('order',to_jsonb(v_order));
end;$function$;

create or replace function public.bb_bbook_trigger_pending_order(p_order_id uuid,p_mid numeric,p_bid numeric,p_ask numeric,p_spread_cost numeric default 0)
returns jsonb language plpgsql security definer set search_path='public','pg_temp' as $function$
declare v_order public.bb_bbook_pending_orders%rowtype; v_triggered boolean; v_result jsonb; v_position_id uuid; v_reason text;
begin
 select * into v_order from public.bb_bbook_pending_orders where id=p_order_id for update;
 if not found or v_order.status<>'PENDING' then return jsonb_build_object('status','SKIPPED'); end if;
 if coalesce(p_mid,0)<=0 or coalesce(p_bid,0)<=0 or coalesce(p_ask,0)<=0 then raise exception 'Invalid market quote'; end if;
 v_triggered:=case v_order.order_type when 'BUY_LIMIT' then p_ask<=v_order.target_price when 'SELL_LIMIT' then p_bid>=v_order.target_price when 'BUY_STOP' then p_ask>=v_order.target_price when 'SELL_STOP' then p_bid<=v_order.target_price else false end;
 if not v_triggered then return jsonb_build_object('status','PENDING'); end if;
 begin
  v_result:=public.bb_bbook_open_position(jsonb_build_object('user_id',v_order.user_id,'account_id',v_order.account_id,'symbol',v_order.symbol,'side',v_order.side,'quantity',v_order.quantity,'contract_size',v_order.contract_size,'mid',p_mid,'bid',p_bid,'ask',p_ask,'stop_loss',v_order.stop_loss,'take_profit',v_order.take_profit,'spread_cost',coalesce(p_spread_cost,0)));
  v_position_id:=(v_result->'position'->>'id')::uuid;
  update public.bb_bbook_pending_orders set status='FILLED',position_id=v_position_id,filled_at=now(),updated_at=now() where id=v_order.id;
  return jsonb_build_object('status','FILLED','position_id',v_position_id,'result',v_result);
 exception when others then
  v_reason:=case when sqlerrm ilike '%insufficient%' then 'Insufficient Funds' else left(sqlerrm,250) end;
  update public.bb_bbook_pending_orders set status='REJECTED',reject_reason=v_reason,updated_at=now() where id=v_order.id;
  return jsonb_build_object('status','REJECTED','error',v_reason);
 end;
end;$function$;

create or replace function public.bb_bbook_cancel_pending_order(p_order_id uuid,p_user_id uuid)
returns boolean language plpgsql security definer set search_path='public','pg_temp' as $function$
declare v_count integer; begin
 update public.bb_bbook_pending_orders set status='CANCELLED',updated_at=now() where id=p_order_id and user_id=p_user_id and status='PENDING';
 get diagnostics v_count=row_count; return v_count=1;
end;$function$;
revoke all on function public.bb_bbook_create_pending_order(jsonb) from public,anon,authenticated;
revoke all on function public.bb_bbook_trigger_pending_order(uuid,numeric,numeric,numeric,numeric) from public,anon,authenticated;
revoke all on function public.bb_bbook_cancel_pending_order(uuid,uuid) from public,anon,authenticated;
grant execute on function public.bb_bbook_create_pending_order(jsonb) to service_role;
grant execute on function public.bb_bbook_trigger_pending_order(uuid,numeric,numeric,numeric,numeric) to service_role;
grant execute on function public.bb_bbook_cancel_pending_order(uuid,uuid) to service_role;
notify pgrst,'reload schema';