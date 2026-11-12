create index if not exists partner_commission_rates_updated_by_idx
  on public.partner_commission_rates(updated_by);
create index if not exists partner_payout_reviewed_by_idx
  on public.partner_payout_requests(reviewed_by);
create index if not exists partner_wallet_ledger_actor_idx
  on public.partner_wallet_ledger(actor_user_id);
create index if not exists partner_wallet_transfers_account_idx
  on public.partner_wallet_transfers(trading_account_id);

create or replace function public.admin_review_partner_payout(
  p_request_id uuid, p_status text, p_admin_note text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $function$
declare
  v_request public.partner_payout_requests%rowtype;
  v_wallet public.partner_wallet_accounts%rowtype;
begin
  if auth.uid() is null or not public.is_bigbulls_admin() then
    raise exception 'Admin permission required';
  end if;
  if p_status not in ('paid','rejected') then
    raise exception 'Payout status must be paid or rejected';
  end if;
  if p_status='rejected' and length(trim(coalesce(p_admin_note,'')))<4 then
    raise exception 'A clear payout rejection reason is required';
  end if;

  select * into v_request
    from public.partner_payout_requests
   where id=p_request_id and status='pending'
   for update;
  if not found then raise exception 'Pending IB payout request not found'; end if;

  if p_status='rejected' then
    select * into v_wallet
      from public.partner_wallet_accounts
     where partner_user_id=v_request.partner_user_id
     for update;
    update public.partner_wallet_accounts
       set available_balance=available_balance+v_request.amount,updated_at=now()
     where partner_user_id=v_request.partner_user_id
     returning * into v_wallet;
    insert into public.partner_wallet_ledger(
      partner_user_id,reference_id,actor_user_id,entry_type,direction,amount,
      balance_before,balance_after,note
    ) values (
      v_request.partner_user_id,v_request.id,auth.uid(),'payout_refund','credit',
      v_request.amount,v_wallet.available_balance-v_request.amount,
      v_wallet.available_balance,'IB payout rejected · funds returned'
    );
  else
    update public.partner_wallet_accounts
       set total_paid=total_paid+v_request.amount,updated_at=now()
     where partner_user_id=v_request.partner_user_id;
  end if;

  update public.partner_payout_requests
     set status=p_status,
         admin_note=nullif(trim(coalesce(p_admin_note,'')),''),
         reviewed_by=auth.uid(),
         reviewed_at=now(),
         paid_at=case when p_status='paid' then now() else null end
   where id=p_request_id;
end;
$function$;

revoke all on function public.admin_review_partner_payout(uuid,text,text) from public,anon;
grant execute on function public.admin_review_partner_payout(uuid,text,text) to authenticated;