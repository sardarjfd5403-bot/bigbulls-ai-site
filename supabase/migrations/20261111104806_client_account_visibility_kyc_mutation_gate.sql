-- Allow authenticated clients to read their own trading accounts while pending KYC.
-- Keep KYC + authenticator AAL2 as a restrictive gate for account mutations only.
drop policy if exists "client_kyc_aal2_gate" on public.trading_accounts;

drop policy if exists "client_kyc_aal2_gate_insert" on public.trading_accounts;
create policy "client_kyc_aal2_gate_insert"
on public.trading_accounts as restrictive
for insert to authenticated
with check (
  (select public.is_bigbulls_admin())
  or (select private.client_platform_access_allowed())
);

drop policy if exists "client_kyc_aal2_gate_update" on public.trading_accounts;
create policy "client_kyc_aal2_gate_update"
on public.trading_accounts as restrictive
for update to authenticated
using (
  (select public.is_bigbulls_admin())
  or (select private.client_platform_access_allowed())
)
with check (
  (select public.is_bigbulls_admin())
  or (select private.client_platform_access_allowed())
);

drop policy if exists "client_kyc_aal2_gate_delete" on public.trading_accounts;
create policy "client_kyc_aal2_gate_delete"
on public.trading_accounts as restrictive
for delete to authenticated
using (
  (select public.is_bigbulls_admin())
  or (select private.client_platform_access_allowed())
);
