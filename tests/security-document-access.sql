-- Run after migration 020 without its COMMIT, then ROLLBACK.
do $$ begin
 perform set_config('solaris.document_id',coalesce((select d.id::text from public."Documentos" d join public."Sistemas" s on s.system_code=d.system_id limit 1),''),true);
 perform set_config('solaris.document_token',coalesce((select s.public_token::text from public."Documentos" d join public."Sistemas" s on s.system_code=d.system_id where d.id::text=current_setting('solaris.document_id')),''),true);
end $$;
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true) is not null as prepared;
do $$ declare document_id bigint:=nullif(current_setting('solaris.document_id'),'')::bigint; begin
 if document_id is null then raise exception 'No document available for authorization test'; end if;
 if public.get_portal_document(document_id,null) is not null then raise exception 'Anonymous document exposed'; end if;
 if public.get_portal_document(document_id,'00000000-0000-4000-8000-000000000000') is not null then raise exception 'Wrong QR accepted'; end if;
 if public.get_portal_document(document_id,current_setting('solaris.document_token')::uuid) is null then raise exception 'Authorized QR rejected'; end if;
 if public.get_portal_document(-1,current_setting('solaris.document_token')::uuid) is not null then raise exception 'Unknown document returned'; end if;
end $$;
reset role;
rollback;
select 'PASS: missing/wrong QR denied; authorized document allowed; all changes rolled back' as result;
