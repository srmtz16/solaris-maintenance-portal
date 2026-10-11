begin;
-- Sistemas is the existing property/solar-system record. Its solar asset is
-- deliberately excluded from these complementary equipment rows.
create table public.property_equipment_setup (
 system_id bigint primary key references public."Sistemas"(id),
 completed_at timestamptz, skipped_at timestamptz
);
create table public.property_equipment (
 id uuid primary key default gen_random_uuid(),
 system_id bigint not null references public."Sistemas"(id),
 asset_code text generated always as ('SOLARIS-ASSET-' || upper(replace(id::text,'-',''))) stored unique,
 type text not null check(type in ('Aire acondicionado','Presurizador','Suavizador de agua','Calentador','Bomba de piscina','Bomba de agua','Refrigerador','Planta eléctrica','Cargador de vehículo eléctrico','Otro')),
 name text not null check(length(btrim(name)) between 1 and 120),
 brand text check(length(brand)<=100), model text check(length(model)<=120),
 serial_number text check(length(serial_number)<=150), location text check(length(location)<=200),
 installed_on date, notes text check(length(notes)<=2000), photo_path text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(photo_path is null or (photo_path like system_id::text || '/' || id::text || '/%' and photo_path !~ '\.\.|\\'))
);
create index property_equipment_system_idx on public.property_equipment(system_id);
create table public.equipment_services (
 id uuid primary key default gen_random_uuid(), equipment_id uuid not null references public.property_equipment(id),
 service_date date not null,
 type text not null check(type in ('Preventivo','Correctivo','Inspección','Limpieza','Instalación','Otro')),
 provider text not null default '' check(length(provider)<=150),
 description text not null check(length(btrim(description)) between 1 and 2000),
 next_service_date date, photo_path text,
 created_by uuid references auth.users(id), created_at timestamptz not null default now(),
 check(next_service_date is null or next_service_date>=service_date)
);
create index equipment_services_equipment_idx on public.equipment_services(equipment_id,service_date desc,created_at desc);
alter table public.property_equipment_setup enable row level security;
alter table public.property_equipment enable row level security;
alter table public.equipment_services enable row level security;
revoke all on public.property_equipment_setup,public.property_equipment,public.equipment_services from public,anon,authenticated;

create function private.equipment_limit() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='UPDATE' and new.system_id<>old.system_id then raise exception 'Equipment cannot change property'; end if;
 perform pg_advisory_xact_lock(hashtextextended(new.system_id::text,8022));
 if TG_OP='INSERT' and private.current_portal_role()<>'admin' and (select count(*) from public.property_equipment where system_id=new.system_id)>=3 then
  raise exception using errcode='23514',message='Tu Pasaporte incluye 3 equipos. Contacta a SOLARIS para ampliar tus registros.';
 end if;
 return new;
end; $$;
create trigger enforce_property_equipment_limit before insert or update on public.property_equipment for each row execute function private.equipment_limit();

