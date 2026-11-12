
alter table public.wallet_transactions
  add column if not exists pool_reserved_amount numeric(18,2) not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.wallet_transactions'::regclass
      and conname='wallet_transactions_pool_reserved_nonnegative'
  ) then
    alter table public.wallet_transactions
      add constraint wallet_transactions_pool_reserved_nonnegative
      check (pool_reserved_amount >= 0);
  end if;
end $$;

create or replace function public.admin_review_wallet_transaction(
  p_transaction_id uuid, p_status text, p_admin_note text default null
) returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_tx public.wallet_transactions%rowtype;
  v_acc public.trading_accounts%rowtype;
  v_wallet public.client_wallet_accounts%rowtype;
  v_pool public.bb_bbook_liquidity_pool%rowtype;
  v_before numeric(18,2);
  v_reserved numeric(18,2);
  v_margin numeric(18,2);
  v_float numeric(18,2);
  v_reserved_after numeric(20,8);
begin
  if not public.is_bigbulls_admin() then raise exception 'Admin permission required'; end if;
  if p_status not in ('approved','rejected') then raise exception 'Invalid review status'; end if;

  select * into v_tx from public.wallet_transactions
  where id=p_transaction_id for update;
  if not found then raise exception 'Wallet request not found'; end if;

  if p_status='rejected' then
    if v_tx.status not in ('pending','processing') then
      raise exception 'Request is not awaiting review or payout';
    end if;
    if length(trim(coalesce(p_admin_note,'')))<4 then
      raise exception 'Rejection reason is required (at least 4 characters)';
    end if;

    if v_tx.kind='withdrawal' and v_tx.status='processing' and v_tx.pool_reserved_amount>0 then
      select * into v_pool from public.bb_bbook_liquidity_pool where singleton=true for update;
      if not found or v_pool.reserved_payout<v_tx.pool_reserved_amount then
        raise exception 'Reserved pool amount does not reconcile; manual review required';
      end if;
      v_reserved_after:=v_pool.reserved_payout-v_tx.pool_reserved_amount;
      update public.bb_bbook_liquidity_pool
        set reserved_payout=v_reserved_after,updated_at=now() where singleton=true;
      insert into public.bb_bbook_liquidity_ledger(
        entry_type,direction,amount,balance_before,balance_after,
        reserved_before,reserved_after,actor_user_id,note
      ) values (
        'RELEASE','RELEASE',v_tx.pool_reserved_amount,
        v_pool.capital_balance,v_pool.capital_balance,
        v_pool.reserved_payout,v_reserved_after,auth.uid(),
        'Rejected withdrawal reserve released · '||coalesce(v_tx.invoice_id,v_tx.id::text)
      );
    end if;

    update public.wallet_transactions
      set status='rejected',admin_note=p_admin_note,rejection_reason=p_admin_note,
          reviewed_by=auth.uid(),reviewed_at=now(),pool_reserved_amount=0
      where id=p_transaction_id;
    insert into public.admin_audit_logs(actor_user_id,action,entity_type,entity_id,details)
      values(auth.uid(),'wallet_request_rejected','wallet_transaction',p_transaction_id::text,
        jsonb_build_object('kind',v_tx.kind,'amount_usd',v_tx.amount_usd,
          'invoice_id',v_tx.invoice_id,'account_id',v_tx.account_id,'note',p_admin_note));
    return;
  end if;

  if v_tx.status<>'pending' then raise exception 'Request not found or already reviewed'; end if;
  if v_tx.amount_usd<=0 or v_tx.amount_crypto<=0 then raise exception 'Transaction amount must be positive'; end if;

  if v_tx.kind='deposit' then
    if v_tx.tx_hash is null or length(trim(v_tx.tx_hash))<=10 then
      raise exception 'A valid blockchain TXID is required before approving a deposit';
    end if;

    if v_tx.account_id is null then
      insert into public.client_wallet_accounts(user_id,currency,balance)
        values(v_tx.user_id,'USD',0) on conflict(user_id) do nothing;
      select * into v_wallet from public.client_wallet_accounts
        where user_id=v_tx.user_id for update;
      if not found then raise exception 'Main Wallet could not be initialized'; end if;
      v_before:=v_wallet.balance;
      update public.client_wallet_accounts
        set balance=balance+v_tx.amount_usd,updated_at=now()
        where user_id=v_tx.user_id;
      insert into public.client_wallet_ledger(
        user_id,reference_id,actor_user_id,entry_type,direction,amount,
        balance_before,balance_after,note
      ) values (
        v_tx.user_id,v_tx.id,auth.uid(),'deposit_credit','credit',
        v_tx.amount_usd,v_before,v_before+v_tx.amount_usd,
        'Admin-approved verified deposit · '||coalesce(v_tx.invoice_id,v_tx.id::text)
      );
    else
      select * into v_acc from public.trading_accounts
        where id=v_tx.account_id for update;
      if not found or v_acc.user_id<>v_tx.user_id or v_acc.account_mode<>'real'
        or v_acc.status<>'approved' or v_acc.archived_at is not null
        or v_acc.deleted_at is not null or v_acc.currency<>'USD' then
        raise exception 'Request must belong to an active, approved Real USD account';
      end if;
      v_before:=v_acc.balance;
      update public.trading_accounts set balance=balance+v_tx.amount_usd,updated_at=now()
        where id=v_acc.id;
      insert into public.account_balance_ledger(
        account_id,user_id,transaction_id,actor_user_id,entry_type,
        amount,balance_before,balance_after,note
      ) values (
        v_acc.id,v_tx.user_id,v_tx.id,auth.uid(),'deposit_credit',
        v_tx.amount_usd,v_before,v_before+v_tx.amount_usd,
        'Admin-approved verified Real-account deposit'
      );
    end if;

    update public.wallet_transactions
      set status='approved',admin_note=p_admin_note,reviewed_by=auth.uid(),reviewed_at=now()
      where id=p_transaction_id;
    insert into public.admin_audit_logs(actor_user_id,action,entity_type,entity_id,details)
      values(auth.uid(),'wallet_deposit_approved','wallet_transaction',p_transaction_id::text,
        jsonb_build_object('amount_usd',v_tx.amount_usd,'invoice_id',v_tx.invoice_id,
          'account_id',v_tx.account_id,'credited_to',case when v_tx.account_id is null then 'main_wallet' else 'trading_account' end));
    return;
  end if;

  if v_tx.kind<>'withdrawal' then raise exception 'Unsupported wallet transaction kind'; end if;
  if v_tx.destination_address is null or length(trim(v_tx.destination_address))<=10 then
    raise exception 'A valid withdrawal destination is required';
  end if;

  if v_tx.account_id is null then
    insert into public.client_wallet_accounts(user_id,currency,balance)
      values(v_tx.user_id,'USD',0) on conflict(user_id) do nothing;
    select * into v_wallet from public.client_wallet_accounts
      where user_id=v_tx.user_id for update;
    if not found then raise exception 'Main Wallet could not be loaded'; end if;
    select coalesce(sum(amount_usd),0) into v_reserved
      from public.wallet_transactions
      where user_id=v_tx.user_id and account_id is null and kind='withdrawal'
        and status='processing' and id<>v_tx.id;
    if v_wallet.balance-v_reserved<v_tx.amount_usd then
      raise exception 'Insufficient Main Wallet balance after pending withdrawal locks';
    end if;
  else
    select * into v_acc from public.trading_accounts
      where id=v_tx.account_id for update;
    if not found or v_acc.user_id<>v_tx.user_id or v_acc.account_mode<>'real'
      or v_acc.status<>'approved' or v_acc.archived_at is not null
      or v_acc.deleted_at is not null or v_acc.currency<>'USD' then
      raise exception 'Withdrawal must belong to an active, approved Real USD account';
    end if;
    select coalesce(sum(amount_usd),0) into v_reserved
      from public.wallet_transactions
      where account_id=v_acc.id and kind='withdrawal'
        and status='processing' and id<>v_tx.id;
    select coalesce(sum(margin_used),0),coalesce(sum(floating_pnl),0)
      into v_margin,v_float
      from public.bb_bbook_positions where account_id=v_acc.id and status='OPEN';
    if v_acc.balance+v_float-v_margin-v_reserved<v_tx.amount_usd then
      raise exception 'Insufficient free margin after existing withdrawal locks';
    end if;
  end if;

  select * into v_pool from public.bb_bbook_liquidity_pool where singleton=true for update;
  if not found or v_pool.capital_balance-v_pool.reserved_payout<v_tx.amount_usd then
    raise exception 'Master B-Book pool has insufficient unreserved book capital for this payout';
  end if;
  v_reserved_after:=v_pool.reserved_payout+v_tx.amount_usd;
  update public.bb_bbook_liquidity_pool
    set reserved_payout=v_reserved_after,updated_at=now() where singleton=true;
  insert into public.bb_bbook_liquidity_ledger(
    entry_type,direction,amount,balance_before,balance_after,
    reserved_before,reserved_after,actor_user_id,note
  ) values (
    'RESERVE','HOLD',v_tx.amount_usd,v_pool.capital_balance,v_pool.capital_balance,
    v_pool.reserved_payout,v_reserved_after,auth.uid(),
    'Client withdrawal payout reserved · '||coalesce(v_tx.invoice_id,v_tx.id::text)
  );

  update public.wallet_transactions
    set status='processing',admin_note=p_admin_note,reviewed_by=auth.uid(),
        reviewed_at=now(),pool_reserved_amount=v_tx.amount_usd
    where id=p_transaction_id;
  insert into public.admin_audit_logs(actor_user_id,action,entity_type,entity_id,details)
    values(auth.uid(),'wallet_withdrawal_reserved','wallet_transaction',p_transaction_id::text,
      jsonb_build_object('amount_usd',v_tx.amount_usd,'invoice_id',v_tx.invoice_id,
        'account_id',v_tx.account_id,'pool_reserved_amount',v_tx.amount_usd));
