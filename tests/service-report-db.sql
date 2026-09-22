-- Run after migration 013 in the SQL editor. Every fixture is rolled back.
begin;
do $$
declare
 uid uuid; sid uuid := gen_random_uuid(); rid uuid := gen_random_uuid(); fid uuid := gen_random_uuid();
 code text; payload jsonb; saved jsonb; report jsonb; mid bigint; rejected boolean;
begin
 select id into uid from auth.users where raw_app_meta_data->>'role'='admin' limit 1;
 select system_code into code from public."Sistemas" where client_id is not null order by id limit 1;
 if uid is null or code is null then raise exception 'An existing admin and system are required'; end if;
 perform set_config('request.jwt.claims','{}',true);
 rejected := false;
 begin perform public.admin_service_list(code); exception when insufficient_privilege then rejected:=true; end;
 if not rejected then raise exception 'Unauthenticated access was not rejected'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',uid,'role','authenticated','app_metadata',jsonb_build_object('role','admin'))::text,true);
 payload:=jsonb_build_object('date','2026-09-20','type','Mantenimiento preventivo','technician','PRUEBA TRANSACCIONAL','location','No es un servicio real',
 'system',jsonb_build_object('type','','modules','','power','','moduleModel','','inverter','','batteries','','protections',''),
 'originalNotes','Prueba que se revierte.','activities','Prueba de persistencia.','corrections','','result','',
 'findings',jsonb_build_array(jsonb_build_object('id',fid,'title','Prueba','description','Dato temporal','state','Requiere atención')),
 'measurements','[]'::jsonb,'recommendations','[]'::jsonb,'photos','[]'::jsonb,
 'generalState','No fue posible verificar operación','finalComments','','conclusion','Documento temporal de pruebas.','nextDate','','verified',true);
 saved:=public.admin_save_service(sid,code,0,payload);
 if (saved->>'version')::integer<>1 or (select count(*) from public.service_findings where service_id=sid)<>1 then raise exception 'Draft persistence failed'; end if;
 saved:=public.admin_save_service(sid,code,1,payload);
 rejected:=false;
 begin perform public.admin_save_service(sid,code,1,payload); exception when raise_exception then rejected:=true; end;
 if not rejected then raise exception 'Stale revision was accepted'; end if;
 insert into storage.objects(bucket_id,name,metadata) values('service-evidence',sid::text||'/reports/'||rid::text||'.pdf','{"mimetype":"application/pdf"}');
 report:=public.admin_store_service_report(rid,sid,2,sid::text||'/reports/'||rid::text||'.pdf');
 if public.admin_store_service_report(gen_random_uuid(),sid,2,'unused')<>report then raise exception 'Report retry was not idempotent'; end if;
 rejected:=false;
 begin perform public.admin_finalize_service(sid,rid,'https://example.com/wrong.pdf'); exception when raise_exception then rejected:=true; end;
 if not rejected then raise exception 'Invalid publication was accepted'; end if;
 insert into storage.objects(bucket_id,name,metadata) values('system-documents',code||'/reports/'||rid::text||'.pdf','{"mimetype":"application/pdf"}');
 mid:=public.admin_finalize_service(sid,rid,'https://gcajwklbzzczxqujsoei.supabase.co/storage/v1/object/public/system-documents/'||code||'/reports/'||rid::text||'.pdf');
 if public.admin_finalize_service(sid,rid,'retry')<>mid then raise exception 'Completion retry created another service'; end if;
 if not exists(select 1 from public."Documentos" where maintenance_id=mid::text and system_id=code) then raise exception 'Client report was not linked'; end if;
 if not exists(select 1 from public.service_reports where id=rid and published) then raise exception 'Report was not published'; end if;
 rejected:=false;
 begin perform public.admin_save_service(sid,code,2,payload); exception when raise_exception then rejected:=true; end;
 if not rejected then raise exception 'Completed service was editable'; end if;
 if has_table_privilege('anon','public.services','select') or has_table_privilege('authenticated','public.services','insert') then raise exception 'Unexpected direct access'; end if;
 if exists(select 1 from storage.buckets where id='service-evidence' and public) then raise exception 'Draft bucket is public'; end if;
end $$;
rollback;
select 'PASS: draft, findings, concurrency, PDF version, completion, client link, idempotency and access checks; all fixtures rolled back' as result;
