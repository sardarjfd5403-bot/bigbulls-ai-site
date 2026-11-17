-- This trigger-returning function has no attached database trigger in the
-- current production catalog. Remove its unnecessary authenticated RPC grant.
-- Do not attach it or alter withdrawal approval behavior in this hardening patch.
revoke execute on function public.enforce_withdrawal_email_otp_before_processing()
  from authenticated;