end;
$function$;

create or replace function public.admin_complete_withdrawal(
  p_transaction_id uuid, p_payout_reference text
) returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_tx public.wallet_transactions%rowtype;
  v_acc public.trading_accounts%rowtype;
  v_wallet public.client_wallet_accounts%rowtype;
  v_pool public.bb_bbook_liquidity_pool%rowtype;
  v_before numeric(18,2);
  v_margin numeric(18,2);
  v_float numeric(18,2);
  v_reserved_after numeric(20,8);
begin
  if not public.is_bigbulls_admin() then raise exception 'Admin permission required'; end if;
  if length(trim(coalesce(p_payout_reference,'')))<5 then
    raise exception 'Payout TXID/reference is required';
  end if;

  select * into v_tx from public.wallet_transactions
    where id=p_transaction_id for update;
  if not found or v_tx.kind<>'withdrawal' or v_tx.status<>'processing' then
    raise exception 'Withdrawal is not processing';
  end if;

  if v_tx.account_id is null then
    select * into v_wallet from public.client_wallet_accounts
      where user_id=v_tx.user_id for update;
    if not found or v_wallet.balance<v_tx.amount_usd then
      raise exception 'Main Wallet balance is insufficient; payout cannot be completed';
    end if;
    v_before:=v_wallet.balance;
    update public.client_wallet_accounts set balance=balance-v_tx.amount_usd,updated_at=now()
      where user_id=v_tx.user_id;
    insert into public.client_wallet_ledger(
      user_id,reference_id,actor_user_id,entry_type,direction,amount,
      balance_before,balance_after,note
    ) values (
      v_tx.user_id,v_tx.id,auth.uid(),'withdrawal_debit','debit',
      v_tx.amount_usd,v_before,v_before-v_tx.amount_usd,
      'Admin-confirmed payout · '||trim(p_payout_reference)
    );
  else
    select * into v_acc from public.trading_accounts
      where id=v_tx.account_id for update;
    if not found or v_acc.user_id<>v_tx.user_id or v_acc.account_mode<>'real'
      or v_acc.status<>'approved' or v_acc.archived_at is not null
      or v_acc.deleted_at is not null or v_acc.currency<>'USD' then
      raise exception 'Real account validation failed';
    end if;
    select coalesce(sum(margin_used),0),coalesce(sum(floating_pnl),0)
      into v_margin,v_float
      from public.bb_bbook_positions where account_id=v_acc.id and status='OPEN';
    if v_acc.balance+v_float-v_margin<v_tx.amount_usd then
      raise exception 'Free margin is no longer sufficient to complete the payout';
    end if;
    v_before:=v_acc.balance;
    update public.trading_accounts set balance=balance-v_tx.amount_usd,updated_at=now()
      where id=v_acc.id;
    insert into public.account_balance_ledger(
      account_id,user_id,transaction_id,actor_user_id,entry_type,
      amount,balance_before,balance_after,note
    ) values (
      v_acc.id,v_tx.user_id,v_tx.id,auth.uid(),'withdrawal_debit',
      v_tx.amount_usd,v_before,v_before-v_tx.amount_usd,
      'Admin-confirmed external payout: '||trim(p_payout_reference)
    );
  end if;

  select * into v_pool from public.bb_bbook_liquidity_pool
    where singleton=true for update;
  if not found then raise exception 'Master B-Book pool is unavailable'; end if;
  if v_tx.pool_reserved_amount>0 and v_tx.pool_reserved_amount<>v_tx.amount_usd then
    raise exception 'Reserved pool amount does not match withdrawal amount';
  end if;
  if v_tx.pool_reserved_amount>v_pool.reserved_payout then
    raise exception 'Pool reservation ledger mismatch; payout completion blocked';
  end if;
  v_reserved_after:=v_pool.reserved_payout-v_tx.pool_reserved_amount;
  if v_pool.capital_balance-v_tx.amount_usd-v_reserved_after<0 then
    raise exception 'Master B-Book pool cannot cover this payout after reservations';
  end if;

  update public.bb_bbook_liquidity_pool
    set capital_balance=capital_balance-v_tx.amount_usd,
        reserved_payout=v_reserved_after,updated_at=now()
    where singleton=true;
  insert into public.bb_bbook_liquidity_ledger(
    entry_type,direction,amount,balance_before,balance_after,
    reserved_before,reserved_after,actor_user_id,note
  ) values (
    'WITHDRAWAL','DEBIT',v_tx.amount_usd,
    v_pool.capital_balance,v_pool.capital_balance-v_tx.amount_usd,
    v_pool.reserved_payout,v_reserved_after,auth.uid(),
    'Client withdrawal paid · '||coalesce(v_tx.invoice_id,v_tx.id::text)||' · '||trim(p_payout_reference)
  );

  update public.wallet_transactions
    set status='completed',payout_reference=trim(p_payout_reference),
        completed_at=now(),pool_reserved_amount=0
    where id=v_tx.id;
  insert into public.admin_audit_logs(actor_user_id,action,entity_type,entity_id,details)
    values(auth.uid(),'withdrawal_completed','wallet_transaction',v_tx.id::text,
      jsonb_build_object('invoice_id',v_tx.invoice_id,'payout_reference',p_payout_reference,
        'amount_usd',v_tx.amount_usd,'account_id',v_tx.account_id,
        'pool_debit',v_tx.amount_usd,'pool_balance_after',v_pool.capital_balance-v_tx.amount_usd));
