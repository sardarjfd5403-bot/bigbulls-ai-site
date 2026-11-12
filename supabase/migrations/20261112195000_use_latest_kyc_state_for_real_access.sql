create or replace function private.client_platform_access_allowed()
returns boolean
language sql
stable
security definer
set search_path=''
as $function$
  select coalesce((
    select k.status='approved'
    from public.kyc_submissions k
    where k.user_id=(select auth.uid())
    order by k.created_at desc
    limit 1
  ),false);
$function$;

create or replace function public.private_client_wallet_kyc_allowed(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $function$
  select (public.is_bigbulls_admin() and auth.uid()=p_user)
    or (auth.uid()=p_user and private.client_platform_access_allowed());
$function$;

revoke all on function public.private_client_wallet_kyc_allowed(uuid) from public,anon,authenticated;
notify pgrst,'reload schema';