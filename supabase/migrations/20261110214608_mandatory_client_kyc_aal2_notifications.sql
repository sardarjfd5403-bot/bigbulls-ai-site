-- Mandatory client KYC + AAL2 access gate, KYC review notifications and admin reason codes.
begin;

alter table public.kyc_submissions
  add column if not exists rejection_reasons text[] not null default '{}';

create table if not exists public.client_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  message text not null,
  category text not null default 'account',
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists client_notifications_user_created_idx
  on public.client_notifications(user_id, created_at desc);

alter table public.client_notifications enable row level security;
drop policy if exists "clients read own notifications" on public.client_notifications;
create policy "clients read own notifications"
  on public.client_notifications for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists "clients mark own notifications read" on public.client_notifications;
create policy "clients mark own notifications read"
  on public.client_notifications for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
revoke all on public.client_notifications from anon;
revoke update on table public.client_notifications from authenticated;
grant select on public.client_notifications to authenticated;
grant update (read_at) on table public.client_notifications to authenticated;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create or replace function private.client_platform_access_allowed()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce((auth.jwt() ->> 'aal') = 'aal2', false)
    and exists (
      select 1 from public.kyc_submissions k
      where k.user_id = (select auth.uid()) and k.status = 'approved'
    );
$$;
revoke all on function private.client_platform_access_allowed() from public, anon, authenticated;
grant execute on function private.client_platform_access_allowed() to authenticated;

create or replace function private.notify_kyc_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_title text; v_message text;
begin
  if tg_op = 'INSERT' then
    v_title := 'KYC submitted';
    v_message := 'Your identity verification was submitted and is awaiting review.';
  elsif new.status is distinct from old.status then
    if new.status = 'approved' then
      v_title := 'KYC verified';
      v_message := 'Your identity verification is approved. Set up authenticator 2FA to unlock the client platform.';
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
  values (new.user_id,v_title,v_message,'kyc',jsonb_build_object(
    'kyc_submission_id',new.id,'status',new.status,
    'rejection_reasons',coalesce(new.rejection_reasons,'{}'::text[]),
    'admin_note',coalesce(new.admin_note,'')));
  return new;
end;
$$;
revoke all on function private.notify_kyc_status_change() from public, anon, authenticated;
drop trigger if exists kyc_notify_status_change on public.kyc_submissions;
create trigger kyc_notify_status_change
after insert or update of status, admin_note, rejection_reasons
on public.kyc_submissions for each row
execute function private.notify_kyc_status_change();

-- Preserve each table's existing ownership policy; this adds a mandatory
-- second factor and approved-KYC condition for client-owned rows.
do $$
declare r record;
begin
  for r in
    select c.table_schema,c.table_name
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema=c.table_schema and t.table_name=c.table_name
    where c.table_schema='public' and c.column_name='user_id'
      and t.table_type='BASE TABLE'
      and c.table_name not in ('kyc_submissions','client_notifications')
  loop
    execute format('drop policy if exists %I on %I.%I','client_kyc_aal2_gate',r.table_schema,r.table_name);
    execute format(
      'create policy %I on %I.%I as restrictive for all to authenticated using (public.is_bigbulls_admin() or private.client_platform_access_allowed()) with check (public.is_bigbulls_admin() or private.client_platform_access_allowed())',
      'client_kyc_aal2_gate',r.table_schema,r.table_name);
  end loop;
end $$;

notify pgrst,'reload schema';
commit;