end;
$function$;

create or replace function public.client_funds_transfer(
  p_from_type text, p_from_account_id uuid, p_to_type text, p_to_account_id uuid,
  p_amount numeric, p_idempotency_key uuid, p_note text default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid:=auth.uid();
  v_wallet public.client_wallet_accounts%rowtype;
  v_from public.trading_accounts%rowtype;
  v_to public.trading_accounts%rowtype;
  v_transfer_id uuid;
  v_from_before numeric(18,2);
  v_to_before numeric(18,2);
  v_reserved numeric(18,2):=0;
  v_margin numeric(18,2):=0;
  v_float numeric(18,2):=0;
  v_existing uuid;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not public.private_client_wallet_kyc_allowed(v_user) then
    raise exception 'KYC approval required before moving Real funds';
  end if;
  if p_from_type not in ('wallet','account') or p_to_type not in ('wallet','account')
    or (p_from_type='wallet' and p_to_type='wallet')
    or (p_from_type='account' and p_from_account_id is null)
    or (p_to_type='account' and p_to_account_id is null)
    or (p_from_type='wallet' and p_from_account_id is not null)
    or (p_to_type='wallet' and p_to_account_id is not null) then
    raise exception 'Invalid transfer route';
  end if;
  if p_from_type='account' and p_to_type='account' and p_from_account_id=p_to_account_id then
    raise exception 'Choose two different accounts';
  end if;
  if p_amount is null or p_amount::text in ('NaN','Infinity','-Infinity')
    or p_amount<=0 or round(p_amount,2)<>p_amount then
    raise exception 'Enter a valid finite USD amount with up to two decimals';
  end if;
  if p_idempotency_key is null then raise exception 'Transfer reference is required'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user::text||p_idempotency_key::text,0));
  select id into v_existing from public.client_fund_transfers
    where user_id=v_user and idempotency_key=p_idempotency_key;
  if v_existing is not null then return v_existing; end if;

  insert into public.client_wallet_accounts(user_id,currency,balance)
    values(v_user,'USD',0) on conflict(user_id) do nothing;

  if p_from_type='account' and p_to_type='account' then
    perform 1 from public.trading_accounts
      where id in (p_from_account_id,p_to_account_id) order by id for update;
  elsif p_from_type='account' then
    perform 1 from public.trading_accounts where id=p_from_account_id for update;
  elsif p_to_type='account' then
    perform 1 from public.trading_accounts where id=p_to_account_id for update;
  end if;

  if p_from_type='account' then
    select * into v_from from public.trading_accounts
      where id=p_from_account_id and user_id=v_user;
    if not found or v_from.account_mode<>'real' or v_from.status<>'approved'
      or v_from.currency<>'USD' or v_from.archived_at is not null or v_from.deleted_at is not null then
      raise exception 'Source must be your active, approved Real USD account';
    end if;
    select coalesce(sum(amount_usd),0) into v_reserved
      from public.wallet_transactions where account_id=v_from.id
        and kind='withdrawal' and status='processing';
    select coalesce(sum(margin_used),0),coalesce(sum(floating_pnl),0)
      into v_margin,v_float from public.bb_bbook_positions
      where account_id=v_from.id and status='OPEN';
    if v_from.balance+v_float-v_margin-v_reserved<p_amount then
      raise exception 'Insufficient free margin after reserved withdrawals and open positions';
    end if;
  end if;

  if p_to_type='account' then
    select * into v_to from public.trading_accounts
      where id=p_to_account_id and user_id=v_user;
    if not found or v_to.account_mode<>'real' or v_to.status<>'approved'
      or v_to.currency<>'USD' or v_to.archived_at is not null or v_to.deleted_at is not null then
      raise exception 'Destination must be your active, approved Real USD account';
    end if;
  end if;

  select * into v_wallet from public.client_wallet_accounts
    where user_id=v_user for update;
  if p_from_type='wallet' then
    select coalesce(sum(amount_usd),0) into v_reserved
      from public.wallet_transactions where user_id=v_user and account_id is null
        and kind='withdrawal' and status='processing';
    if v_wallet.balance-v_reserved<p_amount then
      raise exception 'Insufficient Main Wallet balance after reserved withdrawals';
    end if;
  end if;

  if p_from_type='account' then
    v_from_before:=v_from.balance;
    update public.trading_accounts set balance=balance-p_amount where id=v_from.id;
  end if;
  if p_to_type='account' then
    v_to_before:=v_to.balance;
    update public.trading_accounts set balance=balance+p_amount where id=v_to.id;
  end if;

  insert into public.client_fund_transfers(
    user_id,idempotency_key,from_type,from_account_id,to_type,to_account_id,amount
  ) values(v_user,p_idempotency_key,p_from_type,p_from_account_id,p_to_type,p_to_account_id,p_amount)
  returning id into v_transfer_id;

  if p_from_type='wallet' then
    update public.client_wallet_accounts set balance=balance-p_amount,updated_at=now()
      where user_id=v_user;
    insert into public.client_wallet_ledger(
      user_id,reference_id,actor_user_id,entry_type,direction,amount,balance_before,balance_after,note
    ) values(v_user,v_transfer_id,v_user,'internal_transfer_out','debit',p_amount,
      v_wallet.balance,v_wallet.balance-p_amount,coalesce(nullif(trim(p_note),''),'Transfer to trading account'));
  elsif p_to_type='wallet' then
    update public.client_wallet_accounts set balance=balance+p_amount,updated_at=now()
      where user_id=v_user;
    insert into public.client_wallet_ledger(
      user_id,reference_id,actor_user_id,entry_type,direction,amount,balance_before,balance_after,note
    ) values(v_user,v_transfer_id,v_user,'internal_transfer_in','credit',p_amount,
      v_wallet.balance,v_wallet.balance+p_amount,coalesce(nullif(trim(p_note),''),'Transfer from trading account'));
  end if;

  if p_from_type='account' then
    insert into public.account_balance_ledger(
      account_id,user_id,actor_user_id,entry_type,amount,balance_before,balance_after,note
    ) values(v_from.id,v_user,v_user,'transfer_debit',p_amount,v_from_before,
      v_from_before-p_amount,coalesce(nullif(trim(p_note),''),'Instant transfer · '||v_transfer_id::text));
  end if;
  if p_to_type='account' then
    insert into public.account_balance_ledger(
      account_id,user_id,actor_user_id,entry_type,amount,balance_before,balance_after,note
    ) values(v_to.id,v_user,v_user,'transfer_credit',p_amount,v_to_before,
      v_to_before+p_amount,coalesce(nullif(trim(p_note),''),'Instant transfer · '||v_transfer_id::text));
  end if;
  return v_transfer_id;
