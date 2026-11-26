-- IB deposit commission: 10% of an approved referred-client deposit.
-- Client deposit credit remains unchanged; commission is paid separately from B-Book liquidity.
create table if not exists public.partner_deposit_commissions (
  id uuid primary key default gen_random_uuid(),
  wallet_transaction_id uuid not null unique references public.wallet_transactions(id) on delete restrict,
  partner_user_id uuid not null references auth.users(id) on delete restrict,
  referred_user_id uuid not null references auth.users(id) on delete restrict,
  deposit_amount_usd numeric(18,2) not null check (deposit_amount_usd > 0),
  commission_rate numeric(7,4) not null default 10.0000 check (commission_rate = 10.0000),
  commission_amount_usd numeric(18,2) not null check (commission_amount_usd > 0),
  status text not null default 'pending_pool' check (status in ('pending_pool','paid')),
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists partner_deposit_commissions_partner_created_idx
  on public.partner_deposit_commissions(partner_user_id, created_at desc);
create index if not exists partner_deposit_commissions_status_created_idx
  on public.partner_deposit_commissions(status, created_at);
alter table public.partner_deposit_commissions enable row level security;
drop policy if exists "IB can read own deposit commissions" on public.partner_deposit_commissions;
create policy "IB can read own deposit commissions"
  on public.partner_deposit_commissions for select to authenticated
  using (partner_user_id = auth.uid() or public.is_bigbulls_admin());
grant select on public.partner_deposit_commissions to authenticated;

create or replace function public.process_pending_partner_deposit_commissions()
returns integer language plpgsql security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  v_pool public.bb_bbook_liquidity_pool%rowtype;
  v_commission public.partner_deposit_commissions%rowtype;
  v_wallet public.partner_wallet_accounts%rowtype;
  v_after numeric(20,2);
  v_paid integer := 0;
begin
  select * into v_pool from public.bb_bbook_liquidity_pool where singleton = true for update;
  if not found then return 0; end if;
  for v_commission in
    select * from public.partner_deposit_commissions
     where status = 'pending_pool' order by created_at, id for update
  loop
    exit when v_pool.capital_balance - v_pool.reserved_payout < v_commission.commission_amount_usd;
    insert into public.partner_wallet_accounts(partner_user_id)
    values (v_commission.partner_user_id) on conflict (partner_user_id) do nothing;
    select * into v_wallet from public.partner_wallet_accounts
     where partner_user_id = v_commission.partner_user_id for update;
    v_after := v_wallet.available_balance + v_commission.commission_amount_usd;
    update public.bb_bbook_liquidity_pool
       set capital_balance = capital_balance - v_commission.commission_amount_usd, updated_at = now()
     where singleton = true returning * into v_pool;
    insert into public.bb_bbook_liquidity_ledger(
      entry_type,direction,amount,balance_before,balance_after,reserved_before,reserved_after,
      actor_user_id,note,user_id,transaction_id
    ) values (
      'IB_DEPOSIT_COMMISSION','DEBIT',v_commission.commission_amount_usd,
      v_pool.capital_balance + v_commission.commission_amount_usd,v_pool.capital_balance,
      v_pool.reserved_payout,v_pool.reserved_payout,auth.uid(),
      '10% referral deposit commission · deposit ' || v_commission.wallet_transaction_id::text,
      v_commission.referred_user_id,v_commission.wallet_transaction_id
    );
    update public.partner_wallet_accounts
       set available_balance = v_after,
           total_earned = total_earned + v_commission.commission_amount_usd, updated_at = now()
     where partner_user_id = v_commission.partner_user_id;
    insert into public.partner_wallet_ledger(
      partner_user_id,reference_id,actor_user_id,entry_type,direction,amount,balance_before,balance_after,note
    ) values (
      v_commission.partner_user_id,v_commission.wallet_transaction_id,auth.uid(),
      'deposit_commission','credit',v_commission.commission_amount_usd,
      v_wallet.available_balance,v_after,
      '10% IB commission from broker liquidity pool · referred deposit ' ||
        v_commission.wallet_transaction_id::text
    );
    update public.partner_deposit_commissions set status = 'paid', paid_at = now()
     where id = v_commission.id and status = 'pending_pool';
    v_paid := v_paid + 1;
  end loop;
  return v_paid;
end;
$$;
revoke all on function public.process_pending_partner_deposit_commissions() from public, anon, authenticated;

create or replace function public.capture_partner_deposit_commission()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare v_partner uuid; v_amount numeric(18,2);
begin
  if new.kind <> 'deposit' or new.status <> 'approved' or old.status is not distinct from 'approved' then
    return new;
  end if;
  select r.partner_user_id into v_partner from public.partner_referrals r
   where r.referred_user_id = new.user_id order by r.created_at asc limit 1;
  if v_partner is null or v_partner = new.user_id then return new; end if;
  v_amount := round(new.amount_usd * 0.10, 2);
  if v_amount <= 0 then return new; end if;
  insert into public.partner_deposit_commissions(
    wallet_transaction_id,partner_user_id,referred_user_id,deposit_amount_usd,
    commission_rate,commission_amount_usd,status
  ) values (new.id,v_partner,new.user_id,new.amount_usd,10.0000,v_amount,'pending_pool')
  on conflict (wallet_transaction_id) do nothing;
  perform public.process_pending_partner_deposit_commissions();
  return new;
end;
$$;
drop trigger if exists trg_capture_partner_deposit_commission on public.wallet_transactions;
create trigger trg_capture_partner_deposit_commission
after update of status on public.wallet_transactions
for each row when (new.kind = 'deposit' and new.status = 'approved')
execute function public.capture_partner_deposit_commission();

create or replace function public.process_pending_partner_commissions_on_pool_funding()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
begin
  if new.capital_balance > old.capital_balance then
    perform public.process_pending_partner_deposit_commissions();
  end if;
  return new;
end;
$$;
drop trigger if exists trg_process_pending_partner_commissions_on_pool_funding on public.bb_bbook_liquidity_pool;
create trigger trg_process_pending_partner_commissions_on_pool_funding
after update of capital_balance on public.bb_bbook_liquidity_pool
for each row when (new.capital_balance > old.capital_balance)
execute function public.process_pending_partner_commissions_on_pool_funding();

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime'
       and schemaname = 'public' and tablename = 'partner_deposit_commissions') then
    alter publication supabase_realtime add table public.partner_deposit_commissions;
  end if;
end;
$$;
