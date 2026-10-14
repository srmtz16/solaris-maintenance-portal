-- Run inside the migration transaction, instead of its final COMMIT.
do $$
declare admin_id uuid; sid bigint; code text; token uuid; other_token uuid; rid uuid; bad_id uuid; snap jsonb; rows jsonb; raw bytea:=convert_to('SOLARIS rollback test','UTF8');
begin
 select id into admin_id from auth.users where raw_app_meta_data->>'role'='admin' and (banned_until is null or banned_until<now()) limit 1;
 if admin_id is null then raise exception 'No active administrator for test'; end if;
 select id,system_code,public_token into sid,code,token from public."Sistemas" where system_code='FV-0001';
 select public_token into other_token from public."Sistemas" where id<>sid limit 1;
 if sid is null or other_token is null then raise exception 'Need pilot and second property for isolation test'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'role','authenticated')::text,true);
 select jsonb_agg(jsonb_build_object('at',t,'local',t at time zone 'America/Merida','consumption',1,'production',0.8,'imported',0.4,'exported',0.2)) into rows
 from generate_series('2026-10-01 06:00+00'::timestamptz,'2026-10-02 05:00+00'::timestamptz,'1 hour') t;
 snap:=jsonb_build_object('version',1,'quality',jsonb_build_object('calculationVersion',2,'totalRecords',24),'options',jsonb_build_object('start','2026-10-01','end','2026-10-01','timezone','America/Merida','unit','Wh','interval',60),'rows',rows,'errors','[]'::jsonb,'warnings','[]'::jsonb,'daily','[]'::jsonb,'totals','{}'::jsonb);
 rid:=public.admin_energy_draft(code,'test.csv','text/csv',encode(raw,'base64'),encode(sha256(raw),'hex'),'Rollback test','Test only',snap);
 if jsonb_array_length(public.energy_report_list(token,null,rid))<>0 then raise exception 'Draft leaked'; end if;
 if jsonb_array_length(public.energy_report_list(null,code,rid))<>1 then raise exception 'Admin cannot see draft'; end if;
 begin perform public.admin_energy_draft(code,'test.csv','text/csv',encode(raw,'base64'),encode(sha256(raw),'hex'),'Duplicate','Test',snap);raise exception 'Duplicate accepted';exception when raise_exception then if SQLERRM='Duplicate accepted' then raise;end if;end;
 perform public.admin_energy_update(rid,1,'publish','ignored');
 if jsonb_array_length(public.energy_report_list(token,null,rid))<>1 then raise exception 'Published missing'; end if;
 if jsonb_array_length(public.energy_report_list(other_token,null,rid))<>0 then raise exception 'Cross-property leak'; end if;
 if (public.energy_report_list(token,null,rid)->0) ? 'raw_file' or (public.energy_report_list(token,null,rid)->0->'snapshot') ? 'rows' then raise exception 'Raw data leaked'; end if;
 if (public.energy_report_list(token,null,rid)->0->'snapshot') ? 'quality' then raise exception 'Administrative quality leaked'; end if;
 if not ((public.energy_report_list(null,code,rid)->0->'snapshot') ? 'quality') then raise exception 'Admin quality missing'; end if;
 begin perform public.admin_energy_update(rid,1,'unpublish','');raise exception 'Stale write accepted';exception when raise_exception then if SQLERRM='Stale write accepted' then raise;end if;end;
 perform public.admin_energy_update(rid,2,'unpublish','');
 if jsonb_array_length(public.energy_report_list(token,null,rid))<>0 then raise exception 'Unpublish failed'; end if;
 snap:=jsonb_set(jsonb_set(snap,'{errors}','["Missing hours"]'),'{options,unit}','"kWh"');
 bad_id:=public.admin_energy_draft(code,'test.csv','text/csv',encode(raw,'base64'),encode(sha256(raw),'hex'),'Invalid draft','Test only',snap);
 begin perform public.admin_energy_update(bad_id,1,'publish','');raise exception 'Invalid published';exception when raise_exception then if SQLERRM='Invalid published' then raise;end if;end;
 if (select count(*) from public.energy_report_events where report_id=rid)<>3 then raise exception 'Missing audit trail'; end if;
 perform set_config('energy.test',jsonb_build_object('id',rid,'token',token,'other',other_token,'code',code)::text,true);
 perform set_config('request.jwt.claims','{"role":"anon"}',true);
end $$;
set local role anon;
do $$ declare c jsonb:=current_setting('energy.test')::jsonb; begin
 if jsonb_array_length(public.energy_report_list((c->>'token')::uuid,null,(c->>'id')::uuid))<>0 then raise exception 'Anonymous draft leak'; end if;
 if has_table_privilege('anon','public.energy_imports','select') or has_table_privilege('anon','public.energy_reports','select') then raise exception 'Anonymous direct table access'; end if;
 begin perform public.energy_report_list(null,c->>'code',null);raise exception 'Anonymous admin access';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claims','{"role":"authenticated"}',true);
set local role authenticated;
do $$ declare n integer;c jsonb:=current_setting('energy.test')::jsonb;begin
 select count(*) into n from public.energy_imports;if n<>0 then raise exception 'Non-admin raw access';end if;
 select count(*) into n from public.energy_reports;if n<>0 then raise exception 'Non-admin report access';end if;
 begin perform public.admin_energy_update((c->>'id')::uuid,3,'publish','');raise exception 'Non-admin publication';exception when insufficient_privilege then null;end;
end $$;
reset role;
select 'Energy rollback checks passed: drafts, publication, unpublication, isolation, raw privacy, duplicate, revision and RLS.' as result;
rollback;
