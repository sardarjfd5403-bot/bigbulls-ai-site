begin;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('kyc-documents','kyc-documents',false,20971520,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update
set name=excluded.name, public=false, file_size_limit=20971520, allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists "users upload own kyc documents" on storage.objects;
create policy "users upload own kyc documents" on storage.objects for insert to authenticated
with check (bucket_id='kyc-documents' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "users and admins read kyc documents" on storage.objects;
create policy "users and admins read kyc documents" on storage.objects for select to authenticated
using (bucket_id='kyc-documents' and ((storage.foldername(name))[1]=(select auth.uid())::text or public.is_bigbulls_admin()));
drop policy if exists "admins delete kyc documents" on storage.objects;
create policy "admins delete kyc documents" on storage.objects for delete to authenticated
using (bucket_id='kyc-documents' and public.is_bigbulls_admin());
notify pgrst,'reload schema';
commit;
