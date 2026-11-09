-- BIGBULLS migration 007: temporarily defer withdrawal email OTP.
-- Requests remain pending Admin review. Keep OTP challenge infrastructure for later re-enable.
-- Reserve funds logically for processing withdrawals so Admin cannot approve concurrent
-- requests against the same available balance.
begin;

create or replace function public.admin_review_wallet_transaction(
 p_transaction_id uuid,p_status text,p_admin_note text default null
) returns void language plpgsql security definer set search_path=public
as $$
declare
 v_tx public.wallet_transactions%rowtype;
 v_acc public.trading_accounts%rowtype;
 v_before numeric(18,2);
 v_reserved numeric(18,2);
begin
 if not public.is_bigbulls_admin() then raise exception 'Admin permission required'; end if;
 if p_status not in ('approved','rejected') then raise exception 'Invalid review status'; end if;

 select * into v_tx from public.wallet_transactions where id=p_transaction_id for update;
 if not found or v_tx.status<>'pending' then raise exception 'Request not found or already reviewed'; end if;
 if p_status='rejected' and length(trim(coalesce(p_admin_note,'')))<4 then
  raise exception 'Rejection reason is required (at least 4 characters)';
 end if;

 if v_tx.kind='withdrawal' and p_status='approved' then
  if v_tx.account_id is null then raise exception 'Withdrawal must be linked to a trading account'; end if;
  select * into v_acc from public.trading_accounts where id=v_tx.account_id for update;
  if not found or v_acc.user_id<>v_tx.user_id then raise exception 'Account mismatch'; end if;
  if v_acc.currency<>'USD' then raise exception 'Funding for non-USD accounts requires currency conversion setup'; end if;

  -- Processing payouts are reserved until Admin confirms the external transfer.
  select coalesce(sum(amount_usd),0) into v_reserved
   from public.wallet_transactions
   where account_id=v_acc.id and kind='withdrawal' and status='processing';
  if v_acc.balance-v_reserved<v_tx.amount_usd then
   raise exception 'Insufficient available balance after pending payouts';
  end if;

  update public.wallet_transactions set status='processing',admin_note=p_admin_note,reviewed_by=auth.uid(),reviewed_at=now()
   where id=p_transaction_id;
 elsif v_tx.kind='deposit' and p_status='approved' then
  if v_tx.account_id is null then raise exception 'Deposit must be linked to a trading account'; end if;
  select * into v_acc from public.trading_accounts where id=v_tx.account_id for update;
  if not found or v_acc.user_id<>v_tx.user_id then raise exception 'Account mismatch'; end if;
  if v_acc.currency<>'USD' then raise exception 'Funding for non-USD accounts requires currency conversion setup'; end if;
  v_before:=v_acc.balance;
  update public.trading_accounts set balance=balance+v_tx.amount_usd where id=v_acc.id;
  insert into public.account_balance_ledger(account_id,user_id,transaction_id,actor_user_id,entry_type,amount,balance_before,balance_after,note)
   values(v_acc.id,v_tx.user_id,v_tx.id,auth.uid(),'deposit_credit',v_tx.amount_usd,v_before,v_before+v_tx.amount_usd,'Admin-approved deposit');
  update public.wallet_transactions set status='approved',admin_note=p_admin_note,reviewed_by=auth.uid(),reviewed_at=now()
   where id=p_transaction_id;
 else
  update public.wallet_transactions set status='rejected',admin_note=p_admin_note,rejection_reason=p_admin_note,reviewed_by=auth.uid(),reviewed_at=now()
   where id=p_transaction_id;
 end if;

 insert into public.admin_audit_logs(actor_user_id,action,entity_type,entity_id,details)
 values(auth.uid(),'wallet_request_'||p_status,'wallet_transaction',p_transaction_id::text,
 jsonb_build_object('kind',v_tx.kind,'amount_usd',v_tx.amount_usd,'account_id',v_tx.account_id,'invoice_id',v_tx.invoice_id,'note',p_admin_note,'otp_deferred',v_tx.kind='withdrawal'));
end $$;

revoke all on function public.admin_review_wallet_transaction(uuid,text,text) from public,anon;
grant execute on function public.admin_review_wallet_transaction(uuid,text,text) to authenticated;
notify pgrst,'reload schema';
commit;
