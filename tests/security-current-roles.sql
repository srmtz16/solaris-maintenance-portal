-- Append to migration 019 before COMMIT for a rollback-only authorization probe.
do $$ begin
 perform set_config('solaris.test_admin',coalesce((select id::text from auth.users where raw_app_meta_data->>'role'='admin' and (banned_until is null or banned_until<=now()) limit 1),''),true);
 perform set_config('solaris.test_viewer',coalesce((select id::text from auth.users where raw_app_meta_data->>'role'='viewer' and (banned_until is null or banned_until<=now()) limit 1),''),true);
end $$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000000","role":"authenticated","app_metadata":{"role":"admin"}}',true) is not null as prepared;
do $$ declare f record; args text; begin
 for f in select p.oid,p.proname,p.proargtypes from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and left(p.proname,6)='admin_' loop
  select string_agg('null::'||format_type(a,null),',' order by ord) into args from unnest(f.proargtypes::oid[]) with ordinality t(a,ord);
  begin
   execute format('select public.%I(%s)',f.proname,coalesce(args,''));
   raise exception 'Authorization bypass: %',f.proname;
  exception when insufficient_privilege then null; end;
 end loop;
 if exists(select 1 from public."Documentos") or exists(select 1 from public.services) or exists(select 1 from public.client_requests) then raise exception 'Stale account can read tables'; end if;
 begin perform public.viewer_get_portal_data(); raise exception 'Invalid viewer allowed'; exception when insufficient_privilege then null; end;
 begin perform public.service_snapshot('00000000-0000-4000-8000-000000000000'); raise exception 'Snapshot exposed'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('solaris.test_admin'),'role','authenticated','app_metadata',jsonb_build_object('role','admin'))::text,true) is not null as prepared;
do $$ begin
 if current_setting('solaris.test_admin')='' then raise exception 'No administrator to verify'; end if;
 perform public.admin_get_portal_data();
 perform public.admin_service_list('__SECURITY_NONEXISTENT__');
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('solaris.test_viewer'),'role','authenticated','app_metadata',jsonb_build_object('role','viewer'))::text,true) is not null as prepared;
do $$ begin
 if current_setting('solaris.test_viewer')='' then raise exception 'No viewer to verify'; end if;
 perform public.viewer_get_portal_data();
 begin perform public.admin_get_portal_data(); raise exception 'Viewer may use admin'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'PASS: stale account blocked on all admin RPCs; table reads blocked; active admin and viewer preserved; changes rolled back' as result;
