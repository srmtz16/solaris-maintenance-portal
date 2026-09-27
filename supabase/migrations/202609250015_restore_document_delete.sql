-- Restore the existing administrator document permissions required by DELETE API.
-- Viewer accounts continue to have no direct table access.
begin;
drop policy if exists admin_read_documents on public."Documentos";
create policy admin_read_documents on public."Documentos"
for select to authenticated
using ((select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin');
drop policy if exists admin_delete_documents on public."Documentos";
create policy admin_delete_documents on public."Documentos"
for delete to authenticated
using ((select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin');
commit;
