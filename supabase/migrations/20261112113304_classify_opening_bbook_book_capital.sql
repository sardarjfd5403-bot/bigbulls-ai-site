alter table public.bb_bbook_liquidity_ledger
  drop constraint if exists bb_bbook_liquidity_ledger_entry_type_check;
alter table public.bb_bbook_liquidity_ledger
  add constraint bb_bbook_liquidity_ledger_entry_type_check
  check (entry_type = any (array[
    'DEPOSIT','WITHDRAWAL','CLIENT_PROFIT','CLIENT_LOSS',
    'RESERVE','RELEASE','ADMIN_ADJUSTMENT','OPENING_CAPITAL'
  ]));
update public.bb_bbook_liquidity_ledger
set entry_type='OPENING_CAPITAL'
where note='INITIAL CONFIGURED INTERNAL BOOK CAPITAL — NOT VERIFIED CASH RESERVES'
  and entry_type='DEPOSIT';
