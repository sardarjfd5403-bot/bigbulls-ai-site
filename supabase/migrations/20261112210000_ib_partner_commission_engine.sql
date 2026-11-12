-- BIGBULLS IB commission, wallet, payout and partner management.
-- This extends the existing referral/application tables and leaves B-Book execution controls untouched.

alter table public.partner_applications
  add column if not exists tier text not null default 'bronze';
alter table public.partner_applications
  add column if not exists notes text;

alter table public.partner_applications
  drop constraint if exists partner_applications_tier_check;
alter table public.partner_applications
  add constraint partner_applications_tier_check
  check (tier in ('bronze','silver','gold','diamond'));

alter table public.partner_commission_ledger
  add column if not exists trade_id uuid,
  add column if not exists account_id uuid,
  add column if not exists symbol text,
  add column if not exists masked_account text,
  add column if not exists commission_rate numeric(18,4),
  add column if not exists tier text,
  add column if not exists entry_source text not null default 'manual';

alter table public.partner_commission_ledger
  drop constraint if exists partner_commission_ledger_status_check;
alter table public.partner_commission_ledger
  add constraint partner_commission_ledger_status_check
  check (status in ('pending','approved','credited','paid','rejected'));

create unique index if not exists partner_commission_trade_once_idx
  on public.partner_commission_ledger(partner_user_id, trade_id)
  where trade_id is not null;
create index if not exists partner_commission_account_created_idx
  on public.partner_commission_ledger(account_id, created_at desc)
  where account_id is not null;

