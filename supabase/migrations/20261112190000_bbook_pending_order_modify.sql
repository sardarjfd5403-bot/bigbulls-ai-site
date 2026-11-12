create or replace function public.bb_bbook_modify_pending_order(
  p_order_id uuid,
  p_target_price numeric,
  p_stop_loss numeric default null,
  p_take_profit numeric default null
) returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $function$
declare
  v_user uuid := auth.uid();
  v_order public.bb_bbook_pending_orders%rowtype;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_target_price is null or p_target_price<=0 then raise exception 'Target price must be greater than zero'; end if;
  if p_stop_loss is not null and p_stop_loss<=0 then raise exception 'Stop Loss must be greater than zero'; end if;
  if p_take_profit is not null and p_take_profit<=0 then raise exception 'Take Profit must be greater than zero'; end if;
  update public.bb_bbook_pending_orders
    set target_price=p_target_price,stop_loss=p_stop_loss,take_profit=p_take_profit,updated_at=now()
    where id=p_order_id and user_id=v_user and status='PENDING'
    returning * into v_order;
  if not found then raise exception 'Pending order not found or no longer editable'; end if;
  return jsonb_build_object('success',true,'order',to_jsonb(v_order));
end;
$function$;
revoke all on function public.bb_bbook_modify_pending_order(uuid,numeric,numeric,numeric) from public;
revoke all on function public.bb_bbook_modify_pending_order(uuid,numeric,numeric,numeric) from anon;
grant execute on function public.bb_bbook_modify_pending_order(uuid,numeric,numeric,numeric) to authenticated;
