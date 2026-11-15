-- Keep the authenticated client account-management RPC aligned with the Android portal.
-- This replaces only the existing account management function and retains ownership/KYC checks.
create or replace function public.manage_client_trading_account(
  p_account_id uuid,
  p_action text,
  p_display_name text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_account_mode text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select account_mode into v_account_mode
  from public.trading_accounts
  where id = p_account_id and user_id = auth.uid() and deleted_at is null;

  if not found then
    raise exception 'Account not found or action not allowed';
  end if;

  if v_account_mode = 'real'
     and not public.is_bigbulls_admin()
     and not private.client_platform_access_allowed() then
    raise exception 'KYC approval required for Real account management';
  end if;

  if p_action = 'rename' then
    if length(trim(coalesce(p_display_name, ''))) not between 1 and 40 then
      raise exception 'Account name must be 1-40 characters';
    end if;
    update public.trading_accounts set display_name = trim(p_display_name), updated_at = now()
      where id = p_account_id and user_id = auth.uid() and archived_at is null and deleted_at is null;
  elsif p_action = 'archive' then
    update public.trading_accounts set archived_at = now(), updated_at = now()
      where id = p_account_id and user_id = auth.uid() and archived_at is null and deleted_at is null;
  elsif p_action = 'restore' then
    update public.trading_accounts
      set archived_at = null, zero_balance_since = case when balance = 0 then now() else null end, updated_at = now()
      where id = p_account_id and user_id = auth.uid() and archived_at is not null and deleted_at is null;
  elsif p_action = 'delete' then
    update public.trading_accounts set deleted_at = now(), updated_at = now()
      where id = p_account_id and user_id = auth.uid() and deleted_at is null;
  elsif p_action = 'leverage' then
    if coalesce(p_display_name, '') not in ('1:100','1:200','1:500','1:1000','1:2000','Unlimited') then
      raise exception 'Unsupported leverage. Choose 1:100, 1:200, 1:500, 1:1000, 1:2000 or Unlimited.';
    end if;
    if v_account_mode = 'real' and exists (
      select 1 from public.bb_bbook_positions where account_id = p_account_id and status = 'OPEN'
    ) then
      raise exception 'Close all open REAL positions before changing leverage.';
    end if;
    update public.trading_accounts
      set requested_leverage = p_display_name, leverage_preference = p_display_name, updated_at = now()
      where id = p_account_id and user_id = auth.uid() and archived_at is null and deleted_at is null;
  else
    raise exception 'Unsupported account action';
  end if;

  if not found then
    raise exception 'Account not found or action not allowed';
  end if;
end;
$function$;
