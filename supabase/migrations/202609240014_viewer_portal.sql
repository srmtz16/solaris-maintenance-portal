begin;
-- Read-only API. Existing administrator mutation checks and RLS remain unchanged.
create or replace function public.viewer_get_portal_data()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if coalesce((select u.raw_app_meta_data->>'role' from auth.users u where u.id = auth.uid()), '') not in ('admin', 'viewer') then
    raise exception using errcode = '42501', message = 'Portal read access required';
  end if;

  return jsonb_build_object(
    'systems', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'created_at', s.created_at, 'client_id', s.client_id,
        'system_code', s.system_code, 'scheduled_maintenance_date', s.scheduled_maintenance_date,
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
        'next_service_date', m.next_service_date, 'work_performed', m.work_performed, 'findings', m.findings, 'recommendations', m.recommendations
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


revoke all on function public.viewer_get_portal_data() from public, anon;
grant execute on function public.viewer_get_portal_data() to authenticated;
notify pgrst, 'reload schema';
commit;
