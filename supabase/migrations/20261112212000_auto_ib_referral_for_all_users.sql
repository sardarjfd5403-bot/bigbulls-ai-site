create or replace function private.provision_bigbulls_ib_on_signup()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $function$
declare
  v_code text;
begin
  if exists(select 1 from public.partner_applications where user_id=new.id) then
    return new;
  end if;
  loop
    v_code := 'BB-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
    exit when not exists(select 1 from public.partner_applications where referral_code=v_code)
      and not exists(select 1 from public.partner_referral_aliases where referral_code=v_code);
  end loop;
  insert into public.partner_applications(user_id,partner_type,status,referral_code,reviewed_at,tier)
  values(new.id,'IB','approved',v_code,now(),'bronze')
  on conflict(user_id) do nothing;
  return new;
end;
$function$;
revoke all on function private.provision_bigbulls_ib_on_signup() from public,anon,authenticated;

drop trigger if exists provision_bigbulls_ib_on_signup on auth.users;
create trigger provision_bigbulls_ib_on_signup
after insert on auth.users
for each row execute function private.provision_bigbulls_ib_on_signup();

-- Give every existing registered account a referral identity where no partner record exists.
do $$
declare
  u record;
  v_code text;
begin
  for u in select id from auth.users where not exists(
    select 1 from public.partner_applications p where p.user_id=auth.users.id
  ) loop
    loop
      v_code := 'BB-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
      exit when not exists(select 1 from public.partner_applications where referral_code=v_code)
        and not exists(select 1 from public.partner_referral_aliases where referral_code=v_code);
    end loop;
    insert into public.partner_applications(user_id,partner_type,status,referral_code,reviewed_at,tier)
    values(u.id,'IB','approved',v_code,now(),'bronze')
    on conflict(user_id) do nothing;
  end loop;
end $$;

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
  if not exists(select 1 from public.kyc_submissions where user_id=v_user and status='approved') then
    raise exception 'Approved KYC is required before requesting an IB payout';
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
revoke all on function public.partner_request_payout(numeric,text,text) from public,anon;
grant execute on function public.partner_request_payout(numeric,text,text) to authenticated;

notify pgrst,'reload schema';