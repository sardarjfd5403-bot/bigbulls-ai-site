insert into public.partner_applications(user_id,partner_type,status,referral_code,reviewed_at)
select distinct on (k.user_id)
  k.user_id,
  'IB',
  'approved',
  upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)),
  now()
from public.kyc_submissions k
where k.status='approved'
order by k.user_id,k.created_at desc
on conflict(user_id) do update
set status='approved',
    referral_code=coalesce(public.partner_applications.referral_code,excluded.referral_code),
    reviewed_at=now();