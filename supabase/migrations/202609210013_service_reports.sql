begin;
-- Existing customers and solar systems remain the source of truth.
create view public.customers with (security_invoker=true) as select id, full_name, phone, email from public."Clientes";
create view public.solar_systems with (security_invoker=true) as select id, client_id as customer_id, system_code, public_token from public."Sistemas";
revoke all on public.customers, public.solar_systems from public,anon;
grant select on public.customers, public.solar_systems to authenticated;
create sequence public.service_folio_seq;
create table public.services (
 id uuid primary key, folio text not null unique default ('SOL-'||lpad(nextval('public.service_folio_seq')::text,6,'0')),
 system_id bigint not null references public."Sistemas"(id), customer_id bigint not null references public."Clientes"(id),
 status text not null default 'draft' check(status in ('draft','completed')), version integer not null default 1,
 data jsonb not null check(jsonb_typeof(data)='object'), created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), completed_at timestamptz,
 maintenance_id bigint
);
create table public.service_findings (id uuid primary key, service_id uuid not null references public.services(id), title text not null, description text not null, state text not null check(state in ('Correcto','Requiere atención','Corregido durante el servicio','Recomendación preventiva')));
create table public.service_measurements (id uuid primary key, service_id uuid not null references public.services(id), parameter text not null, value text not null, unit text not null, observation text not null default '');
create table public.service_recommendations (id uuid primary key, service_id uuid not null references public.services(id), title text not null, description text not null, priority text not null check(priority in ('Preventiva','Recomendada','Importante','Urgente')));
create table public.service_photos (id uuid primary key, service_id uuid not null references public.services(id), path text not null unique, description text not null, category text not null check(category in ('Antes','Durante','Después','Hallazgo','Evidencia general')), finding_ids uuid[] not null default '{}');
create table public.service_reports (id uuid primary key, service_id uuid not null references public.services(id), folio text not null, version integer not null, file_path text not null unique, snapshot jsonb not null, created_at timestamptz not null default now(), published boolean not null default false, unique(service_id,version));
create index services_system_idx on public.services(system_id,created_at desc);
create index reports_service_idx on public.service_reports(service_id,created_at desc);
-- Child indexes support dossier lookups and immutable snapshot generation.
create index findings_service_idx on public.service_findings(service_id);
create index measurements_service_idx on public.service_measurements(service_id);
create index recommendations_service_idx on public.service_recommendations(service_id);
create index photos_service_idx on public.service_photos(service_id);
alter table public.services enable row level security;
revoke all on public.services from public,anon,authenticated;
grant select on public.services to authenticated;
create policy admin_read on public.services for select to authenticated using ((select auth.jwt())->'app_metadata'->>'role'='admin');
alter table public.service_findings enable row level security;
revoke all on public.service_findings from public,anon,authenticated;
grant select on public.service_findings to authenticated;
create policy admin_read on public.service_findings for select to authenticated using ((select auth.jwt())->'app_metadata'->>'role'='admin');
alter table public.service_measurements enable row level security;
revoke all on public.service_measurements from public,anon,authenticated;
grant select on public.service_measurements to authenticated;
create policy admin_read on public.service_measurements for select to authenticated using ((select auth.jwt())->'app_metadata'->>'role'='admin');
alter table public.service_recommendations enable row level security;
revoke all on public.service_recommendations from public,anon,authenticated;
grant select on public.service_recommendations to authenticated;
create policy admin_read on public.service_recommendations for select to authenticated using ((select auth.jwt())->'app_metadata'->>'role'='admin');
alter table public.service_photos enable row level security;
revoke all on public.service_photos from public,anon,authenticated;
grant select on public.service_photos to authenticated;
create policy admin_read on public.service_photos for select to authenticated using ((select auth.jwt())->'app_metadata'->>'role'='admin');
alter table public.service_reports enable row level security;
revoke all on public.service_reports from public,anon,authenticated;
grant select on public.service_reports to authenticated;
create policy admin_read on public.service_reports for select to authenticated using ((select auth.jwt())->'app_metadata'->>'role'='admin');
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('service-evidence','service-evidence',false,15728640,array['image/png','image/jpeg','application/pdf']);
create policy service_evidence_admin_read on storage.objects for select to authenticated using(bucket_id='service-evidence' and (select auth.jwt())->'app_metadata'->>'role'='admin');
create policy service_evidence_admin_insert on storage.objects for insert to authenticated with check(bucket_id='service-evidence' and (select auth.jwt())->'app_metadata'->>'role'='admin');
-- No update/delete grant for this bucket: saved report bytes and evidence are immutable.
create function public.service_admin_required() returns void language plpgsql security definer set search_path='' as $$ begin
 if coalesce((select auth.jwt())->'app_metadata'->>'role','')<>'admin' then raise exception using errcode='42501',message='Administrator access required'; end if;
