-- BIGBULLS admin workflow completion: transfers, product orders, licensed downloads and view security.
begin;

-- Views otherwise execute with the view owner's privileges and can bypass underlying RLS.
alter view public.wallet_balances set (security_invoker = true);
revoke all on public.wallet_balances from anon;
grant select on public.wallet_balances to authenticated;

-- Internal transfer ledger entries are immutable and created only by the Admin RPC.
alter table public.account_balance_ledger
  drop constraint if exists account_balance_ledger_entry_type_check;
alter table public.account_balance_ledger
  add constraint account_balance_ledger_entry_type_check
  check (entry_type in (
    'deposit_credit','withdrawal_debit','admin_credit','admin_debit',
    'transfer_credit','transfer_debit'
  ));

create index if not exists account_transfers_status_created_idx
  on public.account_transfers(status, created_at desc);

create or replace function public.admin_review_account_transfer(
  p_transfer_id uuid,
  p_status text,
  p_admin_note text default null
) returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_transfer public.account_transfers%rowtype;
  v_from public.trading_accounts%rowtype;
  v_to public.trading_accounts%rowtype;
  v_reserved numeric(18,2);
  v_from_before numeric(18,2);
  v_to_before numeric(18,2);
begin
  if not public.is_bigbulls_admin() then
    raise exception 'Admin permission required';
  end if;
  if p_status not in ('approved','rejected') then
    raise exception 'Invalid transfer review status';
  end if;

  select * into v_transfer
  from public.account_transfers
  where id = p_transfer_id
  for update;

  if not found or v_transfer.status <> 'pending' then
    raise exception 'Transfer request not found or already reviewed';
  end if;

  if p_status = 'rejected' then
    if length(trim(coalesce(p_admin_note,''))) < 4 then
      raise exception 'A rejection reason of at least 4 characters is required';
    end if;
    update public.account_transfers
      set status='rejected', admin_note=trim(p_admin_note),
          reviewed_by=auth.uid(), reviewed_at=now()
      where id=p_transfer_id;
  else
    -- Lock both account rows in a stable order to avoid transfer deadlocks.
    perform 1
      from public.trading_accounts
      where id in (v_transfer.from_account, v_transfer.to_account)
      order by id
      for update;

    select * into v_from from public.trading_accounts where id=v_transfer.from_account;
    select * into v_to from public.trading_accounts where id=v_transfer.to_account;

    if v_from.id is null or v_to.id is null
       or v_from.user_id <> v_transfer.user_id
       or v_to.user_id <> v_transfer.user_id then
      raise exception 'Transfer accounts do not belong to the requesting client';
    end if;
    if v_from.status <> 'approved' or v_to.status <> 'approved'
       or v_from.archived_at is not null or v_to.archived_at is not null
       or v_from.deleted_at is not null or v_to.deleted_at is not null then
      raise exception 'Both accounts must be active and approved';
    end if;
    if v_from.currency <> 'USD' or v_to.currency <> 'USD'
       or coalesce(v_transfer.currency,'USD') <> 'USD' then
      raise exception 'Transfers currently support USD accounts only';
    end if;
    if v_from.account_mode <> v_to.account_mode then
      raise exception 'Real and Demo account balances cannot be transferred between each other';
    end if;

    -- Funds reserved for already-approved payouts cannot also be transferred.
    select coalesce(sum(amount_usd),0) into v_reserved
    from public.wallet_transactions
    where account_id=v_from.id and kind='withdrawal' and status='processing';

    if v_from.balance - v_reserved < v_transfer.amount_usd then
      raise exception 'Insufficient available balance after reserved withdrawals';
    end if;

    v_from_before := v_from.balance;
    v_to_before := v_to.balance;

    update public.trading_accounts
      set balance=balance-v_transfer.amount_usd
      where id=v_from.id;
    update public.trading_accounts
      set balance=balance+v_transfer.amount_usd
      where id=v_to.id;

    insert into public.account_balance_ledger(
      account_id,user_id,actor_user_id,entry_type,amount,
      balance_before,balance_after,note
    ) values
      (v_from.id,v_transfer.user_id,auth.uid(),'transfer_debit',
       v_transfer.amount_usd,v_from_before,v_from_before-v_transfer.amount_usd,
       'Internal transfer debit · '||p_transfer_id::text),
      (v_to.id,v_transfer.user_id,auth.uid(),'transfer_credit',
       v_transfer.amount_usd,v_to_before,v_to_before+v_transfer.amount_usd,
       'Internal transfer credit · '||p_transfer_id::text);

    update public.account_transfers
      set status='approved', admin_note=nullif(trim(coalesce(p_admin_note,'')), ''),
          reviewed_by=auth.uid(), reviewed_at=now()
      where id=p_transfer_id;
  end if;

  insert into public.admin_audit_logs(actor_user_id,action,entity_type,entity_id,details)
  values(
    auth.uid(),
    'account_transfer_'||p_status,
    'account_transfer',
    p_transfer_id::text,
    jsonb_build_object(
      'user_id',v_transfer.user_id,
      'from_account',v_transfer.from_account,
      'to_account',v_transfer.to_account,
      'amount_usd',v_transfer.amount_usd,
      'note',p_admin_note
    )
  );
