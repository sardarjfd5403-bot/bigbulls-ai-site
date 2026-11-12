create or replace function public.manage_client_trading_account(
  p_account_id uuid,
  p_action text,
  p_display_name text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_account_mode text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select account_mode into v_account_mode
  from public.trading_accounts
  where id=p_account_id and user_id=auth.uid() and deleted_at is null;

  if not found then raise exception 'Account not found or action not allowed'; end if;
  if v_account_mode='real'
     and not public.is_bigbulls_admin()
     and not private.client_platform_access_allowed() then
    raise exception 'KYC approval required for Real account management';
  end if;

  if p_action='rename' then
    if length(trim(coalesce(p_display_name,''))) not between 1 and 40 then
      raise exception 'Account name must be 1-40 characters';
    end if;
    update public.trading_accounts set display_name=trim(p_display_name)
      where id=p_account_id and user_id=auth.uid() and archived_at is null and deleted_at is null;
  elsif p_action='archive' then
    update public.trading_accounts set archived_at=now()
      where id=p_account_id and user_id=auth.uid() and archived_at is null and deleted_at is null;
  elsif p_action='restore' then
    update public.trading_accounts
      set archived_at=null, zero_balance_since=case when balance=0 then now() else null end
      where id=p_account_id and user_id=auth.uid() and archived_at is not null and deleted_at is null;
  elsif p_action='delete' then
    update public.trading_accounts set deleted_at=now()
      where id=p_account_id and user_id=auth.uid() and deleted_at is null;
  else
    raise exception 'Unsupported account action';
  end if;
  if not found then raise exception 'Account not found or action not allowed'; end if;
end;
$function$;
revoke all on function public.manage_client_trading_account(uuid,text,text) from public, anon;
grant execute on function public.manage_client_trading_account(uuid,text,text) to authenticated;
notify pgrst, 'reload schema';