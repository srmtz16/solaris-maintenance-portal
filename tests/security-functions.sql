-- Run inside the migration transaction, before COMMIT; roll back afterward.
do $$ declare f record; begin
 for f in select p.oid,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (p.proname like 'admin\_%' escape '\' or p.proname in ('service_snapshot','service_admin_required')) loop
   if has_function_privilege('anon', f.oid, 'EXECUTE') then raise exception 'Anonymous privilege remains: %', f.proname; end if;
 end loop;
 if has_function_privilege('authenticated','public.service_snapshot(uuid)','EXECUTE') then raise exception 'Internal snapshot exposed'; end if;
 if not has_function_privilege('authenticated','public.admin_service_list(text)','EXECUTE') then raise exception 'Admin entrypoint unavailable'; end if;
 if not has_function_privilege('anon','public.get_public_system(uuid)','EXECUTE') then raise exception 'QR access broken'; end if;
end $$;
set local role anon;
do $$ begin
 begin perform public.service_snapshot('00000000-0000-0000-0000-000000000000'); raise exception 'Anonymous snapshot was permitted'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000000","role":"authenticated","app_metadata":{"role":"admin"}}',true);
do $$ begin
 begin perform public.admin_service_list('FV-0001'); raise exception 'Stale admin was permitted'; exception when insufficient_privilege then null; end;
 begin perform public.service_snapshot('00000000-0000-0000-0000-000000000000'); raise exception 'Authenticated snapshot was permitted'; exception when insufficient_privilege then null; end;
end $$;
reset role;
