-- BIGBULLS FX Market - KYC and partner workflows
-- Run after supabase/001-core-platform-schema.sql in Supabase SQL Editor.
-- KYC documents are stored in a PRIVATE bucket. Do not make this bucket public.

create table if not exists public.kyc_submissions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 legal_name text not null,
 date_of_birth date not null,
 country text not null,
 residential_address text not null,
 document_type text not null check(document_type in ('CNIC','Passport','Driving License')),
 document_front_path text not null,
 document_back_path text,
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 admin_note text,
 reviewed_by uuid references auth.users(id),
 reviewed_at timestamptz,
 created_at timestamptz not null default now()
);
create index if not exists kyc_submissions_user_created_idx on public.kyc_submissions(user_id,created_at desc);

create table if not exists public.partner_applications (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null unique references auth.users(id) on delete cascade,
 partner_type text not null check(partner_type in ('IB','Educator','Content Creator','Other')),
 business_name text,
 website_or_social text,
 audience_size integer check(audience_size is null or audience_size>=0),
 experience text,
 status text not null default 'pending' check(status in ('pending','approved','rejected','disabled')),
 referral_code text unique,
 admin_note text,
 reviewed_by uuid references auth.users(id),
 reviewed_at timestamptz,
 created_at timestamptz not null default now()
);

create table if not exists public.partner_referrals (
 id uuid primary key default gen_random_uuid(),
 partner_user_id uuid not null references auth.users(id) on delete cascade,
 referred_user_id uuid not null unique references auth.users(id) on delete cascade,
 referral_code text not null,
 created_at timestamptz not null default now(),
 constraint partner_cannot_refer_self check(partner_user_id <> referred_user_id)
);
create index if not exists partner_referrals_partner_idx on public.partner_referrals(partner_user_id);

create table if not exists public.partner_commission_ledger (
 id uuid primary key default gen_random_uuid(),
 partner_user_id uuid not null references auth.users(id) on delete cascade,
 referred_user_id uuid references auth.users(id) on delete set null,
 source_reference text,
 verified_lots numeric(18,2) not null default 0 check(verified_lots>=0),
 commission_usd numeric(18,2) not null check(commission_usd>=0),
 status text not null default 'pending' check(status in ('pending','approved','paid','rejected')),
 admin_note text,
 created_by uuid references auth.users(id),
 reviewed_by uuid references auth.users(id),
 reviewed_at timestamptz,
 paid_at timestamptz,
 created_at timestamptz not null default now()
);
create index if not exists partner_commission_partner_idx on public.partner_commission_ledger(partner_user_id,created_at desc);

alter table public.kyc_submissions enable row level security;
alter table public.partner_applications enable row level security;
alter table public.partner_referrals enable row level security;
alter table public.partner_commission_ledger enable row level security;

drop policy if exists "clients read own kyc" on public.kyc_submissions;
create policy "clients read own kyc" on public.kyc_submissions for select to authenticated
using(user_id=auth.uid() or public.is_bigbulls_admin());
drop policy if exists "clients submit own kyc" on public.kyc_submissions;
create policy "clients submit own kyc" on public.kyc_submissions for insert to authenticated
with check(user_id=auth.uid() and status='pending' and reviewed_by is null and reviewed_at is null);
drop policy if exists "admins review kyc" on public.kyc_submissions;
create policy "admins review kyc" on public.kyc_submissions for update to authenticated
using(public.is_bigbulls_admin()) with check(public.is_bigbulls_admin());

drop policy if exists "clients read own partner application" on public.partner_applications;
create policy "clients read own partner application" on public.partner_applications for select to authenticated
using(user_id=auth.uid() or public.is_bigbulls_admin());
drop policy if exists "clients apply as partner" on public.partner_applications;
create policy "clients apply as partner" on public.partner_applications for insert to authenticated
with check(user_id=auth.uid() and status='pending' and referral_code is null and reviewed_by is null);
drop policy if exists "admins manage partner applications" on public.partner_applications;
create policy "admins manage partner applications" on public.partner_applications for all to authenticated
using(public.is_bigbulls_admin()) with check(public.is_bigbulls_admin());

drop policy if exists "partners read own referrals" on public.partner_referrals;
create policy "partners read own referrals" on public.partner_referrals for select to authenticated
using(partner_user_id=auth.uid() or public.is_bigbulls_admin());
drop policy if exists "admins read referrals" on public.partner_referrals;
create policy "admins read referrals" on public.partner_referrals for all to authenticated
using(public.is_bigbulls_admin()) with check(public.is_bigbulls_admin());

drop policy if exists "partners read own commissions" on public.partner_commission_ledger;
create policy "partners read own commissions" on public.partner_commission_ledger for select to authenticated
using(partner_user_id=auth.uid() or public.is_bigbulls_admin());
drop policy if exists "admins manage commission ledger" on public.partner_commission_ledger;
create policy "admins manage commission ledger" on public.partner_commission_ledger for all to authenticated
using(public.is_bigbulls_admin()) with check(public.is_bigbulls_admin());

create or replace function public.assign_partner_referral_code()
returns trigger language plpgsql security definer set search_path=public
as $$
begin
 if new.status='approved' and (old.status is distinct from 'approved') and new.referral_code is null then
  new.referral_code := upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));
 end if;
 return new;
end;
$$;
drop trigger if exists partner_referral_code_on_approval on public.partner_applications;
create trigger partner_referral_code_on_approval before update of status on public.partner_applications
for each row execute function public.assign_partner_referral_code();

create or replace function public.capture_partner_referral()
returns trigger language plpgsql security definer set search_path=public,auth
as $$
declare v_code text; v_partner uuid;
begin
 v_code := upper(trim(coalesce(new.raw_user_meta_data->>'referral_code','')));
 if v_code <> '' then
  select user_id into v_partner from public.partner_applications
  where referral_code=v_code and status='approved' limit 1;
  if v_partner is not null and v_partner <> new.id then
   insert into public.partner_referrals(partner_user_id,referred_user_id,referral_code)
   values(v_partner,new.id,v_code) on conflict(referred_user_id) do nothing;
  end if;
 end if;
 return new;
end;
$$;
drop trigger if exists auth_user_partner_referral on auth.users;
create trigger auth_user_partner_referral after insert on auth.users
for each row execute function public.capture_partner_referral();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('kyc-documents','kyc-documents',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict(id) do update set public=false,file_size_limit=10485760,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "users upload own kyc documents" on storage.objects;
create policy "users upload own kyc documents" on storage.objects for insert to authenticated
with check(bucket_id='kyc-documents' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "users and admins read kyc documents" on storage.objects;
create policy "users and admins read kyc documents" on storage.objects for select to authenticated
using(bucket_id='kyc-documents' and ((storage.foldername(name))[1]=auth.uid()::text or public.is_bigbulls_admin()));
drop policy if exists "admins delete kyc documents" on storage.objects;
create policy "admins delete kyc documents" on storage.objects for delete to authenticated
using(bucket_id='kyc-documents' and public.is_bigbulls_admin());

grant select,insert,update on public.kyc_submissions,public.partner_applications to authenticated;
grant select,insert,update,delete on public.partner_referrals,public.partner_commission_ledger to authenticated;
notify pgrst,'reload schema';
