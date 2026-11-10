-- BIGBULLS account request workflow: store requested platform/leverage and require Admin review.
begin;

alter table public.trading_accounts
  add column if not exists requested_leverage text not null default '1:100',
  add column if not exists reviewed_by uuid references auth.users(id),
  add column if not exists reviewed_at timestamptz,
  add column if not exists admin_note text;

alter table public.trading_accounts
  drop constraint if exists trading_accounts_requested_leverage_check;
alter table public.trading_accounts
  add constraint trading_accounts_requested_leverage_check
  check (requested_leverage in ('1:100','1:200','1:500','1:1000','1:2000'));

create index if not exists trading_accounts_status_created_idx
  on public.trading_accounts(status,created_at desc);

-- Website account IDs are portal references, not provisioned MT4/MT5 logins.
create or replace function public.bigbulls_account_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if new.account_number is null then
    new.account_number := nextval('public.bigbulls_account_number_seq');
  end if;
  new.server_name := case
    when new.account_mode='demo' then 'BIGBULLS-Portal-Demo'
    else 'BIGBULLS-Portal-Real'
  end;

  if new.balance > 0 then
    new.zero_balance_since := null;
  elsif tg_op='INSERT' then
    new.zero_balance_since := coalesce(new.zero_balance_since, now());
  elsif old.balance > 0 and new.balance=0 then
    new.zero_balance_since := now();
  elsif old.balance=0 and new.balance=0 then
    new.zero_balance_since := coalesce(old.zero_balance_since, now());
  end if;
  return new;
end;
$function$;

drop function if exists public.create_client_trading_account(text,text,text,text);
create or replace function public.create_client_trading_account(
  p_account_mode text,
  p_account_type text,
  p_currency text,
  p_display_name text,
  p_platform text,
  p_leverage text
) returns bigint
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_number bigint;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_account_mode not in ('real','demo') then raise exception 'Invalid account environment'; end if;
  if p_account_type not in ('Pro','Zero','Speed','Cent') then raise exception 'Invalid account type'; end if;
  if p_currency <> 'USD' then raise exception 'Only USD portal accounts are supported until currency conversion is configured'; end if;
  if p_platform not in ('MT4','MT5') then raise exception 'Select MT4 or MT5 as your requested platform'; end if;
  if p_leverage not in ('1:100','1:200','1:500','1:1000','1:2000') then raise exception 'Unsupported leverage request'; end if;
  if length(trim(coalesce(p_display_name,''))) not between 1 and 40 then
    raise exception 'Account name must be 1-40 characters';
  end if;

  insert into public.trading_accounts
    (user_id,account_type,platform,currency,status,account_mode,display_name,requested_leverage)
  values
    (auth.uid(),p_account_type,p_platform,'USD','pending',p_account_mode,trim(p_display_name),p_leverage)
  returning account_number into v_number;

  return v_number;
end;
$function$;

create or replace function public.admin_review_trading_account(
  p_account_id uuid,
  p_status text,
  p_admin_note text default null
) returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_account public.trading_accounts%rowtype;
begin
  if not public.is_bigbulls_admin() then
    raise exception 'Admin permission required';
  end if;
  if p_status not in ('approved','rejected') then
    raise exception 'Invalid account review status';
  end if;

  select * into v_account
  from public.trading_accounts
  where id=p_account_id
  for update;

  if not found or v_account.status <> 'pending' then
    raise exception 'Account request not found or already reviewed';
  end if;
  if p_status='rejected' and length(trim(coalesce(p_admin_note,'')))<4 then
    raise exception 'A rejection reason of at least 4 characters is required';
  end if;

  update public.trading_accounts
    set status=p_status,
        reviewed_by=auth.uid(),
        reviewed_at=now(),
        admin_note=nullif(trim(coalesce(p_admin_note,'')),'')
    where id=p_account_id;

  insert into public.admin_audit_logs(actor_user_id,action,entity_type,entity_id,details)
  values(
    auth.uid(),
    'trading_account_'||p_status,
    'trading_account',
    p_account_id::text,
    jsonb_build_object(
      'user_id',v_account.user_id,
      'account_number',v_account.account_number,
      'account_mode',v_account.account_mode,
      'platform_requested',v_account.platform,
      'leverage_requested',v_account.requested_leverage,
      'admin_note',p_admin_note
    )
  );
end;
$function$;

revoke all on function public.create_client_trading_account(text,text,text,text,text,text) from public,anon;
grant execute on function public.create_client_trading_account(text,text,text,text,text,text) to authenticated;
revoke all on function public.admin_review_trading_account(uuid,text,text) from public,anon;
grant execute on function public.admin_review_trading_account(uuid,text,text) to authenticated;

notify pgrst,'reload schema';
commit;
