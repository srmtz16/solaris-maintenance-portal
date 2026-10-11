-- Execute after migration 022 in the SAME transaction; always ROLLBACK.
-- Uses two existing property IDs but persists no test equipment.
select set_config('test.admin_id',(select id::text from auth.users where raw_app_meta_data->>'role'='admin' and (banned_until is null or banned_until<=now()) limit 1),true);
select set_config('test.token',(select public_token::text from public."Sistemas" order by id limit 1),true);
select set_config('test.other_token',(select public_token::text from public."Sistemas" order by id offset 1 limit 1),true);
select set_config('test.system',(select system_code from public."Sistemas" order by id limit 1),true);
do $$ begin
 if nullif(current_setting('test.admin_id'),'') is null or nullif(current_setting('test.other_token'),'') is null then raise exception 'Test requires an administrator and two properties'; end if;
 if has_table_privilege('anon','public.property_equipment','SELECT') or has_table_privilege('authenticated','public.property_equipment','UPDATE') then raise exception 'Direct table access unexpectedly granted'; end if;
 if (select public from storage.buckets where id='property-equipment') is distinct from false then raise exception 'Equipment bucket must be private'; end if;
end $$;
set local role anon;
select public.initialize_property_equipment(current_setting('test.token')::uuid,'[]',true);
do $$ declare items jsonb; begin
 select jsonb_agg(jsonb_build_object('id',gen_random_uuid(),'type','Aire acondicionado','name','TEST '||n)) into items from generate_series(1,4) n;
 begin
  perform public.initialize_property_equipment(current_setting('test.token')::uuid,items,false);
  raise exception 'Four equipment items unexpectedly accepted';
 exception when raise_exception then
  if sqlerrm='Four equipment items unexpectedly accepted' then raise; end if;
 end;
 if jsonb_array_length(public.equipment_portal(current_setting('test.token')::uuid,null)->'equipment')<>0 then raise exception 'Failed setup partially saved'; end if;
 perform public.initialize_property_equipment(current_setting('test.token')::uuid,items-3,false);
end $$;
-- The array subtraction operator takes an integer index.
do $$ begin
 if jsonb_array_length(public.equipment_portal(current_setting('test.token')::uuid,null)->'equipment')<>3 then raise exception 'Three equipment setup failed'; end if;
 begin
  perform public.initialize_property_equipment(current_setting('test.token')::uuid,'[]',true);
  raise exception 'Completed onboarding reopened';
 exception when insufficient_privilege then null; end;
 begin
  perform public.admin_save_property_equipment(current_setting('test.system'),'{}');
  raise exception 'Anonymous admin edit unexpectedly allowed';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('test.equipment',(select e.id::text from public.property_equipment e join public."Sistemas" s on s.id=e.system_id where s.public_token=current_setting('test.token')::uuid order by e.id limit 1),true);
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.admin_id'),'role','authenticated')::text,true);
-- An administrator can manually provision an agreed expansion.
select public.admin_save_property_equipment(current_setting('test.system'),jsonb_build_object('id',gen_random_uuid(),'type','Otro','name','Fourth equipment expansion'));
do $$ begin
 if jsonb_array_length(public.equipment_portal(null,current_setting('test.system'))->'equipment')<>4 then raise exception 'Administrator expansion failed'; end if;
end $$;
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
do $$ declare result jsonb; begin
 result:=public.record_property_equipment_service(current_setting('test.other_token')::uuid,current_setting('test.equipment')::uuid,'{}');
 if result->>'ok'='true' then raise exception 'Cross-property registration allowed'; end if;
 begin
  perform public.admin_save_property_equipment(current_setting('test.system'),jsonb_build_object('id',gen_random_uuid(),'type','Otro','name','Unauthorized expansion'));
  raise exception 'Anonymous expansion allowed';
 exception when insufficient_privilege then null; end;
end $$;
do $$ declare result jsonb; payload jsonb; begin
 payload:=jsonb_build_object('id',gen_random_uuid(),'service_date','2026-01-10','type','Limpieza','provider','Proveedor de prueba','description','Registro transaccional, se revierte.','next_service_date','2027-01-10');
 result:=public.record_property_equipment_service(current_setting('test.token')::uuid,current_setting('test.equipment')::uuid,payload);
 if result->>'ok'<>'true' then raise exception 'QR service failed'; end if;
 result:=public.record_property_equipment_service(current_setting('test.token')::uuid,current_setting('test.equipment')::uuid,payload);
 if result->>'ok'<>'true' then raise exception 'Idempotent retry failed'; end if;
end $$;
reset role;
do $$ begin
 if (select count(*) from public.equipment_services where equipment_id=current_setting('test.equipment')::uuid)<>1 then raise exception 'Retry duplicated service'; end if;
end $$;
select 'Equipment permissions, limit, initialization closure, admin expansion and password-free service history checks passed' as result;
-- Caller MUST issue ROLLBACK, not COMMIT.
