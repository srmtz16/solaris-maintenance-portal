begin;
-- Resolve current account permissions, including bans, on every database request.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
create or replace function private.current_portal_role()
returns text language sql stable security definer set search_path = '' as $$
  select coalesce((select u.raw_app_meta_data->>'role' from auth.users u
    where u.id=auth.uid() and (u.banned_until is null or u.banned_until<=now())), '');
$$;
revoke all on function private.current_portal_role() from public, anon;
grant execute on function private.current_portal_role() to authenticated;

-- Replace only the audited JWT-role expression; preserve complete function bodies.
-- Abort if any administrator function has neither this guard nor the internal guard.
do $migration$
declare f record; old_definition text; new_definition text;
  role_expression text := $pattern$coalesce\(\s*\(select\s+auth\.jwt\(\)\)\s*->\s*'app_metadata'\s*->>\s*'role'\s*,\s*''\s*\)$pattern$;
begin
  for f in select p.oid,p.proname,p.prosrc from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and left(p.proname,6)='admin_'
  loop
    old_definition:=pg_get_functiondef(f.oid);
    new_definition:=regexp_replace(old_definition,role_expression,'(select private.current_portal_role())','gi');
    if new_definition=old_definition
      and position('public.service_admin_required()' in f.prosrc)=0
      and position('private.current_portal_role()' in f.prosrc)=0 then
      raise exception 'Unrecognized authorization guard: %',f.proname;
    end if;
    if position('auth.jwt()' in new_definition)>0 then
      raise exception 'Stale role check remains in %',f.proname;
    end if;
    if new_definition<>old_definition then execute new_definition; end if;
  end loop;
end $migration$;

-- Restrictive policies add a current-account guard to the existing operation rules.
do $migration$
declare table_name text;
begin
  foreach table_name in array array['Clientes','Sistemas','Documentos','Maintainance','client_requests','services','service_findings','service_measurements','service_recommendations','service_photos','service_reports','service_ai_requests','system_equipment'] loop
    execute format('drop policy if exists current_admin_required on public.%I',table_name);
    execute format('create policy current_admin_required on public.%I as restrictive for all to authenticated using ((select private.current_portal_role()) = ''admin'') with check ((select private.current_portal_role()) = ''admin'')',table_name);
  end loop;
end $migration$;
drop policy if exists current_admin_required on storage.objects;
create policy current_admin_required on storage.objects as restrictive for all to authenticated
 using (bucket_id not in ('system-documents','service-evidence') or (select private.current_portal_role())='admin')
 with check (bucket_id not in ('system-documents','service-evidence') or (select private.current_portal_role())='admin');

-- Add the current-role-and-ban guard to the read-only portal without changing its data.
do $migration$
declare definition text; original text;
begin
 original:=pg_get_functiondef('public.viewer_get_portal_data()'::regprocedure);
 if position('private.current_portal_role()' in original)=0 then
   definition:=regexp_replace(original,'\mbegin\M', E'begin\n if (select private.current_portal_role()) not in (''admin'',''viewer'') then raise exception using errcode=''42501'', message=''Portal read access required''; end if;', 'i');
   if definition=original then raise exception 'Viewer guard could not be installed'; end if;
   execute definition;
 end if;
end $migration$;
notify pgrst, 'reload schema';
commit;
