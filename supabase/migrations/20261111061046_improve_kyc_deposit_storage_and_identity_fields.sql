alter table public.kyc_submissions
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists document_number text;

drop policy if exists "clients replace own kyc documents" on storage.objects;
create policy "clients replace own kyc documents"
on storage.objects for update to authenticated
using (bucket_id = 'kyc-documents' and (storage.foldername(name))[1] = (select auth.uid()::text))
with check (bucket_id = 'kyc-documents' and (storage.foldername(name))[1] = (select auth.uid()::text));

drop policy if exists "clients replace own payment proofs" on storage.objects;
create policy "clients replace own payment proofs"
on storage.objects for update to authenticated
using (bucket_id = 'payment-proofs' and split_part(name, '/', 1) = (select auth.uid()::text))
with check (bucket_id = 'payment-proofs' and split_part(name, '/', 1) = (select auth.uid()::text));
