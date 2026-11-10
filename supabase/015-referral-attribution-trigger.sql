-- BIGBULLS IB referral attribution.
-- Run once in the Supabase SQL Editor. The trigger validates referral codes
-- against approved partner applications; client metadata is never trusted alone.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.capture_bigbulls_referral_on_signup()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $function$
declare
  v_code text;
  v_partner_user_id uuid;
begin
  v_code := upper(trim(coalesce(new.raw_user_meta_data ->> 'referral_code', '')));
  if v_code = '' then return new; end if;

  select pa.user_id into v_partner_user_id
  from public.partner_applications pa
  where upper(pa.referral_code) = v_code
    and pa.status = 'approved'
  limit 1;

  if v_partner_user_id is null or v_partner_user_id = new.id then return new; end if;

  insert into public.partner_referrals(partner_user_id, referred_user_id, referral_code)
  values (v_partner_user_id, new.id, v_code)
  on conflict (referred_user_id) do nothing;

  return new;
end;
$function$;

revoke all on function private.capture_bigbulls_referral_on_signup() from public, anon, authenticated;

drop trigger if exists capture_bigbulls_referral_on_signup on auth.users;
create trigger capture_bigbulls_referral_on_signup
after insert on auth.users
for each row execute function private.capture_bigbulls_referral_on_signup();

-- Backfill previously registered users who already supplied an approved code.
insert into public.partner_referrals(partner_user_id, referred_user_id, referral_code)
select pa.user_id, u.id, upper(trim(u.raw_user_meta_data ->> 'referral_code'))
from auth.users u
join public.partner_applications pa
  on upper(pa.referral_code) = upper(trim(u.raw_user_meta_data ->> 'referral_code'))
 and pa.status = 'approved'
where nullif(trim(u.raw_user_meta_data ->> 'referral_code'), '') is not null
  and pa.user_id <> u.id
on conflict (referred_user_id) do nothing;

notify pgrst, 'reload schema';
