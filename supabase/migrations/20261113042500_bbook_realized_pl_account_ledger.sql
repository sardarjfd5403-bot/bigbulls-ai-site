-- Keep realized B-Book P/L in the client account balance ledger.
-- Idempotent: safe to re-apply without duplicating the function patch or historical entry.

begin;

alter table public.account_balance_ledger
  drop constraint if exists account_balance_ledger_entry_type_check;

alter table public.account_balance_ledger
  add constraint account_balance_ledger_entry_type_check
  check (entry_type = any (array[
    'deposit_credit','withdrawal_debit','admin_credit','admin_debit',
    'transfer_credit','transfer_debit','ib_commission_transfer',
    'trade_profit','trade_loss'
  ]::text[]));

do $repair$
declare
  v_definition text;
  v_old text := '  update public.trading_accounts set balance=v_balance_after,updated_at=now() where id=v_pos.account_id;';
  v_new text := '  update public.trading_accounts set balance=v_balance_after,updated_at=now() where id=v_pos.account_id;' || E'\\n' ||
'  if v_net<>0 then' || E'\\n' ||
'    insert into public.account_balance_ledger(account_id,user_id,transaction_id,actor_user_id,entry_type,amount,balance_before,balance_after,note)' || E'\\n' ||
'    values(v_pos.account_id,v_user,null,v_user,case when v_net>0 then ''trade_profit'' else ''trade_loss'' end,abs(v_net),v_acc.balance,v_balance_after,' || E'\\n' ||
'      ''B-Book realized P/L · ''||v_pos.symbol||'' ''||v_pos.side||'' · position ''||v_position_id::text);' || E'\\n' ||
'  end if;';
begin
  select pg_get_functiondef('public.bb_bbook_close_position(jsonb)'::regprocedure)
    into v_definition;

  if position('account_balance_ledger' in v_definition)=0 then
    if position(v_old in v_definition)=0 then
      raise exception 'Expected B-Book close balance update not found; migration stopped safely';
    end if;
    v_definition := replace(v_definition,v_old,v_new);
    execute v_definition;
  end if;
end
$repair$;

-- Historical correction: the only closed position predating this ledger patch.
-- Derive the pre-close balance from the current balance and the recorded realized P/L.
insert into public.account_balance_ledger(
  account_id,user_id,transaction_id,actor_user_id,entry_type,amount,
  balance_before,balance_after,note
)
select p.account_id,p.user_id,null,p.user_id,
       case when p.realized_pnl>0 then 'trade_profit' else 'trade_loss' end,
       round(abs(p.realized_pnl),2),
       round(a.balance-p.realized_pnl,2),
       round(a.balance,2),
       'Backfilled B-Book realized P/L · '||p.symbol||' '||p.side||' · position '||p.id::text
from public.bb_bbook_positions p
join public.trading_accounts a on a.id=p.account_id and a.user_id=p.user_id
where p.id='24cb2ff8-dc21-4c83-a767-ba8bcba3dec4'::uuid
  and p.status='CLOSED'
  and p.realized_pnl<>0
  and not exists(
    select 1 from public.account_balance_ledger l
    where l.account_id=p.account_id and l.note like '%'||p.id::text||'%'
  );

create or replace function public.admin_adjust_account_balance(
  p_account_id uuid,
  p_amount numeric,
  p_note text
) returns numeric
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_acc public.trading_accounts%rowtype;
  v_pool public.bb_bbook_liquidity_pool%rowtype;
  v_after numeric(18,2);
  v_pool_after numeric;
  v_type text;
  v_margin numeric(18,2):=0;
  v_float numeric(18,2):=0;
  v_reserved numeric(18,2):=0;
begin
  if auth.uid() is null or not public.is_bigbulls_admin() then
    raise exception 'Admin permission required';
  end if;
  if p_amount is null or p_amount::text in ('NaN','Infinity','-Infinity')
     or p_amount=0 or abs(p_amount)>10000000 or round(p_amount,2)<>p_amount
     or length(trim(coalesce(p_note,'')))<4 then
    raise exception 'Valid adjustment (up to 2 decimals) and audit reason required';
  end if;
  select * into v_acc from public.trading_accounts where id=p_account_id for update;
  if not found then raise exception 'Account not found'; end if;
  if p_amount<0 and v_acc.account_mode='real' then
    select coalesce(sum(margin_used),0),coalesce(sum(floating_pnl),0)
      into v_margin,v_float from public.bb_bbook_positions
      where account_id=v_acc.id and status='OPEN';
    select coalesce(sum(amount_usd),0) into v_reserved from public.wallet_transactions
      where account_id=v_acc.id and kind='withdrawal'
        and status in ('pending','otp_pending','processing');
    if v_acc.balance+v_float-v_margin-v_reserved+p_amount<0 then
      raise exception 'Admin debit would violate reserved withdrawals or open-position free margin';
    end if;
  end if;
  v_after:=v_acc.balance+p_amount;
  if v_after<0 then raise exception 'Balance cannot become negative'; end if;
  if v_acc.account_mode='real' then
    select * into v_pool from public.bb_bbook_liquidity_pool where singleton=true for update;
    if not found then raise exception 'Master B-Book liquidity pool is unavailable'; end if;
    if p_amount>0 and v_pool.capital_balance-v_pool.reserved_payout<p_amount then
      raise exception 'Insufficient unreserved B-Book liquidity for this client credit';
    end if;
    v_pool_after:=v_pool.capital_balance-p_amount;
  end if;
  update public.trading_accounts set balance=v_after,updated_at=now() where id=v_acc.id;
  v_type:=case when p_amount>0 then 'admin_credit' else 'admin_debit' end;
  insert into public.account_balance_ledger(account_id,user_id,actor_user_id,entry_type,amount,balance_before,balance_after,note)
  values(v_acc.id,v_acc.user_id,auth.uid(),v_type,abs(p_amount),v_acc.balance,v_after,trim(p_note));
  if v_acc.account_mode='real' then
    update public.bb_bbook_liquidity_pool set capital_balance=v_pool_after,updated_at=now() where singleton=true;
    insert into public.bb_bbook_liquidity_ledger(entry_type,direction,amount,balance_before,balance_after,reserved_before,reserved_after,actor_user_id,note)
    values('ADMIN_ADJUSTMENT',case when p_amount>0 then 'DEBIT' else 'CREDIT' end,abs(p_amount),
      v_pool.capital_balance,v_pool_after,v_pool.reserved_payout,v_pool.reserved_payout,auth.uid(),
      'Admin client balance adjustment · account #'||v_acc.account_number::text||' · '||trim(p_note));
  end if;
  insert into public.admin_audit_logs(actor_user_id,action,entity_type,entity_id,details)
  values(auth.uid(),'account_balance_adjusted','trading_account',p_account_id::text,
    jsonb_build_object('delta',p_amount,'before',v_acc.balance,'after',v_after,
      'pool_before',case when v_acc.account_mode='real' then v_pool.capital_balance else null end,
      'pool_after',case when v_acc.account_mode='real' then v_pool_after else null end,'note',p_note));
  return v_after;
end
$function$;

commit;