end;
$function$;

-- A verified $199 Echo System order creates or reactivates the customer's license.
alter table public.licenses
  add column if not exists download_path text;

drop policy if exists "admins manage licenses" on public.licenses;
drop policy if exists "admins read licenses" on public.licenses;
drop policy if exists "admins update licenses" on public.licenses;
create policy "admins read licenses" on public.licenses
  for select to authenticated using ((select public.is_bigbulls_admin()));
create policy "admins update licenses" on public.licenses
  for update to authenticated
  using ((select public.is_bigbulls_admin()))
  with check ((select public.is_bigbulls_admin()));

create or replace function public.admin_review_product_order(
  p_order_id uuid,
  p_status text,
  p_admin_note text default null
) returns text
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_order public.product_orders%rowtype;
  v_license_key text;
begin
  if not public.is_bigbulls_admin() then
    raise exception 'Admin permission required';
  end if;
  if p_status not in ('paid','rejected') then
    raise exception 'Invalid product order status';
  end if;

  select * into v_order
  from public.product_orders
  where id=p_order_id
  for update;

  if not found or v_order.status <> 'pending' then
    raise exception 'Product order not found or already reviewed';
  end if;

  if p_status='paid' then
    if v_order.product_code <> 'BIGBULLS_AI_ECHO'
       or v_order.amount_usd <> 199
       or length(trim(coalesce(v_order.payment_reference,''))) < 11 then
      raise exception 'Order product, amount or blockchain TXID is invalid';
    end if;

    insert into public.licenses(user_id,status,download_path)
    values(v_order.user_id,'active','echo-system/latest-package.zip')
    on conflict(user_id) do update
      set status='active', expires_at=null,
          download_path='echo-system/latest-package.zip'
    returning license_key into v_license_key;

    update public.product_orders
      set status='paid', reviewed_by=auth.uid(), reviewed_at=now()
      where id=p_order_id;
  else
    if length(trim(coalesce(p_admin_note,''))) < 4 then
      raise exception 'A rejection reason of at least 4 characters is required';
    end if;
    update public.product_orders
      set status='rejected', reviewed_by=auth.uid(), reviewed_at=now()
      where id=p_order_id;
  end if;

  insert into public.admin_audit_logs(actor_user_id,action,entity_type,entity_id,details)
  values(
    auth.uid(),
    'product_order_'||p_status,
    'product_order',
    p_order_id::text,
    jsonb_build_object(
      'user_id',v_order.user_id,
      'product_code',v_order.product_code,
      'amount_usd',v_order.amount_usd,
      'payment_reference',v_order.payment_reference,
      'admin_note',p_admin_note
    )
  );

  return v_license_key;
end;
$function$;

-- Private package bucket: only Admins upload; only licensed owners can download.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'product-downloads','product-downloads',false,104857600,
  array['application/zip','application/x-zip-compressed']
)
on conflict(id) do update
set public=false,file_size_limit=104857600,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "admins manage product downloads" on storage.objects;
drop policy if exists "admins read product downloads" on storage.objects;
drop policy if exists "admins upload product downloads" on storage.objects;
drop policy if exists "admins replace product downloads" on storage.objects;
create policy "admins read product downloads"
on storage.objects for select to authenticated
using (bucket_id='product-downloads' and (select public.is_bigbulls_admin()));
create policy "admins upload product downloads"
on storage.objects for insert to authenticated
with check (bucket_id='product-downloads' and (select public.is_bigbulls_admin()));
create policy "admins replace product downloads"
on storage.objects for update to authenticated
using (bucket_id='product-downloads' and (select public.is_bigbulls_admin()))
with check (bucket_id='product-downloads' and (select public.is_bigbulls_admin()));

drop policy if exists "licensed clients download Echo package" on storage.objects;
create policy "licensed clients download Echo package"
on storage.objects for select to authenticated
using (
  bucket_id='product-downloads'
  and exists (
    select 1 from public.licenses l
    where l.user_id=(select auth.uid())
      and l.status='active'
      and l.download_path=name
  )
);

revoke all on function public.admin_review_account_transfer(uuid,text,text) from public,anon;
revoke all on function public.admin_review_product_order(uuid,text,text) from public,anon;
grant execute on function public.admin_review_account_transfer(uuid,text,text) to authenticated;
grant execute on function public.admin_review_product_order(uuid,text,text) to authenticated;

notify pgrst,'reload schema';
commit;
