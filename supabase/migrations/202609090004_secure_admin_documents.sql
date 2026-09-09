-- Secure administrator access and document publishing for the client portal.
-- Apply after 202609060003_expose_public_document_metadata.sql.
begin;

alter table public."Sistemas" enable row level security;
alter table public."Clientes" enable row level security;
alter table public."Documentos" enable row level security;

revoke all on table public."Sistemas" from anon;
revoke all on table public."Clientes" from anon;
revoke all on table public."Documentos" from anon;
grant select on table public."Sistemas" to authenticated;
grant select on table public."Clientes" to authenticated;
grant select, insert, update, delete on table public."Documentos" to authenticated;

drop policy if exists admin_read_systems on public."Sistemas";
create policy admin_read_systems on public."Sistemas"
for select to authenticated
using ((select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin');

drop policy if exists admin_read_clients on public."Clientes";
create policy admin_read_clients on public."Clientes"
for select to authenticated
using ((select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin');

drop policy if exists admin_read_documents on public."Documentos";
create policy admin_read_documents on public."Documentos"
for select to authenticated
using ((select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin');

drop policy if exists admin_insert_documents on public."Documentos";
create policy admin_insert_documents on public."Documentos"
for insert to authenticated
with check ((select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin');

drop policy if exists admin_update_documents on public."Documentos";
create policy admin_update_documents on public."Documentos"
for update to authenticated
using ((select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin')
with check ((select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin');

drop policy if exists admin_delete_documents on public."Documentos";
create policy admin_delete_documents on public."Documentos"
for delete to authenticated
using ((select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'system-documents',
  'system-documents',
  true,
  15728640,
  array['application/pdf', 'image/png', 'image/jpeg']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists admin_read_system_documents on storage.objects;
create policy admin_read_system_documents on storage.objects
for select to authenticated
using (
  bucket_id = 'system-documents'
  and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
);

drop policy if exists admin_upload_system_documents on storage.objects;
create policy admin_upload_system_documents on storage.objects
for insert to authenticated
with check (
  bucket_id = 'system-documents'
  and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
);

drop policy if exists admin_update_system_documents on storage.objects;
create policy admin_update_system_documents on storage.objects
for update to authenticated
using (
  bucket_id = 'system-documents'
  and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
)
with check (
  bucket_id = 'system-documents'
  and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
);

drop policy if exists admin_delete_system_documents on storage.objects;
create policy admin_delete_system_documents on storage.objects
for delete to authenticated
using (
  bucket_id = 'system-documents'
  and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
);

notify pgrst, 'reload schema';
commit;

-- ONE-TIME ADMIN SETUP (run separately after creating the user in
-- Supabase Dashboard > Authentication > Users):
-- update auth.users
-- set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
-- where email = 'YOUR_ADMIN_EMAIL';
