CREATE OR REPLACE FUNCTION public.create_client_trading_account(
  p_account_mode text,
  p_account_type text,
  p_currency text,
  p_display_name text,
  p_platform text,
  p_leverage text
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_number bigint;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF NOT public.is_bigbulls_admin() AND NOT private.client_platform_access_allowed() THEN
    RAISE EXCEPTION 'KYC approval and authenticator 2FA required';
  END IF;
  IF p_account_mode NOT IN ('real','demo') THEN RAISE EXCEPTION 'Invalid account environment'; END IF;
  IF p_account_type NOT IN ('Pro','Zero','Speed','Cent') THEN RAISE EXCEPTION 'Invalid account type'; END IF;
  IF p_currency <> 'USD' THEN RAISE EXCEPTION 'Only USD portal accounts are supported until currency conversion is configured'; END IF;
  IF p_platform NOT IN ('MT4','MT5') THEN RAISE EXCEPTION 'Select MT4 or MT5 as your requested platform'; END IF;
  IF p_leverage NOT IN ('1:100','1:200','1:500','1:1000','1:2000') THEN RAISE EXCEPTION 'Unsupported leverage request'; END IF;
  IF length(trim(coalesce(p_display_name,''))) NOT BETWEEN 1 AND 40 THEN
    RAISE EXCEPTION 'Account name must be 1-40 characters';
  END IF;

  INSERT INTO public.trading_accounts
    (user_id,account_type,platform,currency,status,account_mode,display_name,requested_leverage)
  VALUES
    (auth.uid(),p_account_type,p_platform,'USD','pending',p_account_mode,trim(p_display_name),p_leverage)
  RETURNING account_number INTO v_number;

  RETURN v_number;
END;
$function$;

CREATE OR REPLACE FUNCTION public.manage_client_trading_account(
  p_account_id uuid,
  p_action text,
  p_display_name text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT public.is_bigbulls_admin() AND NOT private.client_platform_access_allowed() THEN
    RAISE EXCEPTION 'KYC approval and authenticator 2FA required';
  END IF;

  IF p_action='rename' THEN
    IF length(trim(coalesce(p_display_name,''))) NOT BETWEEN 1 AND 40 THEN
      RAISE EXCEPTION 'Account name must be 1-40 characters';
    END IF;
    UPDATE public.trading_accounts
      SET display_name=trim(p_display_name)
      WHERE id=p_account_id AND user_id=auth.uid()
        AND archived_at IS NULL AND deleted_at IS NULL;
  ELSIF p_action='archive' THEN
    UPDATE public.trading_accounts SET archived_at=now()
      WHERE id=p_account_id AND user_id=auth.uid()
        AND archived_at IS NULL AND deleted_at IS NULL;
  ELSIF p_action='restore' THEN
    UPDATE public.trading_accounts
      SET archived_at=NULL,
          zero_balance_since=CASE WHEN balance=0 THEN now() ELSE NULL END
      WHERE id=p_account_id AND user_id=auth.uid()
        AND archived_at IS NOT NULL AND deleted_at IS NULL;
  ELSIF p_action='delete' THEN
    UPDATE public.trading_accounts SET deleted_at=now()
      WHERE id=p_account_id AND user_id=auth.uid() AND deleted_at IS NULL;
  ELSE
    RAISE EXCEPTION 'Unsupported account action';
  END IF;

  IF NOT FOUND THEN RAISE EXCEPTION 'Account not found or action not allowed'; END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_client_trading_account(text,text,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_client_trading_account(text,text,text,text,text,text) TO authenticated;
REVOKE ALL ON FUNCTION public.manage_client_trading_account(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.manage_client_trading_account(uuid,text,text) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_adjust_account_balance(uuid,numeric,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_adjust_account_balance(uuid,numeric,text) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_complete_withdrawal(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_complete_withdrawal(uuid,text) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_review_account_transfer(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_review_account_transfer(uuid,text,text) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_review_product_order(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_review_product_order(uuid,text,text) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_review_trading_account(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_review_trading_account(uuid,text,text) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_review_wallet_transaction(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_review_wallet_transaction(uuid,text,text) TO authenticated;
