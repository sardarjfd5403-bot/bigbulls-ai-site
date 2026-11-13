create table if not exists public.bb_ai_auto_trade_settings (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 account_id uuid not null references public.trading_accounts(id) on delete cascade,
 enabled boolean not null default false,
 risk_pct numeric(5,2) not null default 3.00 check (risk_pct = 3.00),
 reward_pct numeric(5,2) not null default 2.50 check (reward_pct between 2.00 and 3.00),
 max_daily_loss_pct numeric(5,2) not null default 6.00 check (max_daily_loss_pct between 1.00 and 10.00),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(user_id, account_id)
);
create index if not exists bb_ai_auto_trade_enabled_idx
 on public.bb_ai_auto_trade_settings(enabled, account_id);
alter table public.bb_ai_auto_trade_settings enable row level security;
drop policy if exists "Clients read own AI auto trade settings" on public.bb_ai_auto_trade_settings;
create policy "Clients read own AI auto trade settings"
 on public.bb_ai_auto_trade_settings for select to authenticated using(user_id=auth.uid());
revoke all on public.bb_ai_auto_trade_settings from anon, authenticated;
grant select on public.bb_ai_auto_trade_settings to authenticated;
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
 if p_reward_pct < 2 or p_reward_pct > 3 then
   raise exception 'Reward target must be between 2%% and 3%% of equity';
 end if;
 select * into v_account from public.trading_accounts
 where id=p_account_id and user_id=v_user and deleted_at is null and archived_at is null for update;
 if not found then raise exception 'Selected trading account was not found'; end if;
 if lower(coalesce(v_account.status,'')) not in ('active','approved','enabled') then
   raise exception 'Trading account is not active/approved';
 end if;
 if p_enabled and lower(coalesce(v_account.account_type,'')) not like '%%real%%'
    and lower(coalesce(v_account.account_mode,'')) not like '%%real%%' then
   raise exception 'Auto-trading can only be enabled for an approved Real account';
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
