-- Increase the per-client active Real trading account allowance to 50.
-- KYC approval remains mandatory; Demo account rules are unchanged.
CREATE OR REPLACE FUNCTION public.create_client_trading_account(
  p_account_mode text,
  p_account_type text,
  p_currency text,
  p_display_name text,
  p_platform text,
  p_leverage text,
  p_swap_free boolean DEFAULT false
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_number bigint;
  v_account_id uuid;
  v_count integer;
  v_max_leverage integer;
  v_requested integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_account_mode not in ('real','demo') then raise exception 'Invalid account environment'; end if;
  if p_account_type not in ('Standard','Pro','Raw Spread','Zero') then raise exception 'Invalid account type'; end if;
  if p_currency <> 'USD' then raise exception 'Only USD accounts are currently supported'; end if;
  if p_platform <> 'BIGBULLS' then raise exception 'Only BIGBULLS native terminal accounts are supported'; end if;
  if p_leverage not in ('1:100','1:200','1:500','1:1000','1:2000','Unlimited') then raise exception 'Unsupported leverage request'; end if;
  if length(trim(coalesce(p_display_name,''))) > 40 then raise exception 'Nickname must be 40 characters or fewer'; end if;

  if p_account_mode='real' then
    if not private.client_platform_access_allowed() then
      raise exception 'KYC verification required. Complete KYC before creating a Real account.';
    end if;
    perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 7319));
    select count(*) into v_count
    from public.trading_accounts
    where user_id=auth.uid() and account_mode='real'
      and deleted_at is null and archived_at is null;
    if v_count >= 50 then raise exception 'Real account limit reached (maximum 50 active Real accounts).'; end if;
  end if;

  select max_leverage into v_max_leverage from public.bb_bbook_settings where singleton=true;
  v_max_leverage := coalesce(v_max_leverage,500);
  v_requested := case when p_leverage='Unlimited' then v_max_leverage
                      else split_part(p_leverage,':',2)::integer end;
  v_requested := least(v_requested,v_max_leverage);

  insert into public.trading_accounts(
    user_id,account_type,platform,currency,status,account_mode,display_name,
    requested_leverage,leverage_preference,swap_free
  ) values (
    auth.uid(),p_account_type,'BIGBULLS','USD','approved',p_account_mode,
    nullif(trim(coalesce(p_display_name,'')),''),'1:'||v_requested::text,p_leverage,coalesce(p_swap_free,false)
  )
  returning id,account_number into v_account_id,v_number;

  if p_account_mode='real' then
    insert into public.bb_account_risk_controls(
      account_id,user_id,trading_enabled,max_open_positions,max_leverage
    ) values (v_account_id,auth.uid(),true,20,v_requested)
    on conflict(account_id) do nothing;
  end if;
  return v_number;
end;
$function$;
