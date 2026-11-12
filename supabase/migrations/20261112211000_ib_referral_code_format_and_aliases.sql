create table if not exists public.partner_referral_aliases (
  referral_code text primary key,
  partner_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.partner_referral_aliases enable row level security;
revoke all on public.partner_referral_aliases from anon, authenticated;

do $$
declare
  r record;
  v_code text;
begin
  for r in
    select user_id,referral_code
    from public.partner_applications
    where status='approved' and referral_code is not null and referral_code not like 'BB-%'
    for update
  loop
    insert into public.partner_referral_aliases(referral_code,partner_user_id)
    values(r.referral_code,r.user_id)
    on conflict(referral_code) do nothing;
    loop
      v_code := 'BB-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
      exit when not exists(select 1 from public.partner_applications where referral_code=v_code)
        and not exists(select 1 from public.partner_referral_aliases where referral_code=v_code);
    end loop;
    update public.partner_applications set referral_code=v_code where user_id=r.user_id;
  end loop;
end $$;

create or replace function public.assign_partner_referral_code()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
declare v_candidate text;
begin
  if new.status='approved' and old.status is distinct from 'approved' and new.referral_code is null then
    loop
      v_candidate := 'BB-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
      exit when not exists(select 1 from public.partner_applications where referral_code=v_candidate)
        and not exists(select 1 from public.partner_referral_aliases where referral_code=v_candidate);
    end loop;
    new.referral_code := v_candidate;
  end if;
  return new;
end;
$function$;

create or replace function private.activate_bigbulls_ib_after_kyc()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $function$
declare v_code text;
begin
  if new.status <> 'approved' then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'approved' then return new; end if;
  loop
    v_code := 'BB-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
    exit when not exists(select 1 from public.partner_applications where referral_code=v_code)
      and not exists(select 1 from public.partner_referral_aliases where referral_code=v_code);
  end loop;
  insert into public.partner_applications(user_id,partner_type,status,referral_code,reviewed_at,tier)
  values(new.user_id,'IB','approved',v_code,now(),'bronze')
  on conflict(user_id) do update
    set status='approved',
        referral_code=coalesce(public.partner_applications.referral_code,excluded.referral_code),
        reviewed_at=now();
  return new;
end;
$function$;
revoke all on function private.activate_bigbulls_ib_after_kyc() from public,anon,authenticated;

create or replace function public.capture_partner_referral()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $function$
declare v_code text; v_partner uuid;
begin
  v_code := upper(trim(coalesce(new.raw_user_meta_data->>'referral_code','')));
  if v_code='' then return new; end if;
  select pa.user_id into v_partner
    from public.partner_applications pa
   where upper(pa.referral_code)=v_code and pa.status='approved'
  union all
  select a.partner_user_id from public.partner_referral_aliases a
   join public.partner_applications pa on pa.user_id=a.partner_user_id and pa.status='approved'
   where upper(a.referral_code)=v_code
   limit 1;
  if v_partner is not null and v_partner<>new.id then
    insert into public.partner_referrals(partner_user_id,referred_user_id,referral_code)
    values(v_partner,new.id,v_code) on conflict(referred_user_id) do nothing;
  end if;
  return new;
end;
$function$;
revoke all on function public.capture_partner_referral() from public,anon,authenticated;

create or replace function private.capture_bigbulls_referral_on_signup()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $function$
declare v_code text; v_partner_user_id uuid;
begin
  v_code := upper(trim(coalesce(new.raw_user_meta_data->>'referral_code','')));
  if v_code='' then return new; end if;
  select pa.user_id into v_partner_user_id
    from public.partner_applications pa
   where upper(pa.referral_code)=v_code and pa.status='approved'
  union all
  select a.partner_user_id from public.partner_referral_aliases a
   join public.partner_applications pa on pa.user_id=a.partner_user_id and pa.status='approved'
   where upper(a.referral_code)=v_code
   limit 1;
  if v_partner_user_id is not null and v_partner_user_id<>new.id then
    insert into public.partner_referrals(partner_user_id,referred_user_id,referral_code)
    values(v_partner_user_id,new.id,v_code) on conflict(referred_user_id) do nothing;
  end if;
  return new;
end;
$function$;
revoke all on function private.capture_bigbulls_referral_on_signup() from public,anon,authenticated;

notify pgrst,'reload schema';