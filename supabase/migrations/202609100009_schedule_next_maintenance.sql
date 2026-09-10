-- Lets an administrator schedule the date shown as "Próximo recomendado"
-- without creating a completed maintenance-history entry.
begin;

alter table public."Sistemas"
  add column if not exists scheduled_maintenance_date date;

create or replace function public.admin_get_scheduled_maintenance(p_system_code text)
returns date
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_date date;
begin
  if coalesce((select auth.jwt()) -> 'app_metadata' ->> 'role', '') <> 'admin' then
    raise exception using errcode = '42501', message = 'Administrator access required';
  end if;

  select s.scheduled_maintenance_date into v_date
  from public."Sistemas" s
  where s.system_code = btrim(p_system_code);

  if not found then
    raise exception using errcode = '22023', message = 'System not found';
  end if;
  return v_date;
end;
$$;

create or replace function public.admin_schedule_maintenance(
  p_system_code text,
  p_scheduled_date date
) returns date
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce((select auth.jwt()) -> 'app_metadata' ->> 'role', '') <> 'admin' then
    raise exception using errcode = '42501', message = 'Administrator access required';
  end if;

  p_system_code := btrim(p_system_code);
  if p_scheduled_date is not null and p_scheduled_date < current_date then
    raise exception using errcode = '22023', message = 'Scheduled date cannot be in the past';
  end if;

  update public."Sistemas"
  set scheduled_maintenance_date = p_scheduled_date
  where system_code = p_system_code;

  if not found then
    raise exception using errcode = '22023', message = 'System not found';
  end if;
  return p_scheduled_date;
end;
$$;

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
    'numPanels', s.num_panels,
    'panelPowerW', s.panel_power_w,
    'panelBrand', s.panel_brand,
    'inverterModel', s.inverter_model,
    'inverterSerial', s.inverter_serial,
    'systemStatus', s.system_status,
    'installationDate', s.installation_date,
    'lastMaintenance', (select max(m."service_Date") from public."Maintainance" m where m.system_id = s.system_code),
    'nextMaintenance', coalesce(
      s.scheduled_maintenance_date,
      (select m.next_service_date from public."Maintainance" m where m.system_id = s.system_code order by m."service_Date" desc nulls last limit 1)
    ),
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

revoke all on function public.admin_get_scheduled_maintenance(text) from public;
grant execute on function public.admin_get_scheduled_maintenance(text) to authenticated;
revoke all on function public.admin_schedule_maintenance(text, date) from public;
grant execute on function public.admin_schedule_maintenance(text, date) to authenticated;
revoke all on function public.get_public_system(uuid) from public;
grant execute on function public.get_public_system(uuid) to anon;
notify pgrst, 'reload schema';
commit;
