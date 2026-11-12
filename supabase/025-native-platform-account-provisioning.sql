create or replace function public.create_client_trading_account(
  p_account_mode text, p_account_type text, p_currency text,
  p_display_name text, p_platform text, p_leverage text
) returns bigint language plpgsql security definer set search_path=public as $$
declare v_number bigint;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_account_mode not in ('real','demo') then raise exception 'Invalid account environment'; end if;
  if p_account_mode='real' and not public.is_bigbulls_admin() and not private.client_platform_access_allowed() then
    raise exception 'KYC approval required for Real account creation';
  end if;
  if p_account_type not in ('Pro','Zero','Speed','Cent') then raise exception 'Invalid account type'; end if;
  if p_currency<>'USD' then raise exception 'Only USD portal accounts are supported until currency conversion is configured'; end if;
  if p_platform<>'BIGBULLS' then raise exception 'Only BigBulls Native Terminal accounts are supported'; end if;
  if p_leverage not in ('1:100','1:200','1:500','1:1000','1:2000') then raise exception 'Unsupported leverage request'; end if;
  if length(trim(coalesce(p_display_name,''))) not between 1 and 40 then raise exception 'Account name must be 1-40 characters'; end if;
  insert into public.trading_accounts(user_id,account_type,platform,currency,status,account_mode,display_name,requested_leverage)
  values(auth.uid(),p_account_type,'BIGBULLS','USD','pending',p_account_mode,trim(p_display_name),p_leverage)
  returning account_number into v_number;
  return v_number;
end;
$$;
revoke all on function public.create_client_trading_account(text,text,text,text,text,text) from public,anon;
grant execute on function public.create_client_trading_account(text,text,text,text,text,text) to authenticated;