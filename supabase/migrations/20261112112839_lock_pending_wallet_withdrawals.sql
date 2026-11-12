do $$
declare
  v_def text;
  v_new text;
begin
  v_def:=pg_get_functiondef('public.admin_review_wallet_transaction(uuid,text,text)'::regprocedure);
  v_new:=replace(v_def,
    'if v_tx.status not in (''pending'',''processing'') then',
    'if v_tx.status not in (''pending'',''otp_pending'',''processing'') then');
  v_new:=replace(v_new,
    'and status=''processing'' and id<>v_tx.id;',
    'and status in (''pending'',''otp_pending'',''processing'') and id<>v_tx.id;');
  if v_new=v_def then raise exception 'No admin wallet review status guards were updated'; end if;
  execute v_new;

  v_def:=pg_get_functiondef('public.client_funds_transfer(text,uuid,text,uuid,numeric,uuid,text)'::regprocedure);
  v_new:=replace(v_def,
    'and kind=''withdrawal'' and status=''processing'';',
    'and kind=''withdrawal'' and status in (''pending'',''otp_pending'',''processing'');');
  if v_new=v_def then raise exception 'No client transfer withdrawal locks were updated'; end if;
  execute v_new;

  v_def:=pg_get_functiondef('public.bb_bbook_open_position(jsonb)'::regprocedure);
  v_new:=replace(v_def,
    'and kind=''withdrawal'' and status=''processing'';',
    'and kind=''withdrawal'' and status in (''pending'',''otp_pending'',''processing'');');
  if v_new=v_def then raise exception 'No B-Book withdrawal margin locks were updated'; end if;
  execute v_new;
end $$;
