-- BIGBULLS secure account funding workflow (migration 006)
begin;

alter table public.wallet_transactions
  add column if not exists invoice_id text,
  add column if not exists proof_path text,
  add column if not exists payout_reference text,
  add column if not exists otp_verified_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists rejection_reason text;

update public.wallet_transactions
set invoice_id='BB-'||upper(substr(replace(id::text,'-',''),1,12))
where invoice_id is null;
alter table public.wallet_transactions alter column invoice_id set default ('BB-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)));
alter table public.wallet_transactions alter column invoice_id set not null;
create unique index if not exists wallet_transactions_invoice_unique on public.wallet_transactions(invoice_id);
create index if not exists wallet_transactions_status_created_idx on public.wallet_transactions(status,created_at desc);

-- Extend status values without relying on a generated constraint name.
do $$
declare c record;
begin
 for c in select conname from pg_constraint
  where conrelid='public.wallet_transactions'::regclass and contype='c'
    and pg_get_constraintdef(oid) ilike '%status%'
 loop execute format('alter table public.wallet_transactions drop constraint %I',c.conname); end loop;
end $$;
alter table public.wallet_transactions add constraint wallet_transactions_status_check
 check(status in ('pending','otp_pending','processing','approved','rejected','completed'));

create table if not exists public.account_balance_ledger(
 id bigint generated always as identity primary key,
 account_id uuid not null references public.trading_accounts(id),
 user_id uuid not null references auth.users(id),
 transaction_id uuid references public.wallet_transactions(id),
 actor_user_id uuid references auth.users(id),
 entry_type text not null check(entry_type in ('deposit_credit','withdrawal_debit','admin_credit','admin_debit')),
 amount numeric(18,2) not null check(amount>0),
 balance_before numeric(18,2) not null,
 balance_after numeric(18,2) not null,
 note text,
 created_at timestamptz not null default now()
);
alter table public.account_balance_ledger enable row level security;
drop policy if exists "clients read own account balance ledger" on public.account_balance_ledger;
create policy "clients read own account balance ledger" on public.account_balance_ledger
 for select to authenticated using(user_id=auth.uid() or public.is_bigbulls_admin());
grant select on public.account_balance_ledger to authenticated;
revoke insert,update,delete on public.account_balance_ledger from anon,authenticated;

-- Private client payment proof storage. Admin reviews files through short-lived signed URLs.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('payment-proofs','payment-proofs',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict(id) do update set public=false,file_size_limit=10485760,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "clients upload own payment proofs" on storage.objects;
create policy "clients upload own payment proofs" on storage.objects
for insert to authenticated with check(bucket_id='payment-proofs' and split_part(name,'/',1)=auth.uid()::text);
drop policy if exists "clients read own payment proofs" on storage.objects;
create policy "clients read own payment proofs" on storage.objects
for select to authenticated using(bucket_id='payment-proofs' and (split_part(name,'/',1)=auth.uid()::text or public.is_bigbulls_admin()));

create table if not exists public.withdrawal_otp_challenges(
 id uuid primary key default gen_random_uuid(),
 transaction_id uuid not null references public.wallet_transactions(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 otp_hash text not null,
 expires_at timestamptz not null,
 attempts integer not null default 0,
 consumed_at timestamptz,
 created_at timestamptz not null default now()
);
alter table public.withdrawal_otp_challenges enable row level security;
revoke all on public.withdrawal_otp_challenges from anon,authenticated;

-- A client can submit requests, but cannot directly change a transaction or account balance.
drop policy if exists "admins review wallet transactions" on public.wallet_transactions;
revoke update on public.wallet_transactions from authenticated;
revoke update on public.trading_accounts from authenticated;
grant update(account_type,platform,currency,status,account_mode,account_number,display_name,server_name,zero_balance_since,archived_at,deleted_at) on public.trading_accounts to authenticated;

-- Expose verified account email to Admin's client-management list.
alter table public.profiles add column if not exists email text;
update public.profiles p set email=u.email from auth.users u where u.id=p.id and p.email is distinct from u.email;
create or replace function public.sync_auth_profile()
returns trigger language plpgsql security definer set search_path=public
as $$
begin
 insert into public.profiles(id,full_name,email,country,phone,account_type)
 values(new.id,new.raw_user_meta_data->>'full_name',new.email,new.raw_user_meta_data->>'country',
        new.raw_user_meta_data->>'phone',coalesce(new.raw_user_meta_data->>'account_type','Individual'))
 on conflict(id) do update set
  full_name=coalesce(excluded.full_name,public.profiles.full_name),
  email=excluded.email,country=excluded.country,phone=excluded.phone,
  account_type=excluded.account_type,updated_at=now();
 return new;
end;
$$;

drop trigger if exists bigbulls_auth_profile_sync on auth.users;
create trigger bigbulls_auth_profile_sync after insert or update of raw_user_meta_data,email on auth.users
for each row execute function public.sync_auth_profile();

-- Prevent direct client-created trading-account rows from carrying a seeded balance.
drop policy if exists "clients request own trading accounts" on public.trading_accounts;
create policy "clients request own zero-balance trading accounts" on public.trading_accounts
for insert to authenticated with check(user_id=auth.uid() and status='pending' and balance=0);

drop policy if exists "clients submit own pending wallet requests" on public.wallet_transactions;
create policy "clients submit own pending wallet requests" on public.wallet_transactions
for insert to authenticated with check(
 user_id=auth.uid() and status='pending' and reviewed_by is null and reviewed_at is null
 and account_id is not null and exists(
  select 1 from public.trading_accounts a where a.id=wallet_transactions.account_id
   and a.user_id=auth.uid() and a.archived_at is null and a.deleted_at is null
 )
 and ((kind='deposit' and tx_hash is not null and length(tx_hash)>10 and proof_path is not null and exists(
  select 1 from public.crypto_wallets w where w.active=true and w.asset=wallet_transactions.asset
   and w.network=wallet_transactions.network and w.address=wallet_transactions.destination_address
 )) or (kind='withdrawal' and destination_address is not null and length(destination_address)>5))
);

create or replace function public.admin_review_wallet_transaction(
 p_transaction_id uuid,p_status text,p_admin_note text default null
) returns void language plpgsql security definer set search_path=public
as $$
declare v_tx public.wallet_transactions%rowtype; v_acc public.trading_accounts%rowtype; v_before numeric(18,2);
begin
 if not public.is_bigbulls_admin() then raise exception 'Admin permission required'; end if;
 if p_status not in ('approved','rejected') then raise exception 'Invalid review status'; end if;
 select * into v_tx from public.wallet_transactions where id=p_transaction_id for update;
 if not found or v_tx.status not in ('pending','processing') then raise exception 'Request not found or already reviewed'; end if;
 if p_status='rejected' and length(trim(coalesce(p_admin_note,'')))<4 then
  raise exception 'Rejection reason is required (at least 4 characters)';
 end if;
 if v_tx.kind='withdrawal' and p_status='approved' then
  if v_tx.otp_verified_at is null then raise exception 'Client email OTP must be verified first'; end if;
  if v_tx.account_id is null then raise exception 'Withdrawal must be linked to a trading account'; end if;
  select * into v_acc from public.trading_accounts where id=v_tx.account_id for update;
  if not found or v_acc.user_id<>v_tx.user_id then raise exception 'Account mismatch'; end if;
  if v_acc.currency<>'USD' then raise exception 'Funding for non-USD accounts requires currency conversion setup'; end if;
  if v_acc.balance<v_tx.amount_usd then raise exception 'Insufficient account balance'; end if;
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
 jsonb_build_object('kind',v_tx.kind,'amount_usd',v_tx.amount_usd,'account_id',v_tx.account_id,'invoice_id',v_tx.invoice_id,'note',p_admin_note));
end $$;

create or replace function public.admin_complete_withdrawal(p_transaction_id uuid,p_payout_reference text)
returns void language plpgsql security definer set search_path=public
as $$
declare v_tx public.wallet_transactions%rowtype; v_acc public.trading_accounts%rowtype; v_before numeric(18,2);
begin
 if not public.is_bigbulls_admin() then raise exception 'Admin permission required'; end if;
 if length(trim(coalesce(p_payout_reference,'')))<5 then raise exception 'Payout TXID/reference is required'; end if;
 select * into v_tx from public.wallet_transactions where id=p_transaction_id for update;
 if not found or v_tx.kind<>'withdrawal' or v_tx.status<>'processing' then raise exception 'Withdrawal is not processing'; end if;
 select * into v_acc from public.trading_accounts where id=v_tx.account_id for update;
 if not found or v_acc.user_id<>v_tx.user_id or v_acc.currency<>'USD' or v_acc.balance<v_tx.amount_usd then raise exception 'Account or balance validation failed'; end if;
 v_before:=v_acc.balance;
 update public.trading_accounts set balance=balance-v_tx.amount_usd where id=v_acc.id;
 insert into public.account_balance_ledger(account_id,user_id,transaction_id,actor_user_id,entry_type,amount,balance_before,balance_after,note)
 values(v_acc.id,v_tx.user_id,v_tx.id,auth.uid(),'withdrawal_debit',v_tx.amount_usd,v_before,v_before-v_tx.amount_usd,'Admin-confirmed payout: '||p_payout_reference);
 update public.wallet_transactions set status='completed',payout_reference=trim(p_payout_reference),completed_at=now()
 where id=v_tx.id;
 insert into public.admin_audit_logs(actor_user_id,action,entity_type,entity_id,details)
 values(auth.uid(),'withdrawal_completed','wallet_transaction',v_tx.id::text,jsonb_build_object('invoice_id',v_tx.invoice_id,'payout_reference',p_payout_reference,'amount_usd',v_tx.amount_usd));
end $$;

create or replace function public.admin_adjust_account_balance(p_account_id uuid,p_amount numeric,p_note text)
returns numeric language plpgsql security definer set search_path=public
as $$
declare v_acc public.trading_accounts%rowtype; v_after numeric(18,2); v_type text;
begin
 if not public.is_bigbulls_admin() then raise exception 'Admin permission required'; end if;
 if p_amount=0 or abs(p_amount)>10000000 or length(trim(coalesce(p_note,'')))<4 then raise exception 'Valid adjustment and reason required'; end if;
 select * into v_acc from public.trading_accounts where id=p_account_id for update;
 if not found then raise exception 'Account not found'; end if;
 v_after:=v_acc.balance+p_amount;
 if v_after<0 then raise exception 'Balance cannot become negative'; end if;
 update public.trading_accounts set balance=v_after where id=p_account_id;
 v_type:=case when p_amount>0 then 'admin_credit' else 'admin_debit' end;
 insert into public.account_balance_ledger(account_id,user_id,actor_user_id,entry_type,amount,balance_before,balance_after,note)
 values(v_acc.id,v_acc.user_id,auth.uid(),v_type,abs(p_amount),v_acc.balance,v_after,trim(p_note));
 insert into public.admin_audit_logs(actor_user_id,action,entity_type,entity_id,details)
 values(auth.uid(),'account_balance_adjusted','trading_account',p_account_id::text,jsonb_build_object('delta',p_amount,'before',v_acc.balance,'after',v_after,'note',p_note));
 return v_after;
end $$;

revoke all on function public.admin_complete_withdrawal(uuid,text) from public,anon;
revoke all on function public.admin_adjust_account_balance(uuid,numeric,text) from public,anon;
grant execute on function public.admin_complete_withdrawal(uuid,text) to authenticated;
grant execute on function public.admin_adjust_account_balance(uuid,numeric,text) to authenticated;
grant execute on function public.admin_review_wallet_transaction(uuid,text,text) to authenticated;

-- Enable database change events for client and Admin live transaction histories.
do $$
begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime')
  and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='wallet_transactions') then
  alter publication supabase_realtime add table public.wallet_transactions;
 end if;
exception when others then raise notice 'Realtime publication could not be updated: %',sqlerrm;
end $;

notify pgrst,'reload schema';
commit;
