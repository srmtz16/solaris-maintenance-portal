begin;

-- Separate from Documentos: client QR RPCs and the viewer portal never query this table.
create table public.admin_documents (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  system_id text not null references public."Sistemas"(system_code) on delete restrict,
  document_type text not null check (document_type in ('Convenio de interconexión', 'Contrato de contraprestación', 'Acuse de trámite CFE', 'Garantía', 'Otro documento')),
  description text check (char_length(description) <= 2000),
  object_path text not null unique check (object_path not like '/%' and object_path not like '%..%' and object_path like system_id || '/%'),
  original_name text not null check (char_length(original_name) between 1 and 255),
  mime_type text not null check (mime_type in ('application/pdf', 'image/png', 'image/jpeg')),
  file_size_bytes bigint not null check (file_size_bytes between 1 and 15728640),
  checksum_sha256 text not null check (checksum_sha256 ~ '^[0-9a-f]{64}$')
);
create index admin_documents_system_idx on public.admin_documents(system_id, created_at desc);
alter table public.admin_documents enable row level security;
revoke all on public.admin_documents from public, anon, authenticated;
grant select, insert, delete on public.admin_documents to authenticated;
create policy admin_documents_access on public.admin_documents for all to authenticated
  using ((select private.current_portal_role()) = 'admin')
  with check ((select private.current_portal_role()) = 'admin');

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('admin-documents','admin-documents',false,15728640,array['application/pdf','image/png','image/jpeg']);
create policy admin_documents_storage_access on storage.objects for all to authenticated
  using (bucket_id='admin-documents' and (select private.current_portal_role())='admin')
  with check (bucket_id='admin-documents' and (select private.current_portal_role())='admin');
-- Also constrain any broader pre-existing storage policies for this private bucket.
create policy admin_documents_storage_guard on storage.objects as restrictive for all to authenticated
  using (bucket_id <> 'admin-documents' or (select private.current_portal_role())='admin')
  with check (bucket_id <> 'admin-documents' or (select private.current_portal_role())='admin');
create policy admin_documents_storage_anon_guard on storage.objects as restrictive for all to anon
  using (bucket_id <> 'admin-documents') with check (bucket_id <> 'admin-documents');
notify pgrst, 'reload schema';
commit;

