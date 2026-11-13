create or replace function public.bb_ai_set_auto_trade(
 p_account_id uuid, p_enabled boolean, p_reward_pct numeric default 2.50
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare
 v_user uuid := auth.uid();
 v_account public.trading_accounts%rowtype;
 v_result public.bb_ai_auto_trade_settings%rowtype;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 if p_reward_pct is null or p_reward_pct < 2 or p_reward_pct > 3 then
   raise exception 'Reward target must be between 2 and 3 percent of equity';
 end if;
 select * into v_account from public.trading_accounts
 where id=p_account_id and user_id=v_user and deleted_at is null and archived_at is null
 for update;
 if not found then raise exception 'Selected trading account was not found'; end if;
 if p_enabled then
   if lower(coalesce(v_account.status,'')) <> 'approved' then
     raise exception 'Trading account must be approved before AI Auto-Trade can be enabled';
   end if;
   if lower(coalesce(v_account.account_mode,'')) <> 'real' then
     raise exception 'AI Auto-Trade is only available for Real accounts';
   end if;
   if not exists (
     select 1 from public.kyc_submissions k
     where k.user_id=v_user and lower(coalesce(k.status,''))='approved'
   ) then
     raise exception 'Approved KYC is required before AI Auto-Trade can be enabled';
   end if;
 end if;
 insert into public.bb_ai_auto_trade_settings(user_id,account_id,enabled,risk_pct,reward_pct,updated_at)
 values(v_user,p_account_id,p_enabled,3.00,p_reward_pct,now())
 on conflict(user_id,account_id) do update
 set enabled=excluded.enabled,reward_pct=excluded.reward_pct,updated_at=now()
 returning * into v_result;
 return jsonb_build_object('success',true,'enabled',v_result.enabled,
  'account_id',v_result.account_id,'risk_pct',v_result.risk_pct,'reward_pct',v_result.reward_pct);
end $$;
revoke all on function public.bb_ai_set_auto_trade(uuid,boolean,numeric) from public,anon;
grant execute on function public.bb_ai_set_auto_trade(uuid,boolean,numeric) to authenticated;