create table if not exists public.partner_commission_rates (
  tier text primary key check (tier in ('bronze','silver','gold','diamond')),
  commission_per_lot numeric(18,4) not null check (commission_per_lot >= 0 and commission_per_lot <= 1000),
  enabled boolean not null default true,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

insert into public.partner_commission_rates(tier, commission_per_lot)
values ('bronze',3),('silver',4),('gold',5),('diamond',6)
on conflict (tier) do nothing;

create table if not exists public.partner_wallet_accounts (
  partner_user_id uuid primary key references auth.users(id) on delete cascade,
  currency text not null default 'USD' check (currency = 'USD'),
  available_balance numeric(20,2) not null default 0 check (available_balance >= 0),
  total_earned numeric(20,2) not null default 0 check (total_earned >= 0),
  total_paid numeric(20,2) not null default 0 check (total_paid >= 0),
  total_transferred numeric(20,2) not null default 0 check (total_transferred >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.partner_wallet_ledger (
  id uuid primary key default gen_random_uuid(),
  partner_user_id uuid not null references auth.users(id) on delete cascade,
  reference_id uuid,
  actor_user_id uuid references auth.users(id),
  entry_type text not null check (entry_type in ('commission_credit','manual_credit','manual_debit','payout_hold','payout_refund','payout_paid','internal_transfer')),
  direction text not null check (direction in ('credit','debit')),
  amount numeric(20,2) not null check (amount > 0),
  balance_before numeric(20,2) not null check (balance_before >= 0),
  balance_after numeric(20,2) not null check (balance_after >= 0),
  note text,
  created_at timestamptz not null default now()
);
create index if not exists partner_wallet_ledger_partner_created_idx
  on public.partner_wallet_ledger(partner_user_id, created_at desc);

create table if not exists public.partner_payout_requests (
  id uuid primary key default gen_random_uuid(),
  partner_user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(20,2) not null check (amount > 0),
  payout_method text not null check (payout_method in ('bank','crypto','other')),
  destination text not null check (length(trim(destination)) between 4 and 500),
  status text not null default 'pending' check (status in ('pending','paid','rejected')),
  admin_note text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists partner_payout_status_created_idx
  on public.partner_payout_requests(status, created_at desc);
create index if not exists partner_payout_partner_created_idx
  on public.partner_payout_requests(partner_user_id, created_at desc);

create table if not exists public.partner_wallet_transfers (
  id uuid primary key default gen_random_uuid(),
  partner_user_id uuid not null references auth.users(id) on delete cascade,
  trading_account_id uuid not null references public.trading_accounts(id),
  amount numeric(20,2) not null check (amount > 0),
  account_balance_before numeric(20,2) not null,
  account_balance_after numeric(20,2) not null,
  created_at timestamptz not null default now()
);
create index if not exists partner_wallet_transfers_partner_created_idx
  on public.partner_wallet_transfers(partner_user_id, created_at desc);

alter table public.partner_commission_rates enable row level security;
alter table public.partner_wallet_accounts enable row level security;
alter table public.partner_wallet_ledger enable row level security;
alter table public.partner_payout_requests enable row level security;
alter table public.partner_wallet_transfers enable row level security;

drop policy if exists partner_rates_read_authenticated on public.partner_commission_rates;
create policy partner_rates_read_authenticated on public.partner_commission_rates
  for select to authenticated using (true);

drop policy if exists partner_wallet_owner_admin_read on public.partner_wallet_accounts;
create policy partner_wallet_owner_admin_read on public.partner_wallet_accounts
  for select to authenticated using (partner_user_id = (select auth.uid()) or (select public.is_bigbulls_admin()));

drop policy if exists partner_wallet_ledger_owner_admin_read on public.partner_wallet_ledger;
create policy partner_wallet_ledger_owner_admin_read on public.partner_wallet_ledger
  for select to authenticated using (partner_user_id = (select auth.uid()) or (select public.is_bigbulls_admin()));

drop policy if exists partner_payout_owner_admin_read on public.partner_payout_requests;
create policy partner_payout_owner_admin_read on public.partner_payout_requests
  for select to authenticated using (partner_user_id = (select auth.uid()) or (select public.is_bigbulls_admin()));

drop policy if exists partner_transfer_owner_admin_read on public.partner_wallet_transfers;
create policy partner_transfer_owner_admin_read on public.partner_wallet_transfers
  for select to authenticated using (partner_user_id = (select auth.uid()) or (select public.is_bigbulls_admin()));

revoke insert, update, delete on public.partner_commission_rates,
  public.partner_wallet_accounts, public.partner_wallet_ledger,
  public.partner_payout_requests, public.partner_wallet_transfers
  from anon, authenticated;
grant select on public.partner_commission_rates, public.partner_wallet_accounts,
  public.partner_wallet_ledger, public.partner_payout_requests,
  public.partner_wallet_transfers to authenticated;

alter table public.account_balance_ledger
  drop constraint if exists account_balance_ledger_entry_type_check;
alter table public.account_balance_ledger
  add constraint account_balance_ledger_entry_type_check
  check (entry_type = any (array[
    'deposit_credit','withdrawal_debit','admin_credit','admin_debit',
    'transfer_credit','transfer_debit','ib_commission_transfer'
  ]));

create or replace function public.assign_partner_referral_code()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
declare
  v_candidate text;
begin
  if new.status='approved' and old.status is distinct from 'approved' and new.referral_code is null then
    loop
      v_candidate := 'BB-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
      exit when not exists(select 1 from public.partner_applications where referral_code=v_candidate);
    end loop;
    new.referral_code := v_candidate;
  end if;
  return new;
end;
$function$;

create or replace function private.activate_bigbulls_ib_after_kyc()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $function$
declare
  v_code text;
begin
  if new.status <> 'approved' then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'approved' then return new; end if;

  loop
    v_code := 'BB-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
    exit when not exists(select 1 from public.partner_applications where referral_code=v_code);
  end loop;

  insert into public.partner_applications(user_id,partner_type,status,referral_code,reviewed_at,tier)
  values(new.user_id,'IB','approved',v_code,now(),'bronze')
  on conflict(user_id) do update
    set status='approved',
        referral_code=coalesce(public.partner_applications.referral_code,excluded.referral_code),
        reviewed_at=now();
  return new;
end;
$function$;
revoke all on function private.activate_bigbulls_ib_after_kyc() from public, anon, authenticated;

create or replace function private.credit_ib_commission_on_bbook_close()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $function$
declare
  v_partner uuid;
  v_tier text;
  v_rate numeric(18,4);
  v_commission numeric(20,2);
  v_wallet public.partner_wallet_accounts%rowtype;
  v_ledger_id uuid;
  v_account_number text;
begin
  if old.status is not distinct from new.status
     or new.status <> 'CLOSED'
     or new.account_mode <> 'real'
     or new.execution_mode <> 'BBOOK'
     or coalesce(new.quantity,0) <= 0 then
    return new;
  end if;

  select r.partner_user_id, pa.tier, cr.commission_per_lot
    into v_partner, v_tier, v_rate
    from public.partner_referrals r
    join public.partner_applications pa
      on pa.user_id = r.partner_user_id and pa.status = 'approved'
    join public.partner_commission_rates cr
      on cr.tier = pa.tier and cr.enabled = true
   where r.referred_user_id = new.user_id
   limit 1;

  if v_partner is null or coalesce(v_rate,0) <= 0 then
    return new;
  end if;

  v_commission := round(new.quantity * v_rate, 2);
  if v_commission <= 0 then return new; end if;

  select account_number::text into v_account_number
    from public.trading_accounts where id = new.account_id and user_id = new.user_id;

  insert into public.partner_wallet_accounts(partner_user_id)
  values(v_partner) on conflict(partner_user_id) do nothing;

  select * into v_wallet
    from public.partner_wallet_accounts
   where partner_user_id = v_partner
   for update;

  insert into public.partner_commission_ledger(
    partner_user_id,referred_user_id,source_reference,verified_lots,commission_usd,
    status,trade_id,account_id,symbol,masked_account,commission_rate,tier,entry_source
  ) values (
    v_partner,new.user_id,'BBOOK:' || new.id::text,new.quantity,v_commission,
    'credited',new.id,new.account_id,new.symbol,
    case when v_account_number is null then 'Account ••••' else 'Account ••••' || right(v_account_number,4) end,
    v_rate,v_tier,'bbook_trade_close'
  )
  on conflict (partner_user_id,trade_id) where trade_id is not null do nothing
  returning id into v_ledger_id;

  if v_ledger_id is null then return new; end if;

  update public.partner_wallet_accounts
     set available_balance = available_balance + v_commission,
         total_earned = total_earned + v_commission,
         updated_at = now()
   where partner_user_id = v_partner
   returning * into v_wallet;

  insert into public.partner_wallet_ledger(
    partner_user_id,reference_id,actor_user_id,entry_type,direction,amount,
    balance_before,balance_after,note
  ) values (
    v_partner,v_ledger_id,new.user_id,'commission_credit','credit',v_commission,
    v_wallet.available_balance - v_commission,v_wallet.available_balance,
    'B-Book trade close · ' || new.symbol || ' · ' || new.quantity::text || ' lots'
  );

  return new;
end;
$function$;
revoke all on function private.credit_ib_commission_on_bbook_close() from public, anon, authenticated;

drop trigger if exists trg_credit_ib_commission_on_bbook_close on public.bb_bbook_positions;
create trigger trg_credit_ib_commission_on_bbook_close
after update of status on public.bb_bbook_positions
for each row
when (old.status is distinct from new.status and new.status = 'CLOSED')
execute function private.credit_ib_commission_on_bbook_close();

create or replace function public.partner_dashboard_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $function$
declare
  v_user uuid := auth.uid();
  v_partner public.partner_applications%rowtype;
  v_wallet public.partner_wallet_accounts%rowtype;
  v_result jsonb;
begin
  if v_user is null then raise exception 'Authentication required'; end if;

  select * into v_partner from public.partner_applications where user_id=v_user;
  if not found then
    return jsonb_build_object('partner',null,'wallet',jsonb_build_object('available_balance',0,'total_earned',0),
      'metrics',jsonb_build_object('active_clients',0,'total_referred',0,'total_lots',0),
      'referrals','[]'::jsonb,'commissions','[]'::jsonb,'payouts','[]'::jsonb,'transfers','[]'::jsonb);
  end if;

  select * into v_wallet from public.partner_wallet_accounts where partner_user_id=v_user;
  select jsonb_build_object(
    'partner',jsonb_build_object('status',v_partner.status,'tier',v_partner.tier,'referral_code',v_partner.referral_code),
    'wallet',jsonb_build_object(
      'available_balance',coalesce(v_wallet.available_balance,0),
      'total_earned',coalesce(v_wallet.total_earned,0),
      'total_paid',coalesce(v_wallet.total_paid,0),
      'total_transferred',coalesce(v_wallet.total_transferred,0)
    ),
    'metrics',jsonb_build_object(
      'active_clients',(select count(*) from public.partner_referrals r
        where r.partner_user_id=v_user and exists(
          select 1 from public.trading_accounts a where a.user_id=r.referred_user_id
            and a.account_mode='real' and a.status='approved' and a.archived_at is null and a.deleted_at is null)),
      'total_referred',(select count(*) from public.partner_referrals where partner_user_id=v_user),
      'total_lots',coalesce((select sum(c.verified_lots) from public.partner_commission_ledger c
        where c.partner_user_id=v_user and c.entry_source='bbook_trade_close'),0)
    ),
    'referrals',coalesce((
      select jsonb_agg(jsonb_build_object(
        'masked_email',case when u.email is null then 'Client' else
          left(split_part(u.email,'@',1),2) || '***@' || split_part(u.email,'@',2) end,
        'joined_at',r.created_at,
        'total_lots',coalesce(x.total_lots,0),
        'commission_usd',coalesce(x.commission_usd,0),
        'active',exists(select 1 from public.trading_accounts a where a.user_id=r.referred_user_id
          and a.account_mode='real' and a.status='approved' and a.archived_at is null and a.deleted_at is null)
      ) order by r.created_at desc)
      from public.partner_referrals r
      left join auth.users u on u.id=r.referred_user_id
      left join lateral (
        select sum(c.verified_lots) total_lots,sum(c.commission_usd) commission_usd
          from public.partner_commission_ledger c
         where c.partner_user_id=v_user and c.referred_user_id=r.referred_user_id
           and c.entry_source='bbook_trade_close'
      ) x on true
      where r.partner_user_id=v_user
    ),'[]'::jsonb),
    'commissions',coalesce((
      select jsonb_agg(jsonb_build_object(
        'masked_account',c.masked_account,'symbol',c.symbol,'lots',c.verified_lots,
        'commission_usd',c.commission_usd,'status',c.status,'created_at',c.created_at
      ) order by c.created_at desc)
      from public.partner_commission_ledger c
      where c.partner_user_id=v_user and c.entry_source='bbook_trade_close'
      limit 100
    ),'[]'::jsonb),
    'payouts',coalesce((
      select jsonb_agg(jsonb_build_object('id',p.id,'amount',p.amount,'method',p.payout_method,
        'status',p.status,'created_at',p.created_at,'admin_note',p.admin_note)
        order by p.created_at desc)
      from public.partner_payout_requests p where p.partner_user_id=v_user
    ),'[]'::jsonb),
    'transfers',coalesce((
      select jsonb_agg(jsonb_build_object('id',t.id,'amount',t.amount,'created_at',t.created_at,
        'account_id',t.trading_account_id) order by t.created_at desc)
      from public.partner_wallet_transfers t where t.partner_user_id=v_user
    ),'[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$function$;

create or replace function public.partner_transfer_to_real_account(
  p_account_id uuid, p_amount numeric, p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $function$
declare
  v_user uuid := auth.uid();
  v_wallet public.partner_wallet_accounts%rowtype;
  v_account public.trading_accounts%rowtype;
  v_transfer uuid;
  v_before numeric(20,2);
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_amount is null or p_amount::text in ('NaN','Infinity','-Infinity') or p_amount<=0 or round(p_amount,2)<>p_amount then
    raise exception 'Enter a valid positive USD amount with up to two decimals';
  end if;
  if not exists(select 1 from public.partner_applications where user_id=v_user and status='approved') then
    raise exception 'Active approved IB partner status is required';
  end if;

  select * into v_wallet from public.partner_wallet_accounts where partner_user_id=v_user for update;
  if not found or v_wallet.available_balance < p_amount then raise exception 'Insufficient IB Wallet balance'; end if;

  select * into v_account from public.trading_accounts
   where id=p_account_id and user_id=v_user and account_mode='real'
     and status='approved' and currency='USD' and archived_at is null and deleted_at is null
   for update;
  if not found then raise exception 'Choose your active approved Real USD trading account'; end if;

  v_before := v_account.balance;
  update public.trading_accounts set balance=balance+p_amount,updated_at=now()
   where id=v_account.id;

  update public.partner_wallet_accounts
    set available_balance=available_balance-p_amount,
        total_transferred=total_transferred+p_amount,updated_at=now()
   where partner_user_id=v_user;

  insert into public.partner_wallet_transfers(partner_user_id,trading_account_id,amount,account_balance_before,account_balance_after)
  values(v_user,v_account.id,p_amount,v_before,v_before+p_amount) returning id into v_transfer;

  insert into public.account_balance_ledger(account_id,user_id,actor_user_id,entry_type,amount,balance_before,balance_after,note)
  values(v_account.id,v_user,v_user,'ib_commission_transfer',p_amount,v_before,v_before+p_amount,
    coalesce(nullif(trim(p_note),''),'IB commission wallet transfer'));

  insert into public.partner_wallet_ledger(partner_user_id,reference_id,actor_user_id,entry_type,direction,amount,balance_before,balance_after,note)
  values(v_user,v_transfer,v_user,'internal_transfer','debit',p_amount,v_wallet.available_balance,
    v_wallet.available_balance-p_amount,'Transfer to Real trading account #'||coalesce(v_account.account_number::text,'—'));

  return v_transfer;
end;
$function$;

create or replace function public.partner_request_payout(
  p_amount numeric, p_payout_method text, p_destination text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $function$
declare
  v_user uuid := auth.uid();
  v_wallet public.partner_wallet_accounts%rowtype;
  v_request uuid;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_amount is null or p_amount::text in ('NaN','Infinity','-Infinity') or p_amount<=0 or round(p_amount,2)<>p_amount then
    raise exception 'Enter a valid positive USD amount with up to two decimals';
  end if;
  if p_payout_method not in ('bank','crypto','other') or length(trim(coalesce(p_destination,'')))<4 or length(p_destination)>500 then
    raise exception 'Enter a valid payout method and destination';
  end if;
  if not exists(select 1 from public.partner_applications where user_id=v_user and status='approved') then
    raise exception 'Active approved IB partner status is required';
  end if;
  select * into v_wallet from public.partner_wallet_accounts where partner_user_id=v_user for update;
  if not found or v_wallet.available_balance < p_amount then raise exception 'Insufficient IB Wallet balance'; end if;

  update public.partner_wallet_accounts set available_balance=available_balance-p_amount,updated_at=now()
   where partner_user_id=v_user;
  insert into public.partner_payout_requests(partner_user_id,amount,payout_method,destination)
  values(v_user,p_amount,p_payout_method,trim(p_destination)) returning id into v_request;
  insert into public.partner_wallet_ledger(partner_user_id,reference_id,actor_user_id,entry_type,direction,amount,balance_before,balance_after,note)
  values(v_user,v_request,v_user,'payout_hold','debit',p_amount,v_wallet.available_balance,
    v_wallet.available_balance-p_amount,'IB payout request submitted');
  return v_request;
end;
$function$;

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
  if auth.uid() is null or not public.is_bigbulls_admin() then raise exception 'Admin permission required'; end if;
  if p_status not in ('paid','rejected') then raise exception 'Payout status must be paid or rejected'; end if;
  if p_status='rejected' and length(trim(coalesce(p_admin_note,'')))<4 then raise exception 'A clear payout rejection reason is required'; end if;
  select * into v_request from public.partner_payout_requests where id=p_request_id and status='pending' for update;
  if not found then raise exception 'Pending IB payout request not found'; end if;

  if p_status='rejected' then
    select * into v_wallet from public.partner_wallet_accounts where partner_user_id=v_request.partner_user_id for update;
    update public.partner_wallet_accounts set available_balance=available_balance+v_request.amount,updated_at=now()
     where partner_user_id=v_request.partner_user_id returning * into v_wallet;
    insert into public.partner_wallet_ledger(partner_user_id,reference_id,actor_user_id,entry_type,direction,amount,balance_before,balance_after,note)
    values(v_request.partner_user_id,v_request.id,auth.uid(),'payout_refund','credit',v_request.amount,
      v_wallet.available_balance-v_request.amount,v_wallet.available_balance,'IB payout rejected · funds returned');
  else
    update public.partner_wallet_accounts set total_paid=total_paid+v_request.amount,updated_at=now()
     where partner_user_id=v_request.partner_user_id;
    select * into v_wallet from public.partner_wallet_accounts where partner_user_id=v_request.partner_user_id;
    insert into public.partner_wallet_ledger(partner_user_id,reference_id,actor_user_id,entry_type,direction,amount,balance_before,balance_after,note)
    values(v_request.partner_user_id,v_request.id,auth.uid(),'payout_paid','debit',v_request.amount,
      v_wallet.available_balance,v_wallet.available_balance,'IB payout marked paid by Admin');
  end if;

  update public.partner_payout_requests
     set status=p_status,admin_note=nullif(trim(coalesce(p_admin_note,'')),''),reviewed_by=auth.uid(),
         reviewed_at=now(),paid_at=case when p_status='paid' then now() else null end
   where id=p_request_id;
end;
$function$;

create or replace function public.admin_update_partner_commission_rate(
  p_tier text, p_commission_per_lot numeric, p_enabled boolean default true
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $function$
begin
  if auth.uid() is null or not public.is_bigbulls_admin() then raise exception 'Admin permission required'; end if;
  if p_tier not in ('bronze','silver','gold','diamond') or p_commission_per_lot is null
     or p_commission_per_lot::text in ('NaN','Infinity','-Infinity')
     or p_commission_per_lot<0 or p_commission_per_lot>1000 then
    raise exception 'Invalid tier or commission rate';
  end if;
  insert into public.partner_commission_rates(tier,commission_per_lot,enabled,updated_by,updated_at)
  values(p_tier,p_commission_per_lot,p_enabled,auth.uid(),now())
  on conflict(tier) do update set commission_per_lot=excluded.commission_per_lot,
    enabled=excluded.enabled,updated_by=excluded.updated_by,updated_at=now();
end;
$function$;

create or replace function public.admin_set_partner_status(
  p_partner_user_id uuid, p_status text, p_tier text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $function$
begin
  if auth.uid() is null or not public.is_bigbulls_admin() then raise exception 'Admin permission required'; end if;
  if p_status not in ('approved','disabled') then raise exception 'Partner status must be approved or disabled'; end if;
  if p_tier is not null and p_tier not in ('bronze','silver','gold','diamond') then raise exception 'Invalid partner tier'; end if;
  update public.partner_applications
    set status=p_status,tier=coalesce(p_tier,tier),
        reviewed_by=auth.uid(),reviewed_at=now()
  where user_id=p_partner_user_id;
  if not found then raise exception 'Partner application not found'; end if;
  insert into public.admin_audit_logs(actor_user_id,action,entity_type,entity_id,details)
  values(auth.uid(),'partner_status_'||p_status,'partner_application',p_partner_user_id::text,
    jsonb_build_object('tier',p_tier));
end;
$function$;

create or replace function public.admin_adjust_partner_wallet(
  p_partner_user_id uuid, p_direction text, p_amount numeric, p_note text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $function$
declare
  v_wallet public.partner_wallet_accounts%rowtype;
  v_after numeric(20,2);
  v_type text;
begin
  if auth.uid() is null or not public.is_bigbulls_admin() then raise exception 'Admin permission required'; end if;
  if p_direction not in ('credit','debit') or p_amount is null
     or p_amount::text in ('NaN','Infinity','-Infinity') or p_amount<=0
     or round(p_amount,2)<>p_amount or length(trim(coalesce(p_note,'')))<4 then
    raise exception 'Enter a valid adjustment direction, amount and audit note';
  end if;
  insert into public.partner_wallet_accounts(partner_user_id) values(p_partner_user_id)
  on conflict(partner_user_id) do nothing;
  select * into v_wallet from public.partner_wallet_accounts where partner_user_id=p_partner_user_id for update;
  v_after := case when p_direction='credit' then v_wallet.available_balance+p_amount else v_wallet.available_balance-p_amount end;
  if v_after<0 then raise exception 'IB wallet cannot become negative'; end if;
  update public.partner_wallet_accounts set available_balance=v_after,updated_at=now()
    where partner_user_id=p_partner_user_id;
  v_type := case when p_direction='credit' then 'manual_credit' else 'manual_debit' end;
  insert into public.partner_wallet_ledger(partner_user_id,actor_user_id,entry_type,direction,amount,balance_before,balance_after,note)
  values(p_partner_user_id,auth.uid(),v_type,p_direction,p_amount,v_wallet.available_balance,v_after,trim(p_note));
  insert into public.admin_audit_logs(actor_user_id,action,entity_type,entity_id,details)
  values(auth.uid(),'ib_wallet_'||p_direction,'partner_wallet',p_partner_user_id::text,
    jsonb_build_object('amount',p_amount,'balance_before',v_wallet.available_balance,'balance_after',v_after,'note',p_note));
end;
$function$;

revoke all on function public.partner_dashboard_snapshot() from public, anon;
revoke all on function public.partner_transfer_to_real_account(uuid,numeric,text) from public, anon;
revoke all on function public.partner_request_payout(numeric,text,text) from public, anon;
revoke all on function public.admin_review_partner_payout(uuid,text,text) from public, anon;
revoke all on function public.admin_update_partner_commission_rate(text,numeric,boolean) from public, anon;
revoke all on function public.admin_set_partner_status(uuid,text,text) from public, anon;
revoke all on function public.admin_adjust_partner_wallet(uuid,text,numeric,text) from public, anon;

grant execute on function public.partner_dashboard_snapshot() to authenticated;
grant execute on function public.partner_transfer_to_real_account(uuid,numeric,text) to authenticated;
grant execute on function public.partner_request_payout(numeric,text,text) to authenticated;
grant execute on function public.admin_review_partner_payout(uuid,text,text) to authenticated;
grant execute on function public.admin_update_partner_commission_rate(text,numeric,boolean) to authenticated;
grant execute on function public.admin_set_partner_status(uuid,text,text) to authenticated;
grant execute on function public.admin_adjust_partner_wallet(uuid,text,numeric,text) to authenticated;

notify pgrst, 'reload schema';
