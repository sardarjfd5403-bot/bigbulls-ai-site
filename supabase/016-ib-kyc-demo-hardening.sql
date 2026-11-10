-- Privilege hardening and indexes for the KYC, IB and demo account workflows.
revoke all on function public.seed_mt5_demo_account() from public, anon, authenticated;
create index if not exists kyc_submissions_user_created_idx on public.kyc_submissions(user_id, created_at desc);
create index if not exists kyc_submissions_status_created_idx on public.kyc_submissions(status, created_at desc);
create index if not exists kyc_submissions_reviewed_by_idx on public.kyc_submissions(reviewed_by);
create index if not exists partner_applications_status_created_idx on public.partner_applications(status, created_at desc);
create index if not exists partner_applications_reviewed_by_idx on public.partner_applications(reviewed_by);
create index if not exists partner_commission_status_created_idx on public.partner_commission_ledger(status, created_at desc);
create index if not exists partner_commission_referred_user_idx on public.partner_commission_ledger(referred_user_id);
create index if not exists partner_commission_created_by_idx on public.partner_commission_ledger(created_by);
create index if not exists partner_commission_reviewed_by_idx on public.partner_commission_ledger(reviewed_by);
notify pgrst, 'reload schema';
