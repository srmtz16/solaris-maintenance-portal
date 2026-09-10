-- Adds provider-independent metadata so documents can move to AWS S3 later
-- without changing client QR routes or losing their system relationship.
begin;

alter table public."Documentos"
  add column if not exists storage_provider text not null default 'supabase',
  add column if not exists bucket_name text,
  add column if not exists object_path text,
  add column if not exists original_name text,
  add column if not exists mime_type text,
  add column if not exists file_size_bytes bigint,
  add column if not exists checksum_sha256 text;

alter table public."Documentos" drop constraint if exists documentos_storage_provider_check;
alter table public."Documentos" add constraint documentos_storage_provider_check
  check (storage_provider in ('supabase', 'aws'));
alter table public."Documentos" drop constraint if exists documentos_file_size_check;
alter table public."Documentos" add constraint documentos_file_size_check
  check (file_size_bytes is null or file_size_bytes > 0);
alter table public."Documentos" drop constraint if exists documentos_checksum_check;
alter table public."Documentos" add constraint documentos_checksum_check
  check (checksum_sha256 is null or checksum_sha256 ~ '^[0-9a-f]{64}$');

update public."Documentos"
set
  bucket_name = coalesce(bucket_name, 'system-documents'),
  object_path = coalesce(
    object_path,
    nullif(split_part(file_url, '/storage/v1/object/public/system-documents/', 2), '')
  )
where file_url like '%/storage/v1/object/public/system-documents/%';

update public."Documentos" d
set
  mime_type = coalesce(d.mime_type, o.metadata ->> 'mimetype'),
  file_size_bytes = coalesce(
    d.file_size_bytes,
    case when coalesce(o.metadata ->> 'size', '') ~ '^\d+$'
      then (o.metadata ->> 'size')::bigint
      else null
    end
  )
from storage.objects o
where o.bucket_id = d.bucket_name and o.name = d.object_path;

create index if not exists documentos_storage_location_idx
  on public."Documentos" (storage_provider, bucket_name, object_path);

create or replace function public.admin_get_portal_data()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if coalesce((select auth.jwt()) -> 'app_metadata' ->> 'role', '') <> 'admin' then
    raise exception using errcode = '42501', message = 'Administrator access required';
  end if;

  return jsonb_build_object(
    'systems', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'created_at', s.created_at, 'client_id', s.client_id,
        'system_code', s.system_code, 'public_token', s.public_token,
        'adress', s.adress, 'num_panels', s.num_panels,
        'panel_power_w', s.panel_power_w, 'panel_brand', s.panel_brand,
        'inverter_model', s.inverter_model, 'inverter_serial', s.inverter_serial,
        'installation_date', s.installation_date, 'system_status', s.system_status,
        'Clientes', jsonb_build_object(
          'id', c.id, 'full_name', c.full_name, 'phone', c.phone,
          'email', c.email, 'notes', c.notes, 'welcome_label', c.welcome_label
        )
      ) order by s.system_code)
      from public."Sistemas" s join public."Clientes" c on c.id = s.client_id
    ), '[]'::jsonb),
    'maintenance', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id, 'system_id', m.system_id, 'service_Date', m."service_Date",
        'service_type', m.service_type, 'technician_name', m.technician_name,
        'next_service_date', m.next_service_date
      ) order by m."service_Date" desc nulls last)
      from public."Maintainance" m
    ), '[]'::jsonb),
    'requests', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'status', r.status, 'request_type', r.request_type,
        'system_id', r.system_id, 'created_at', r.created_at
      ) order by r.created_at desc)
      from (select * from public.client_requests order by created_at desc limit 100) r
    ), '[]'::jsonb),
    'documents', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.id, 'created_at', d.created_at, 'system_id', d.system_id,
        'document_type', d.document_type, 'file_url', d.file_url,
        'description', d.description, 'storage_provider', d.storage_provider,
        'bucket_name', d.bucket_name, 'object_path', d.object_path,
        'original_name', d.original_name, 'mime_type', d.mime_type,
        'file_size_bytes', d.file_size_bytes, 'checksum_sha256', d.checksum_sha256
      ) order by d.created_at desc)
      from public."Documentos" d
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.admin_register_document_v2(
  p_system_code text,
  p_document_type text,
  p_file_url text,
  p_description text,
  p_storage_provider text,
  p_bucket_name text,
  p_object_path text,
  p_original_name text,
  p_mime_type text,
  p_file_size_bytes bigint,
  p_checksum_sha256 text
) returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_document_id bigint;
begin
  if coalesce((select auth.jwt()) -> 'app_metadata' ->> 'role', '') <> 'admin' then
    raise exception using errcode = '42501', message = 'Administrator access required';
  end if;

  p_system_code := btrim(p_system_code);
  p_document_type := btrim(p_document_type);
  p_file_url := btrim(p_file_url);
  p_description := nullif(btrim(p_description), '');
  p_storage_provider := lower(btrim(p_storage_provider));
  p_bucket_name := btrim(p_bucket_name);
  p_object_path := btrim(p_object_path);
  p_original_name := btrim(p_original_name);
  p_mime_type := lower(btrim(p_mime_type));
  p_checksum_sha256 := lower(btrim(p_checksum_sha256));

  if p_document_type not in ('Diagrama unifilar', 'Reporte', 'Fotografías')
    or p_storage_provider not in ('supabase', 'aws')
    or p_file_url !~ '^https://' or char_length(p_file_url) > 2000
    or p_bucket_name = '' or char_length(p_bucket_name) > 255
    or p_object_path = '' or char_length(p_object_path) > 1024
    or p_object_path like '/%' or p_object_path like '%..%'
    or p_original_name = '' or char_length(p_original_name) > 255
    or p_mime_type = '' or char_length(p_mime_type) > 255
    or p_file_size_bytes <= 0
    or p_checksum_sha256 !~ '^[0-9a-f]{64}$'
    or not exists (select 1 from public."Sistemas" where system_code = p_system_code)
  then
    raise exception using errcode = '22023', message = 'Invalid document data';
  end if;

  insert into public."Documentos" (
    system_id, maintenance_id, document_type, file_url, description,
    storage_provider, bucket_name, object_path, original_name, mime_type,
    file_size_bytes, checksum_sha256
  ) values (
    p_system_code, null, p_document_type, p_file_url, p_description,
    p_storage_provider, p_bucket_name, p_object_path, p_original_name, p_mime_type,
    p_file_size_bytes, p_checksum_sha256
  ) returning id into v_document_id;

  return v_document_id;
end;
$$;

revoke all on function public.admin_register_document_v2(text, text, text, text, text, text, text, text, text, bigint, text) from public;
grant execute on function public.admin_register_document_v2(text, text, text, text, text, text, text, text, text, bigint, text) to authenticated;
notify pgrst, 'reload schema';
commit;
