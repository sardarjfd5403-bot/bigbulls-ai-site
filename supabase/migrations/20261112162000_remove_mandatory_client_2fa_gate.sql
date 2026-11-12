begin;

-- KYC approval is the only client-platform eligibility gate. MFA remains optional.
create or replace function private.client_platform_access_allowed()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.kyc_submissions k
    where k.user_id = (select auth.uid())
      and k.status = 'approved'
  );
$$;

create or replace function private.notify_kyc_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text;
  v_message text;
begin
  if tg_op = 'INSERT' then
    v_title := 'KYC submitted';
    v_message := 'Your identity verification was submitted and is awaiting review.';
  elsif new.status is distinct from old.status then
    if new.status = 'approved' then
      v_title := 'KYC verified';
      v_message := 'Your identity verification is approved. Your BIGBULLS client platform is now unlocked.';
    elsif new.status = 'rejected' then
      v_title := 'KYC needs attention';
      v_message := 'Your identity verification was not approved. Review the reasons and resubmit your documents.';
    else
      v_title := 'KYC status updated';
      v_message := 'Your identity verification status has changed to ' || new.status || '.';
    end if;
  else
    return new;
  end if;

  insert into public.client_notifications(user_id,title,message,category,metadata)
  values (
    new.user_id,
    v_title,
    v_message,
    'kyc',
    jsonb_build_object(
      'kyc_submission_id', new.id,
      'status', new.status,
      'rejection_reasons', coalesce(new.rejection_reasons, '{}'::text[]),
      'admin_note', coalesce(new.admin_note, '')
    )
  );
  return new;
end;
$$;

create or replace function public.create_client_trading_account(
  p_account_mode text,
  p_account_type text,
  p_currency text,
  p_display_name text,
  p_platform text,
  p_leverage text
)
returns bigint
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_number bigint;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if not public.is_bigbulls_admin() and not private.client_platform_access_allowed() then
    raise exception 'KYC approval required';
  end if;
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
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.is_bigbulls_admin() and not private.client_platform_access_allowed() then
    raise exception 'KYC approval required';
  end if;

  if p_action='rename' then
    if length(trim(coalesce(p_display_name,''))) not between 1 and 40 then
      raise exception 'Account name must be 1-40 characters';
    end if;
    update public.trading_accounts
      set display_name=trim(p_display_name)
      where id=p_account_id and user_id=auth.uid()
        and archived_at is null and deleted_at is null;
  elsif p_action='archive' then
    update public.trading_accounts set archived_at=now()
      where id=p_account_id and user_id=auth.uid()
        and archived_at is null and deleted_at is null;
  elsif p_action='restore' then
    update public.trading_accounts
      set archived_at=null,
          zero_balance_since=case when balance=0 then now() else null end
      where id=p_account_id and user_id=auth.uid()
        and archived_at is not null and deleted_at is null;
  elsif p_action='delete' then
    update public.trading_accounts set deleted_at=now()
      where id=p_account_id and user_id=auth.uid() and deleted_at is null;
  else
    raise exception 'Unsupported account action';
  end if;

  if not found then raise exception 'Account not found or action not allowed'; end if;
end;
$function$;

notify pgrst, 'reload schema';
commit;