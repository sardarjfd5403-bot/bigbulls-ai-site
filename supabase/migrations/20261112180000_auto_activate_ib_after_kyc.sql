create or replace function private.activate_bigbulls_ib_after_kyc()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $function$
declare
  v_code text;
begin
  if new.status <> 'approved' then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'approved' then return new; end if;

  v_code := upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));
  insert into public.partner_applications(
    user_id,partner_type,status,referral_code,reviewed_at
  )
  values(
    new.user_id,'IB','approved',v_code,now()
  )
  on conflict(user_id) do update
    set status='approved',
        referral_code=coalesce(public.partner_applications.referral_code,excluded.referral_code),
        reviewed_at=now();

  return new;
end;
$function$;

revoke all on function private.activate_bigbulls_ib_after_kyc() from public, anon, authenticated;
drop trigger if exists activate_bigbulls_ib_after_kyc on public.kyc_submissions;
create trigger activate_bigbulls_ib_after_kyc
after insert or update of status on public.kyc_submissions
for each row execute function private.activate_bigbulls_ib_after_kyc();
notify pgrst, 'reload schema';