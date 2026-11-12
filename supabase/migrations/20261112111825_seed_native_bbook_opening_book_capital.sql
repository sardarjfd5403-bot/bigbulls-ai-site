do $$
declare
  v_pool public.bb_bbook_liquidity_pool%rowtype;
  v_amount numeric(20,8) := 99975535.00;
begin
  select * into v_pool
  from public.bb_bbook_liquidity_pool
  where singleton = true
  for update;

  if not found then
    raise exception 'B-Book liquidity pool singleton is missing; refusing to seed capital';
  end if;

  if exists (
    select 1 from public.bb_bbook_liquidity_ledger
    where note = 'INITIAL CONFIGURED INTERNAL BOOK CAPITAL — NOT VERIFIED CASH RESERVES'
  ) then
    raise notice 'Opening B-Book book-capital entry already exists; no change made';
    return;
  end if;

  if v_pool.capital_balance <> 0 then
    raise exception 'Pool balance is already non-zero; refusing to overwrite existing capital';
  end if;

  update public.bb_bbook_liquidity_pool
  set capital_balance = v_amount, updated_at = now()
  where singleton = true;

  insert into public.bb_bbook_liquidity_ledger(
    entry_type, direction, amount, balance_before, balance_after,
    reserved_before, reserved_after, actor_user_id, note
  ) values (
    'DEPOSIT', 'CREDIT', v_amount, 0, v_amount,
    v_pool.reserved_payout, v_pool.reserved_payout, null,
    'INITIAL CONFIGURED INTERNAL BOOK CAPITAL — NOT VERIFIED CASH RESERVES'
  );
end $$;