end;
$function$;

create or replace function public.bb_bbook_open_position(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = 'public','pg_temp'
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
  v_sl numeric := (p->>'stop_loss')::numeric;
  v_tp numeric := (p->>'take_profit')::numeric;
  v_contract numeric := (p->>'contract_size')::numeric;
  v_settings public.bb_bbook_settings%rowtype;
  v_exec public.bb_execution_settings%rowtype;
  v_pool public.bb_bbook_liquidity_pool%rowtype;
  v_acc public.trading_accounts%rowtype;
  v_lev integer;
  v_entry numeric;
  v_margin numeric;
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
    or coalesce(v_ask,0)<=0 or coalesce(v_contract,0)<=0
    or coalesce(v_sl,0)<=0 or coalesce(v_tp,0)<=0 then
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
  if (v_side='BUY' and (v_sl>=v_entry or v_tp<=v_entry))
    or (v_side='SELL' and (v_sl<=v_entry or v_tp>=v_entry)) then
    raise exception 'SL/TP levels are invalid for the selected side';
  end if;

  v_margin:=case when v_symbol='USDJPY' then (v_qty*v_contract)/v_lev
    else (v_entry*v_qty*v_contract)/v_lev end;
  v_reserve:=greatest(0,(case when v_side='BUY' then v_tp-v_entry else v_entry-v_tp end)*v_qty*v_contract);
  if v_symbol='USDJPY' then v_reserve:=v_reserve/v_tp; end if;
  v_exposure:=case when v_symbol='USDJPY' then v_qty*v_contract else v_entry*v_qty*v_contract end;

  select count(*),coalesce(sum(margin_used),0),coalesce(sum(floating_pnl),0)
    into v_open_count,v_used,v_float
    from public.bb_bbook_positions where account_id=v_account and status='OPEN';
  select coalesce(sum(amount_usd),0) into v_reserved_withdrawals
    from public.wallet_transactions where account_id=v_account
      and kind='withdrawal' and status='processing';

  if v_open_count>=v_settings.max_open_positions then raise exception 'Maximum open positions reached'; end if;
  if v_exposure>v_settings.max_account_exposure then raise exception 'Order exceeds account exposure limit'; end if;
  if v_acc.balance+v_float-v_used-v_reserved_withdrawals<v_margin then
    raise exception 'Insufficient free margin after reserved withdrawals';
  end if;
  if v_pool.capital_balance-v_pool.reserved_payout<v_reserve then
    raise exception 'House liquidity is insufficient to reserve the maximum TP payout';
  end if;

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
      'entry_price',v_entry,'margin',v_margin,'leverage',v_lev)
  );
  return jsonb_build_object('position',to_jsonb(v_position),'execution_mode','BBOOK');
end;
$function$;

revoke all on function public.admin_review_wallet_transaction(uuid,text,text) from public, anon;
grant execute on function public.admin_review_wallet_transaction(uuid,text,text) to authenticated;
revoke all on function public.admin_complete_withdrawal(uuid,text) from public, anon;
grant execute on function public.admin_complete_withdrawal(uuid,text) to authenticated;
revoke all on function public.client_funds_transfer(text,uuid,text,uuid,numeric,uuid,text) from public, anon;
grant execute on function public.client_funds_transfer(text,uuid,text,uuid,numeric,uuid,text) to authenticated;
revoke all on function public.bb_bbook_open_position(jsonb) from public, anon, authenticated;
grant execute on function public.bb_bbook_open_position(jsonb) to service_role;

