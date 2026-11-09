-- BIGBULLS: seed the admin-provided deposit receiving wallets.
-- Safe to re-run: updates the same asset/network records and keeps them enabled.
insert into public.crypto_wallets (asset, network, label, address, active)
values
  ('BTC', 'Bitcoin', 'Official BTC deposit wallet', 'bc1ql0knklkgpxqdarhxadxvj74cgj5649zsqzqqxs', true),
  ('ETH', 'Ethereum (ERC20)', 'Official ETH deposit wallet', '0x5a5355380906Fe9e37326a1A8Fb1392de9FB1663', true),
  ('USDT', 'TRC20', 'Official USDT TRC20 deposit wallet', 'TKgTLmmBjfVBbPCZmyxiCTmMdx2GBrVGWE', true),
  ('USDT', 'BEP20', 'Official USDT BEP20 deposit wallet', '0x5a5355380906Fe9e37326a1A8Fb1392de9FB1663', true)
on conflict (asset, network)
do update set
  label = excluded.label,
  address = excluded.address,
  active = true;
