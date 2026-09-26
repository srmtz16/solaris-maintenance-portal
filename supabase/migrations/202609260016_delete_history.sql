begin;
create or replace function public.admin_delete_history(p_kind text, p_id text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_id bigint; v_request uuid;
begin
  if coalesce((select auth.jwt())->'app_metadata'->>'role','') <> 'admin' then
    raise exception using errcode='42501', message='Administrator access required';
  end if;
  if p_kind = 'maintenance' then
    if p_id is null or p_id !~ '^[0-9]{1,18}$' then raise exception 'Invalid maintenance ID'; end if;
    v_id := p_id::bigint;
    perform 1 from public."Maintainance" where id=v_id for update;
    if not found then return true; end if;
    -- Keep independently managed files and completed report snapshots intact.
    update public."Documentos" set maintenance_id=null where maintenance_id=v_id::text;
    update public.services set maintenance_id=null where maintenance_id=v_id;
    delete from public."Maintainance" where id=v_id;
  elsif p_kind = 'request' then
    if p_id is null or p_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'Invalid request ID'; end if;
    v_request := p_id::uuid;
    delete from public.client_requests where id=v_request;
  else
    raise exception 'Invalid history type';
  end if;
  return true;
end;
$$;
revoke all on function public.admin_delete_history(text,text) from public, anon;
grant execute on function public.admin_delete_history(text,text) to authenticated;
notify pgrst, 'reload schema';
commit;
