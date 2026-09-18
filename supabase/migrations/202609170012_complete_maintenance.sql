-- Record completed work, independently from future appointments.
begin;
alter table public."Maintainance" add column if not exists completion_request_id uuid;
create unique index if not exists maintenance_completion_request_unique
  on public."Maintainance" (completion_request_id);

create or replace function public.admin_complete_maintenance(
  p_request_id uuid, p_system_code text, p_service_date date,
  p_service_type text, p_technician text, p_work text,
  p_findings text, p_recommendations text, p_next_date date
) returns bigint
language plpgsql security definer set search_path = ''
as $$
declare
  v_id bigint;
  v_latest date;
begin
  if coalesce((select auth.jwt())->'app_metadata'->>'role', '') <> 'admin' then
    raise exception using errcode='42501', message='Administrator access required';
  end if;
  p_system_code := btrim(p_system_code);
  p_technician := btrim(p_technician);
  p_work := btrim(p_work);
  p_findings := nullif(btrim(p_findings), '');
  p_recommendations := nullif(btrim(p_recommendations), '');
  if p_request_id is null or p_service_date is null
    or p_service_date > (now() at time zone 'America/Mexico_City')::date
    or p_service_type is null or p_service_type not in ('Mantenimiento preventivo','Mantenimiento correctivo','Limpieza de módulos','Inspección eléctrica')
    or coalesce(length(p_technician),0) not between 2 and 120
    or coalesce(length(p_work),0) not between 5 and 3000
    or length(p_findings)>3000 or length(p_recommendations)>3000
    or (p_next_date is not null and p_next_date <= p_service_date)
  then
    raise exception using errcode='22023', message='Invalid maintenance data';
  end if;
  perform 1 from public."Sistemas" where system_code=p_system_code for update;
  if not found then
    raise exception using errcode='22023', message='System not found';
  end if;
  select id into v_id from public."Maintainance"
    where completion_request_id=p_request_id and system_id=p_system_code;
  if found then return v_id; end if;
  select max("service_Date") into v_latest from public."Maintainance" where system_id=p_system_code;
  insert into public."Maintainance" (system_id,"service_Date",service_type,technician_name,
    work_performed,findings,recommendations,next_service_date,completion_request_id)
  values (p_system_code,p_service_date,p_service_type,p_technician,p_work,
    p_findings,p_recommendations,p_next_date,p_request_id) returning id into v_id;
  -- A historical entry must not replace a newer appointment or latest service.
  if v_latest is null or p_service_date >= v_latest then
    update public."Sistemas" set scheduled_maintenance_date =
      case when scheduled_maintenance_date > p_service_date then scheduled_maintenance_date
      else p_next_date end
    where system_code=p_system_code;
  end if;
  return v_id;
end;
$$;
revoke all on function public.admin_complete_maintenance(uuid,text,date,text,text,text,text,text,date) from public;
grant execute on function public.admin_complete_maintenance(uuid,text,date,text,text,text,text,text,date) to authenticated;
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
      (select m.next_service_date from public."Maintainance" m where m.system_id = s.system_code order by m."service_Date" desc nulls last, m.id desc limit 1)
    ),
    'maintenanceHistory', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id::text, 'work', m.work_performed, 'findings', m.findings, 'recommendations', m.recommendations, 'date', m."service_Date", 'type', m.service_type, 'technician', m.technician_name,
        'hasReport', exists(select 1 from public."Documentos" d where d.maintenance_id = m.id::text),
        'hasPhotos', exists(select 1 from public."Documentos" d where d.maintenance_id = m.id::text and lower(d.document_type) like '%foto%'),
        'hasObservations', coalesce(m.findings, m.recommendations, m.work_performed) is not null
      ) order by m."service_Date" desc, m.id desc)
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
      from public."Maintainance" m where m.system_id = s.system_code order by m."service_Date" desc nulls last, m.id desc limit 1
    ), '[]'::jsonb)
  )
  from public."Sistemas" s
  where s.public_token = p_public_token;
$$;


notify pgrst, 'reload schema';
commit;