end $$;
revoke all on function public.service_admin_required() from public;
create function public.service_snapshot(p_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select to_jsonb(v)||jsonb_build_object('customer_name',c.full_name,'public_token',s.public_token,'system_code',s.system_code)
 from public.services v join public."Sistemas" s on s.id=v.system_id join public."Clientes" c on c.id=v.customer_id where v.id=p_id;
$$;
revoke all on function public.service_snapshot(uuid) from public;
create function public.admin_service_list(p_system_code text) returns jsonb language plpgsql security definer set search_path='' as $$ begin
 perform public.service_admin_required();
 return jsonb_build_object('services',coalesce((select jsonb_agg(public.service_snapshot(v.id) order by v.created_at desc) from public.services v join public."Sistemas" s on s.id=v.system_id where s.system_code=p_system_code),'[]'::jsonb),'reports',coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc) from public.service_reports r join public.services v on v.id=r.service_id join public."Sistemas" s on s.id=v.system_id where s.system_code=p_system_code),'[]'::jsonb));
end $$;
create function public.admin_save_service(p_id uuid,p_system_code text,p_version integer,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare v public.services%rowtype; s public."Sistemas"%rowtype; item jsonb; k text; begin
 perform public.service_admin_required();
 if p_id is null or p_version is null or p_data is null or jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>150000 then raise exception 'Datos de servicio inválidos'; end if;
 select * into s from public."Sistemas" where system_code=p_system_code;
 if not found then raise exception 'Sistema no encontrado'; end if;
 if coalesce(p_data->>'type','') not in ('Mantenimiento preventivo','Diagnóstico','Inspección','Reparación','Levantamiento')
 or coalesce(length(btrim(p_data->>'technician')),0) not between 1 and 120
 or coalesce(length(btrim(p_data->>'location')),0) not between 1 and 500
 or coalesce(p_data->>'date','') !~ '^\d{4}-\d{2}-\d{2}$'
 or (p_data->>'date')::date>(now() at time zone 'America/Mexico_City')::date
 or coalesce(p_data->>'generalState','') not in ('Operación normal','Operación con observaciones','Requiere mantenimiento adicional','Requiere reparación','Requiere diagnóstico especializado','No fue posible verificar operación')
 then raise exception 'Revisa fecha, tipo, técnico, ubicación y estado'; end if;
 foreach k in array array['originalNotes','activities','corrections','result','finalComments','conclusion'] loop
 if jsonb_typeof(p_data->k) is distinct from 'string' or length(p_data->>k)>12000 then raise exception 'Texto inválido o demasiado largo'; end if;
 end loop;
 if jsonb_typeof(p_data->'system') is distinct from 'object' then raise exception 'Datos del sistema inválidos'; end if;
 foreach k in array array['findings','measurements','recommendations','photos'] loop
 if jsonb_typeof(p_data->k) is distinct from 'array' or jsonb_array_length(p_data->k)>40 then raise exception 'Máximo 40 registros por sección'; end if;
 end loop;
 if nullif(p_data->>'nextDate','') is not null and (p_data->>'nextDate')::date<=(p_data->>'date')::date then raise exception 'Próxima fecha inválida'; end if;
 select * into v from public.services where id=p_id for update;
 if found then
 if v.system_id<>s.id or v.customer_id<>s.client_id or v.status<>'draft' then raise exception 'El servicio está finalizado o pertenece a otro expediente'; end if;
 if v.version<>p_version then raise exception 'El servicio cambió en otra sesión. Recarga antes de guardar'; end if;
 update public.services set data=p_data,version=version+1,updated_at=now() where id=p_id;
 else
 if p_version<>0 then raise exception 'Borrador no encontrado'; end if;
 insert into public.services(id,system_id,customer_id,data,created_by) values(p_id,s.id,s.client_id,p_data,auth.uid());
 end if;
 delete from public.service_photos where service_id=p_id;
 delete from public.service_findings where service_id=p_id;
 delete from public.service_measurements where service_id=p_id;
 delete from public.service_recommendations where service_id=p_id;
 for item in select * from jsonb_array_elements(p_data->'findings') loop
 if coalesce(length(btrim(item->>'title')),0)=0 or coalesce(length(btrim(item->>'description')),0)=0 then raise exception 'Hallazgo incompleto'; end if;
 insert into public.service_findings values((item->>'id')::uuid,p_id,item->>'title',item->>'description',item->>'state');
 end loop;
 for item in select * from jsonb_array_elements(p_data->'measurements') loop
 if coalesce(length(btrim(item->>'parameter')),0)=0 or coalesce(length(btrim(item->>'value')),0)=0 or coalesce(length(btrim(item->>'unit')),0)=0 then raise exception 'Medición incompleta'; end if;
 insert into public.service_measurements values((item->>'id')::uuid,p_id,item->>'parameter',item->>'value',item->>'unit',coalesce(item->>'observation',''));
 end loop;
 for item in select * from jsonb_array_elements(p_data->'recommendations') loop
 if coalesce(length(btrim(item->>'title')),0)=0 or coalesce(length(btrim(item->>'description')),0)=0 then raise exception 'Recomendación incompleta'; end if;
 insert into public.service_recommendations values((item->>'id')::uuid,p_id,item->>'title',item->>'description',item->>'priority');
 end loop;
 for item in select * from jsonb_array_elements(p_data->'photos') loop
 if coalesce(length(btrim(item->>'description')),0)=0 or (item->>'path') not like p_id::text||'/photos/%'
 or not exists(select 1 from storage.objects where bucket_id='service-evidence' and name=item->>'path') then raise exception 'Evidencia no válida'; end if;
 if exists(select 1 from jsonb_array_elements_text(item->'findingIds') f where not exists(select 1 from public.service_findings sf where sf.id=f.value::uuid and sf.service_id=p_id)) then raise exception 'Hallazgo de otra evidencia'; end if;
 insert into public.service_photos values((item->>'id')::uuid,p_id,item->>'path',item->>'description',item->>'category',array(select value::uuid from jsonb_array_elements_text(item->'findingIds')));
 end loop;
 return public.service_snapshot(p_id);
end $$;
create function public.admin_store_service_report(p_id uuid,p_service_id uuid,p_version integer,p_path text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v public.services%rowtype; r public.service_reports%rowtype; begin
 perform public.service_admin_required();
 select * into v from public.services where id=p_service_id for update;
 if not found or v.version<>p_version or v.status<>'draft' then raise exception 'Guarda y genera nuevamente el reporte actualizado'; end if;
 if coalesce((v.data->>'verified')::boolean,false)<>true or coalesce(length(btrim(v.data->>'originalNotes')),0)=0 or coalesce(length(btrim(v.data->>'activities')),0)=0 or coalesce(length(btrim(v.data->>'conclusion')),0)=0 then raise exception 'Revisa y confirma el contenido antes de generar'; end if;
 select * into r from public.service_reports where service_id=p_service_id and version=p_version;
 if found then return to_jsonb(r); end if;
 if p_path is distinct from p_service_id::text||'/reports/'||p_id::text||'.pdf' or not exists(select 1 from storage.objects where bucket_id='service-evidence' and name=p_path and metadata->>'mimetype'='application/pdf') then raise exception 'Archivo PDF no encontrado'; end if;
 insert into public.service_reports(id,service_id,folio,version,file_path,snapshot) values(p_id,p_service_id,v.folio,p_version,p_path,public.service_snapshot(p_service_id)) returning * into r;
 return to_jsonb(r);
end $$;
create function public.admin_finalize_service(p_service_id uuid,p_report_id uuid,p_file_url text) returns bigint language plpgsql security definer set search_path='' as $$
declare v public.services%rowtype; r public.service_reports%rowtype; s public."Sistemas"%rowtype; m bigint; begin
 perform public.service_admin_required();
 select * into v from public.services where id=p_service_id for update;
 if not found then raise exception 'Servicio no encontrado'; end if;
 if v.status='completed' then return v.maintenance_id; end if;
 select * into r from public.service_reports where id=p_report_id and service_id=v.id and version=v.version;
 if not found then raise exception 'Genera un PDF de la última versión antes de finalizar'; end if;
 select * into s from public."Sistemas" where id=v.system_id for update;
 -- Publish only the stored PDF path, never an arbitrary external URL.
 if p_file_url !~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/system-documents/'
 or split_part(p_file_url,'/system-documents/',2) is distinct from s.system_code||'/reports/'||r.id::text||'.pdf'
 or not exists(select 1 from storage.objects where bucket_id='system-documents' and name=s.system_code||'/reports/'||r.id::text||'.pdf' and metadata->>'mimetype'='application/pdf') then raise exception 'PDF publicado no válido'; end if;
 insert into public."Maintainance"(system_id,"service_Date",service_type,technician_name,work_performed,findings,recommendations,next_service_date,completion_request_id)
 values(s.system_code,(v.data->>'date')::date,v.data->>'type',v.data->>'technician',concat_ws(E'\n',v.data->>'activities',nullif(v.data->>'corrections',''),nullif(v.data->>'result','')),
 (select string_agg(title||': '||description,E'\n') from public.service_findings where service_id=v.id),
 (select string_agg(title||': '||description,E'\n') from public.service_recommendations where service_id=v.id),nullif(v.data->>'nextDate','')::date,v.id) returning id into m;
 insert into public."Documentos"(system_id,maintenance_id,document_type,file_url,description) values(s.system_code,m::text,'Reporte',p_file_url,'Reporte final '||r.folio);
 update public.services set status='completed',completed_at=now(),maintenance_id=m where id=v.id;
 update public.service_reports set published=true where id=r.id;
 if not exists(select 1 from public."Maintainance" where system_id=s.system_code and "service_Date">(v.data->>'date')::date) then
 update public."Sistemas" set scheduled_maintenance_date=case when scheduled_maintenance_date>(v.data->>'date')::date then scheduled_maintenance_date else nullif(v.data->>'nextDate','')::date end where id=s.id;
 end if;
 return m;
end $$;
revoke all on function public.admin_service_list(text),public.admin_save_service(uuid,text,integer,jsonb),public.admin_store_service_report(uuid,uuid,integer,text),public.admin_finalize_service(uuid,uuid,text) from public;
grant execute on function public.admin_service_list(text),public.admin_save_service(uuid,text,integer,jsonb),public.admin_store_service_report(uuid,uuid,integer,text),public.admin_finalize_service(uuid,uuid,text) to authenticated;

create table public.service_ai_requests(id bigint generated always as identity primary key,user_id uuid not null references auth.users(id),created_at timestamptz not null default now());
alter table public.service_ai_requests enable row level security;
revoke all on public.service_ai_requests from public,anon,authenticated;
create index service_ai_rate_idx on public.service_ai_requests(user_id,created_at desc);
create function public.admin_report_ai_quota() returns void language plpgsql security definer set search_path='' as $$ begin
 perform public.service_admin_required();
 perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
 if exists(select 1 from public.service_ai_requests where user_id=auth.uid() and created_at>now()-interval '1 minute') or (select count(*) from public.service_ai_requests where user_id=auth.uid() and created_at>now()-interval '24 hours')>=40 then raise exception 'AI rate limit'; end if;
 insert into public.service_ai_requests(user_id) values(auth.uid());
end $$;
revoke all on function public.admin_report_ai_quota() from public;
grant execute on function public.admin_report_ai_quota() to authenticated;
notify pgrst,'reload schema';

commit;
