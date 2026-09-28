begin;
create table public.system_equipment (
 system_id bigint primary key references public."Sistemas"(id) on delete cascade,
 solar boolean, charger boolean, battery boolean,
 updated_at timestamptz not null default now()
);
alter table public.system_equipment enable row level security;
revoke all on public.system_equipment from public,anon,authenticated;
create function public.get_public_equipment(p_public_token uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('solar',case when e.system_id is not null then e.solar when s.num_panels>0 then true else null end,'charger',e.charger,'battery',e.battery)
 from public."Sistemas" s left join public.system_equipment e on e.system_id=s.id where s.public_token=p_public_token;
$$;
revoke all on function public.get_public_equipment(uuid) from public;
grant execute on function public.get_public_equipment(uuid) to anon,authenticated;
create function public.admin_get_system_equipment(p_system_code text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if coalesce((select auth.jwt())->'app_metadata'->>'role','') <> 'admin' then raise exception using errcode='42501',message='Administrator access required'; end if;
 select jsonb_build_object('solar',case when e.system_id is not null then e.solar when s.num_panels>0 then true else null end,'charger',e.charger,'battery',e.battery) into result
 from public."Sistemas" s left join public.system_equipment e on e.system_id=s.id where s.system_code=p_system_code;
 if result is null then raise exception 'System not found'; end if;
 return result;
end;
$$;
create function public.admin_save_system_equipment(p_system_code text,p_solar boolean,p_charger boolean,p_battery boolean)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_id bigint;
begin
 if coalesce((select auth.jwt())->'app_metadata'->>'role','') <> 'admin' then raise exception using errcode='42501',message='Administrator access required'; end if;
 select id into v_id from public."Sistemas" where system_code=p_system_code;
 if v_id is null then raise exception 'System not found'; end if;
 insert into public.system_equipment(system_id,solar,charger,battery) values(v_id,p_solar,p_charger,p_battery)
 on conflict(system_id) do update set solar=excluded.solar,charger=excluded.charger,battery=excluded.battery,updated_at=now();
 return true;
end;
$$;
revoke all on function public.admin_get_system_equipment(text) from public,anon;
revoke all on function public.admin_save_system_equipment(text,boolean,boolean,boolean) from public,anon;
grant execute on function public.admin_get_system_equipment(text),public.admin_save_system_equipment(text,boolean,boolean,boolean) to authenticated;
notify pgrst,'reload schema';
commit;
