-- Run after migration 021 inside a transaction and roll back this test.
select set_config('test.admin_id',(select id::text from auth.users where raw_app_meta_data->>'role'='admin' and (banned_until is null or banned_until <= now()) limit 1),true);
select set_config('test.viewer_id',(select id::text from auth.users where raw_app_meta_data->>'role'='viewer' limit 1),true);
select set_config('test.system_code',(select system_code from public."Sistemas" order by system_code limit 1),true);
do $$ begin
  if (select public from storage.buckets where id='admin-documents') is distinct from false then raise exception 'Bucket must be private'; end if;
  if current_setting('test.admin_id') = '' or current_setting('test.viewer_id') = '' then raise exception 'Test accounts missing'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.admin_id'),'role','authenticated')::text,true);
insert into public.admin_documents(id,system_id,document_type,description,object_path,original_name,mime_type,file_size_bytes,checksum_sha256)
values('00000000-0000-4000-a000-000000000021',current_setting('test.system_code'),'Convenio de interconexión','Transactional permission test',current_setting('test.system_code')||'/test-private-document.pdf','test-private-document.pdf','application/pdf',1,repeat('a',64));
do $$ begin
 if not exists(select 1 from public.admin_documents where id='00000000-0000-4000-a000-000000000021') then raise exception 'Admin read failed'; end if;
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.viewer_id'),'role','authenticated')::text,true);
do $$ begin
 if exists(select 1 from public.admin_documents) then raise exception 'Viewer can read private documents'; end if;
 begin
  insert into public.admin_documents(system_id,document_type,object_path,original_name,mime_type,file_size_bytes,checksum_sha256)
  values(current_setting('test.system_code'),'Contrato de contraprestación',current_setting('test.system_code')||'/viewer-test.pdf','viewer-test.pdf','application/pdf',1,repeat('a',64));
  raise exception 'Viewer write unexpectedly succeeded';
 exception when insufficient_privilege then null;
 end;
end $$;
set local role anon;
do $$ begin
 begin
  perform 1 from public.admin_documents;
  raise exception 'Anonymous read unexpectedly succeeded';
 exception when insufficient_privilege then null;
 end;
end $$;
reset role;
select 'Private documents: admin allowed; viewer and anonymous denied' as result;
