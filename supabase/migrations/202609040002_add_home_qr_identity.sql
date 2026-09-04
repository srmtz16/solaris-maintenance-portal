-- Run after 202609020001_create_client_requests.sql.
-- Each QR carries a random UUID. FV-0001 remains a human-readable label only.
begin;

alter table public."Sistemas" add column if not exists public_token uuid default gen_random_uuid();
update public."Sistemas" set public_token = gen_random_uuid() where public_token is null;
alter table public."Sistemas" alter column public_token set not null;
create unique index if not exists sistemas_public_token_uidx on public."Sistemas" (public_token);

create or replace function public.get_public_system(p_public_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', s.system_code,
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
      select jsonb_agg(jsonb_build_object('name', coalesce(d.description, d.document_type, 'Documento'), 'type', coalesce(d.document_type, 'Archivo')) order by d.created_at desc)
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

drop function if exists public.submit_client_request(text, text, text, text, text, text, date);
create or replace function public.submit_client_request(
  p_public_token uuid,
  p_request_type text,
  p_message text,
  p_preferred_date date
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_system public."Sistemas"%rowtype;
  v_client public."Clientes"%rowtype;
  v_request_id uuid;
begin
  p_message := btrim(p_message);
  if p_request_type is null or p_request_type not in ('maintenance', 'failure')
    or p_message is null or char_length(p_message) not between 5 and 1500
    or (p_request_type = 'failure' and p_preferred_date is not null)
  then raise exception using errcode = '22023', message = 'Invalid request'; end if;

  select * into v_system from public."Sistemas" where public_token = p_public_token;
  if not found then raise exception using errcode = '22023', message = 'Invalid home token'; end if;
  select * into v_client from public."Clientes" where id = v_system.client_id;
  if not found or v_client.full_name is null or v_client.phone is null then
    raise exception using errcode = '22023', message = 'Home contact is incomplete';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_public_token::text), pg_catalog.hashtext(v_client.phone));
  if exists (select 1 from public.client_requests r where r.system_record_id = v_system.id and r.created_at > now() - interval '5 minutes') then
    raise exception using errcode = 'P0001', message = 'Please wait before submitting another request';
  end if;

  insert into public.client_requests (system_record_id, system_id, request_type, customer_name, phone, email, message, preferred_date)
  values (v_system.id, v_system.system_code, p_request_type, v_client.full_name, v_client.phone, v_client.email, p_message, p_preferred_date)
  returning id into v_request_id;
  return v_request_id;
end;
$$;

revoke all on function public.submit_client_request(uuid, text, text, date) from public;
grant execute on function public.submit_client_request(uuid, text, text, date) to anon;
notify pgrst, 'reload schema';
commit;

-- Obtain a QR destination without exposing it in the public API:
-- select system_code, public_token, '/s/' || public_token::text as qr_path from public."Sistemas";
