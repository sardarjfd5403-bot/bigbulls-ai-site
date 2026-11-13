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

commit;
