begin;
-- Internal helpers must never be callable through the public Data API.
revoke all on function public.service_snapshot(uuid) from public, anon, authenticated;
revoke all on function public.service_admin_required() from public, anon, authenticated;

-- Check the current account role, not a potentially stale JWT role.
create or replace function public.service_admin_required()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from auth.users u where u.id = auth.uid()
    and u.raw_app_meta_data->>'role' = 'admin'
    and (u.banned_until is null or u.banned_until <= now())
  ) then
    raise exception using errcode = '42501', message = 'Administrator access required';
  end if;
end;
$$;

-- Explicit anon grants survive REVOKE FROM PUBLIC; remove both.
do $$ declare f record; begin
  for f in select p.oid::regprocedure as signature
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname like 'admin\_%' escape '\'
  loop
    execute format('revoke all on function %s from public, anon', f.signature);
  end loop;
end $$;
notify pgrst, 'reload schema';
commit;
