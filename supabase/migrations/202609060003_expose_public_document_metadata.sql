-- Exposes read-only document metadata to the public QR portal.
-- Run after 202609040002_add_home_qr_identity.sql.
begin;

alter table public."Clientes" add column if not exists welcome_label text not null default 'Bienvenido';
alter table public."Clientes" drop constraint if exists clientes_welcome_label_check;
alter table public."Clientes" add constraint clientes_welcome_label_check check (welcome_label in ('Bienvenido', 'Bienvenida'));

-- Initial configuration for the client currently linked to FV-0001.
update public."Clientes" c
set welcome_label = 'Bienvenida'
from public."Sistemas" s
where s.client_id = c.id and s.system_code = 'FV-0001';

create or replace function public.get_public_system(p_public_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', s.system_code,
    'clientName', (select c.full_name from public."Clientes" c where c.id = s.client_id),
    'welcomeLabel', (select c.welcome_label from public."Clientes" c where c.id = s.client_id),
    'installedPower', case when s.num_panels is null or s.panel_power_w is null then null else round((s.num_panels * s.panel_power_w) / 1000.0, 2) end,
    'installationDate', s.installation_date,
    'lastMaintenance', (select max(m."service_Date") from public."Maintainance" m where m.system_id = s.system_code),
    'nextMaintenance', (select m.next_service_date from public."Maintainance" m where m.system_id = s.system_code order by m."service_Date" desc nulls last limit 1),
    'maintenanceHistory', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', m."service_Date", 'type', m.service_type, 'technician', m.technician_name,
        'hasReport', exists(select 1 from public."Documentos" d where d.maintenance_id = m.id::text),
        'hasPhotos', exists(select 1 from public."Documentos" d where d.maintenance_id = m.id::text and lower(d.document_type) like '%foto%'),
        'hasObservations', coalesce(m.findings, m.recommendations, m.work_performed) is not null
      ) order by m."service_Date" desc)
      from public."Maintainance" m where m.system_id = s.system_code
    ), '[]'::jsonb),
    'documents', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', coalesce(d.description, d.document_type, 'Documento'),
        'type', coalesce(d.document_type, 'Archivo'),
        'fileUrl', d.file_url,
        'publishedAt', d.created_at
      ) order by d.created_at desc)
      from public."Documentos" d where d.system_id = s.system_code
    ), '[]'::jsonb),
    'observations', coalesce((
      select to_jsonb(array_remove(array[m.work_performed, m.findings, m.recommendations], null))
      from public."Maintainance" m where m.system_id = s.system_code order by m."service_Date" desc nulls last limit 1
    ), '[]'::jsonb)
  )
  from public."Sistemas" s
  where s.public_token = p_public_token;
$$;

revoke all on function public.get_public_system(uuid) from public;
grant execute on function public.get_public_system(uuid) to anon;
notify pgrst, 'reload schema';
commit;
