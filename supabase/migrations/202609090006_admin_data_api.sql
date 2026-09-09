-- Reliable, role-checked read API for the administrator portal.
-- This avoids coupling the UI to individual table grants and RLS policies.
begin;

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
        'id', s.id,
        'created_at', s.created_at,
        'client_id', s.client_id,
        'system_code', s.system_code,
        'public_token', s.public_token,
        'adress', s.adress,
        'num_panels', s.num_panels,
        'panel_power_w', s.panel_power_w,
        'panel_brand', s.panel_brand,
        'inverter_model', s.inverter_model,
        'inverter_serial', s.inverter_serial,
        'installation_date', s.installation_date,
        'system_status', s.system_status,
        'Clientes', jsonb_build_object(
          'id', c.id,
          'full_name', c.full_name,
          'phone', c.phone,
          'email', c.email,
          'notes', c.notes,
          'welcome_label', c.welcome_label
        )
      ) order by s.system_code)
      from public."Sistemas" s
      join public."Clientes" c on c.id = s.client_id
    ), '[]'::jsonb),
    'maintenance', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id,
        'system_id', m.system_id,
        'service_Date', m."service_Date",
        'service_type', m.service_type,
        'technician_name', m.technician_name,
        'next_service_date', m.next_service_date
      ) order by m."service_Date" desc nulls last)
      from public."Maintainance" m
    ), '[]'::jsonb),
    'requests', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id,
        'status', r.status,
        'request_type', r.request_type,
        'system_id', r.system_id,
        'created_at', r.created_at
      ) order by r.created_at desc)
      from (select * from public.client_requests order by created_at desc limit 100) r
    ), '[]'::jsonb),
    'documents', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.id,
        'created_at', d.created_at,
        'system_id', d.system_id,
        'document_type', d.document_type,
        'file_url', d.file_url,
        'description', d.description
      ) order by d.created_at desc)
      from public."Documentos" d
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.admin_register_document(
  p_system_code text,
  p_document_type text,
  p_file_url text,
  p_description text
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

  if p_document_type not in ('Diagrama unifilar', 'Reporte', 'Fotografías')
    or p_file_url !~ '^https://'
    or char_length(p_file_url) > 2000
    or not exists (select 1 from public."Sistemas" where system_code = p_system_code)
  then
    raise exception using errcode = '22023', message = 'Invalid document data';
  end if;

  insert into public."Documentos" (system_id, maintenance_id, document_type, file_url, description)
  values (p_system_code, null, p_document_type, p_file_url, p_description)
  returning id into v_document_id;
  return v_document_id;
end;
$$;

revoke all on function public.admin_get_portal_data() from public;
grant execute on function public.admin_get_portal_data() to authenticated;
revoke all on function public.admin_register_document(text, text, text, text) from public;
grant execute on function public.admin_register_document(text, text, text, text) to authenticated;

notify pgrst, 'reload schema';
commit;
