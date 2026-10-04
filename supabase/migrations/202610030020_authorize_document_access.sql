begin;
-- This RPC authorizes metadata only; the application signs files on the server.
create or replace function public.get_portal_document(p_document_id bigint, p_public_token uuid default null)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('bucket','system-documents','path',coalesce(nullif(d.object_path,''),nullif(split_part(d.file_url,'/storage/v1/object/public/system-documents/',2),'')))
 from public."Documentos" d join public."Sistemas" s on s.system_code=d.system_id
 where d.id=p_document_id
 and (private.current_portal_role() in ('admin','viewer') or (p_public_token is not null and s.public_token=p_public_token))
 and coalesce(d.storage_provider,'supabase')='supabase'
 and coalesce(d.bucket_name,'system-documents')='system-documents'
 and (nullif(d.object_path,'') is not null or d.file_url like 'https://gcajwklbzzczxqujsoei.supabase.co/storage/v1/object/public/system-documents/%');
$$;
revoke all on function public.get_portal_document(bigint,uuid) from public;
grant execute on function public.get_portal_document(bigint,uuid) to anon,authenticated;
notify pgrst,'reload schema';
commit;