create function public.equipment_portal(p_token uuid default null,p_system_code text default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare sid bigint; result jsonb;
begin
 if p_system_code is not null then
  if private.current_portal_role()<>'admin' then raise exception using errcode='42501',message='Administrator access required'; end if;
  select id into sid from public."Sistemas" where system_code=p_system_code;
 else
  select id into sid from public."Sistemas" where public_token=p_token;
 end if;
 if sid is null then raise exception using errcode='42501',message='Propiedad no disponible.'; end if;
 select jsonb_build_object('systemId',sid,'systemCode',s.system_code,'completed',coalesce(st.completed_at is not null,false),'skipped',coalesce(st.skipped_at is not null,false),
  'equipment',coalesce((select jsonb_agg(to_jsonb(e) || jsonb_build_object('services',coalesce((select jsonb_agg(to_jsonb(h)-'created_by' order by h.service_date desc,h.created_at desc) from public.equipment_services h where h.equipment_id=e.id),'[]'::jsonb)) order by e.created_at,e.id) from public.property_equipment e where e.system_id=s.id),'[]'::jsonb))
 into result from public."Sistemas" s left join public.property_equipment_setup st on st.system_id=s.id where s.id=sid;
 return result;
end; $$;

create function private.insert_property_equipment(sid bigint,item jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare eid uuid := (item->>'id')::uuid;
begin
 if eid is null or jsonb_typeof(item)<>'object' then raise exception 'Invalid equipment'; end if;
 insert into public.property_equipment(id,system_id,type,name,brand,model,serial_number,location,installed_on,notes,photo_path)
 values(eid,sid,item->>'type',btrim(item->>'name'),nullif(item->>'brand',''),nullif(item->>'model',''),nullif(item->>'serial_number',''),nullif(item->>'location',''),nullif(item->>'installed_on','')::date,nullif(item->>'notes',''),nullif(item->>'photo_path',''));
 return eid;
end; $$;

create function public.initialize_property_equipment(p_token uuid,p_equipment jsonb,p_skip boolean default false)
returns boolean language plpgsql security definer set search_path='' as $$
declare sid bigint; item jsonb;
begin
 select id into sid from public."Sistemas" where public_token=p_token;
 if sid is null then raise exception using errcode='42501',message='Propiedad no disponible.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(sid::text,8022));
 if exists(select 1 from public.property_equipment_setup where system_id=sid and completed_at is not null) then
  raise exception using errcode='42501',message='La configuración ya está cerrada. Contacta a SOLARIS para realizar cambios.';
 end if;
 if p_skip then
  insert into public.property_equipment_setup(system_id,skipped_at) values(sid,now()) on conflict(system_id) do update set skipped_at=now();
  return true;
 end if;
 if p_equipment is null or jsonb_typeof(p_equipment)<>'array' then raise exception 'Selecciona tus equipos.'; end if;
 if jsonb_array_length(p_equipment) not between 1 and 3 or exists(select 1 from public.property_equipment where system_id=sid) then raise exception 'Puedes registrar hasta 3 equipos incluidos.'; end if;
 for item in select value from jsonb_array_elements(p_equipment) loop perform private.insert_property_equipment(sid,item); end loop;
 insert into public.property_equipment_setup(system_id,completed_at) values(sid,now()) on conflict(system_id) do update set completed_at=now();
 return true;
end; $$;

create function public.admin_save_property_equipment(p_system_code text,p_equipment jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare sid bigint; eid uuid := (p_equipment->>'id')::uuid;
begin
 if private.current_portal_role()<>'admin' then raise exception using errcode='42501',message='Administrator access required'; end if;
 select id into sid from public."Sistemas" where system_code=p_system_code;
 if sid is null or eid is null then raise exception 'Invalid equipment'; end if;
 perform pg_advisory_xact_lock(hashtextextended(sid::text,8022));
 if exists(select 1 from public.property_equipment where id=eid) then
  update public.property_equipment set type=p_equipment->>'type',name=btrim(p_equipment->>'name'),brand=nullif(p_equipment->>'brand',''),model=nullif(p_equipment->>'model',''),serial_number=nullif(p_equipment->>'serial_number',''),location=nullif(p_equipment->>'location',''),installed_on=nullif(p_equipment->>'installed_on','')::date,notes=nullif(p_equipment->>'notes',''),photo_path=nullif(p_equipment->>'photo_path',''),updated_at=now() where id=eid and system_id=sid;
  if not found then raise exception using errcode='42501',message='Equipo ajeno a esta propiedad.'; end if;
 else perform private.insert_property_equipment(sid,p_equipment); end if;
 insert into public.property_equipment_setup(system_id,completed_at) values(sid,now()) on conflict(system_id) do update set completed_at=coalesce(public.property_equipment_setup.completed_at,now());
 return eid;
end; $$;

create function public.admin_record_equipment_service(p_system_code text,p_equipment_id uuid,p_service jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare sid bigint; photo text := nullif(p_service->>'photo_path',''); eid uuid := (p_service->>'id')::uuid;
begin
 if private.current_portal_role()<>'admin' then raise exception using errcode='42501',message='Administrator access required'; end if;
 select e.system_id into sid from public.property_equipment e join public."Sistemas" s on s.id=e.system_id where e.id=p_equipment_id and s.system_code=p_system_code;
 if sid is null then raise exception using errcode='42501',message='Equipo ajeno a esta propiedad.'; end if;
 if (p_service->>'service_date')::date > (now() at time zone 'America/Mexico_City')::date then raise exception 'La fecha del servicio no puede ser futura.'; end if;
 if photo is not null and (photo not like sid::text || '/' || p_equipment_id::text || '/%' or photo ~ '\.\.|\\') then raise exception 'Invalid evidence path'; end if;
 insert into public.equipment_services(id,equipment_id,service_date,type,provider,description,next_service_date,photo_path,created_by)
 values(eid,p_equipment_id,(p_service->>'service_date')::date,p_service->>'type',coalesce(p_service->>'provider',''),p_service->>'description',nullif(p_service->>'next_service_date','')::date,photo,auth.uid());
 return eid;
end; $$;

create function public.record_property_equipment_service(p_token uuid,p_equipment_id uuid,p_service jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare sid bigint; photo text; record_id uuid;
begin
 select e.system_id into sid from public.property_equipment e join public."Sistemas" s on s.id=e.system_id where e.id=p_equipment_id and s.public_token=p_token;
 if sid is null then return jsonb_build_object('ok',false,'error','Equipo no disponible.'); end if;
 if p_service is null or jsonb_typeof(p_service)<>'object' then raise exception 'Datos del servicio requeridos.'; end if;
 record_id:=(p_service->>'id')::uuid;
 if exists(select 1 from public.equipment_services where id=record_id and equipment_id=p_equipment_id) then return jsonb_build_object('ok',true); end if;
 if (p_service->>'service_date')::date>(now() at time zone 'America/Mexico_City')::date then raise exception 'La fecha del servicio no puede ser futura.'; end if;
 photo:=nullif(p_service->>'photo_path','');
 if photo is not null and (photo not like sid::text || '/' || p_equipment_id::text || '/%' or photo ~ '\.\.|\\') then raise exception 'Invalid evidence path'; end if;
 insert into public.equipment_services(id,equipment_id,service_date,type,provider,description,next_service_date,photo_path)
 values(record_id,p_equipment_id,(p_service->>'service_date')::date,p_service->>'type',coalesce(p_service->>'provider',''),p_service->>'description',nullif(p_service->>'next_service_date','')::date,photo);
 return jsonb_build_object('ok',true);
end; $$;
revoke all on function public.record_property_equipment_service(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.record_property_equipment_service(uuid,uuid,jsonb) to anon,authenticated;

revoke all on function private.equipment_limit(),private.insert_property_equipment(bigint,jsonb) from public,anon,authenticated;
revoke all on function public.equipment_portal(uuid,text),public.initialize_property_equipment(uuid,jsonb,boolean),public.admin_save_property_equipment(text,jsonb),public.admin_record_equipment_service(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.equipment_portal(uuid,text),public.initialize_property_equipment(uuid,jsonb,boolean) to anon,authenticated;
grant execute on function public.admin_save_property_equipment(text,jsonb),public.admin_record_equipment_service(text,uuid,jsonb) to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('property-equipment','property-equipment',false,2097152,array['image/jpeg','image/png','image/webp']);
notify pgrst,'reload schema';
commit;
