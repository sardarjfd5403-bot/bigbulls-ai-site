create or replace function public.partner_dashboard_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $function$
declare
  v_user uuid := auth.uid();
  v_partner public.partner_applications%rowtype;
  v_wallet public.partner_wallet_accounts%rowtype;
  v_result jsonb;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select * into v_partner from public.partner_applications where user_id=v_user;
  if not found then
    return jsonb_build_object('partner',null,'wallet',jsonb_build_object('available_balance',0,'total_earned',0),
      'metrics',jsonb_build_object('active_clients',0,'total_referred',0,'total_lots',0),
      'referrals','[]'::jsonb,'commissions','[]'::jsonb,'payouts','[]'::jsonb,'transfers','[]'::jsonb);
  end if;
  select * into v_wallet from public.partner_wallet_accounts where partner_user_id=v_user;
  select jsonb_build_object(
    'partner',jsonb_build_object('status',v_partner.status,'tier',v_partner.tier,'referral_code',v_partner.referral_code),
    'wallet',jsonb_build_object(
      'available_balance',coalesce(v_wallet.available_balance,0),
      'total_earned',coalesce(v_wallet.total_earned,0),
      'total_paid',coalesce(v_wallet.total_paid,0),
      'total_transferred',coalesce(v_wallet.total_transferred,0)
    ),
    'metrics',jsonb_build_object(
      'active_clients',(select count(*) from public.partner_referrals r
        where r.partner_user_id=v_user and exists(
          select 1 from public.trading_accounts a where a.user_id=r.referred_user_id
            and a.account_mode='real' and a.status='approved' and a.archived_at is null and a.deleted_at is null)),
      'total_referred',(select count(*) from public.partner_referrals where partner_user_id=v_user),
      'total_lots',coalesce((select sum(c.verified_lots) from public.partner_commission_ledger c
        where c.partner_user_id=v_user and c.entry_source='bbook_trade_close'),0)
    ),
    'referrals',coalesce((
      select jsonb_agg(jsonb_build_object(
        'masked_email',case when u.email is null then 'Client' else
          left(split_part(u.email,'@',1),2) || '***@' || split_part(u.email,'@',2) end,
        'joined_at',r.created_at,
        'total_lots',coalesce(x.total_lots,0),
        'commission_usd',coalesce(x.commission_usd,0),
        'active',exists(select 1 from public.trading_accounts a where a.user_id=r.referred_user_id
          and a.account_mode='real' and a.status='approved' and a.archived_at is null and a.deleted_at is null)
      ) order by r.created_at desc)
      from public.partner_referrals r
      left join auth.users u on u.id=r.referred_user_id
      left join lateral (
        select sum(c.verified_lots) total_lots,sum(c.commission_usd) commission_usd
          from public.partner_commission_ledger c
         where c.partner_user_id=v_user and c.referred_user_id=r.referred_user_id
           and c.entry_source='bbook_trade_close'
      ) x on true
      where r.partner_user_id=v_user
    ),'[]'::jsonb),
    'commissions',coalesce((
      select jsonb_agg(jsonb_build_object(
        'client_ref','Client ••••' || right(c.referred_user_id::text,6),
        'masked_email',case when u.email is null then 'Client' else
          left(split_part(u.email,'@',1),2) || '***@' || split_part(u.email,'@',2) end,
        'masked_account',c.masked_account,'symbol',c.symbol,'lots',c.verified_lots,
        'commission_usd',c.commission_usd,'status',c.status,'created_at',c.created_at
      ) order by c.created_at desc)
      from (
        select * from public.partner_commission_ledger
         where partner_user_id=v_user and entry_source='bbook_trade_close'
         order by created_at desc limit 100
      ) c
      left join auth.users u on u.id=c.referred_user_id
    ),'[]'::jsonb),
    'payouts',coalesce((
      select jsonb_agg(jsonb_build_object('id',p.id,'amount',p.amount,'method',p.payout_method,
        'status',p.status,'created_at',p.created_at,'admin_note',p.admin_note)
        order by p.created_at desc)
      from public.partner_payout_requests p where p.partner_user_id=v_user
    ),'[]'::jsonb),
    'transfers',coalesce((
      select jsonb_agg(jsonb_build_object('id',t.id,'amount',t.amount,'created_at',t.created_at,
        'account_id',t.trading_account_id) order by t.created_at desc)
      from public.partner_wallet_transfers t where t.partner_user_id=v_user
    ),'[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$function$;
revoke all on function public.partner_dashboard_snapshot() from public, anon;
grant execute on function public.partner_dashboard_snapshot() to authenticated;
notify pgrst, 'reload schema';
