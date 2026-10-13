begin;
do $$ begin
 if (select data_type from information_schema.columns where table_schema='public' and table_name='Sistemas' and column_name='id') is distinct from 'bigint'
 or (select data_type from information_schema.columns where table_schema='public' and table_name='Sistemas' and column_name='public_token') is distinct from 'uuid'
 or to_regprocedure('private.current_portal_role()') is null then raise exception 'Verify Sistemas types and current account permissions first'; end if;
end $$;
create table public.energy_imports (
 id uuid primary key default gen_random_uuid(), system_id bigint not null references public."Sistemas"(id),
 checksum text not null check(checksum ~ '^[a-f0-9]{64}$'), filename text not null check(length(filename)<=180),
 mime text not null, raw_file bytea not null check(octet_length(raw_file) between 1 and 1500000),
 source text not null default 'Smappee manual', created_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
 unique(system_id,checksum)
);
create table public.energy_reports (
 id uuid primary key default gen_random_uuid(), system_id bigint not null references public."Sistemas"(id), import_id uuid not null references public.energy_imports(id),
 folio text generated always as ('SOL-EN-'||upper(replace(id::text,'-',''))) stored unique,
 title text not null check(length(btrim(title)) between 1 and 160), notes text not null default '' check(length(notes)<=6000),
 period_start date not null, period_end date not null check(period_end>=period_start), snapshot jsonb not null check(jsonb_typeof(snapshot)='object'),
 status text not null default 'draft' check(status in ('draft','published')), revision integer not null default 1,
 created_by uuid not null references auth.users(id), created_at timestamptz not null default now(), published_at timestamptz, updated_at timestamptz not null default now(),
 normalization_key text not null, unique(import_id,normalization_key)
);
create table public.energy_measurements (
 report_id uuid not null references public.energy_reports(id), at timestamptz not null, local_time timestamp not null,
 consumption numeric not null check(consumption>=0), production numeric not null check(production>=0), imported numeric not null check(imported>=0), exported numeric not null check(exported>=0), primary key(report_id,at)
);
create table public.energy_report_events (
 id bigint generated always as identity primary key, report_id uuid not null references public.energy_reports(id), actor uuid not null references auth.users(id),
 action text not null, revision integer not null, notes text not null, created_at timestamptz not null default now()
);
create index energy_reports_system on public.energy_reports(system_id,period_start desc);
alter table public.energy_imports enable row level security;
alter table public.energy_reports enable row level security;
alter table public.energy_measurements enable row level security;
alter table public.energy_report_events enable row level security;
revoke all on public.energy_imports,public.energy_reports,public.energy_measurements,public.energy_report_events from public,anon,authenticated;
grant select on public.energy_imports,public.energy_reports,public.energy_measurements,public.energy_report_events to authenticated;
create policy energy_admin_read on public.energy_imports for select to authenticated using ((select private.current_portal_role())='admin');
create policy energy_admin_read on public.energy_reports for select to authenticated using ((select private.current_portal_role())='admin');
create policy energy_admin_read on public.energy_measurements for select to authenticated using ((select private.current_portal_role())='admin');
create policy energy_admin_read on public.energy_report_events for select to authenticated using ((select private.current_portal_role())='admin');

create function public.energy_report_list(p_token uuid default null,p_system_code text default null,p_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare sid bigint; admin_mode boolean:=p_system_code is not null; result jsonb;
begin
 if admin_mode then
  if private.current_portal_role()<>'admin' then raise exception using errcode='42501',message='Administrator access required'; end if;
  select id into sid from public."Sistemas" where system_code=p_system_code;
 else select id into sid from public."Sistemas" where public_token=p_token; end if;
 if sid is null then raise exception using errcode='42501',message='Reportes no disponibles'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'folio',r.folio,'system_code',s.system_code,'title',r.title,'notes',r.notes,'status',r.status,'revision',r.revision,'created_at',r.created_at,'published_at',r.published_at,'snapshot',case when admin_mode then r.snapshot-'rows' else (r.snapshot-'rows'-'quality'-'errors'-'warnings') || jsonb_build_object('errors','[]'::jsonb,'warnings','[]'::jsonb) end) order by r.period_start desc,r.created_at desc),'[]'::jsonb)
 into result from public.energy_reports r join public."Sistemas" s on s.id=r.system_id
 where r.system_id=sid and (admin_mode or r.status='published') and (p_id is null or r.id=p_id);
 return result;
end $$;

create function public.admin_energy_draft(p_system_code text,p_filename text,p_mime text,p_raw text,p_checksum text,p_title text,p_notes text,p_snapshot jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare sid bigint; iid uuid; rid uuid; item jsonb; raw_bytes bytea;
begin
 if private.current_portal_role()<>'admin' then raise exception using errcode='42501',message='Administrator access required'; end if;
 select id into sid from public."Sistemas" where system_code=p_system_code;
 if sid is null then raise exception 'Unknown installation'; end if;
 raw_bytes:=decode(p_raw,'base64');
 if encode(sha256(raw_bytes),'hex')<>p_checksum then raise exception 'Checksum mismatch'; end if;
 if p_snapshot->>'version' is distinct from '1' or jsonb_typeof(p_snapshot->'rows') is distinct from 'array' or jsonb_array_length(p_snapshot->'rows') not between 1 and 10000
 or jsonb_typeof(p_snapshot->'errors') is distinct from 'array' or coalesce(p_snapshot->'options'->>'timezone','') not in ('America/Merida','UTC') then raise exception 'Invalid normalized data'; end if;
 insert into public.energy_imports(system_id,checksum,filename,mime,raw_file,created_by)
 values(sid,p_checksum,p_filename,p_mime,raw_bytes,auth.uid()) on conflict(system_id,checksum) do nothing;
 select id into iid from public.energy_imports where system_id=sid and checksum=p_checksum;
 if exists(select 1 from public.energy_reports where import_id=iid and normalization_key=md5((p_snapshot->'options')::text||'v'||coalesce(p_snapshot->'quality'->>'calculationVersion','1'))) then raise exception 'Este archivo, periodo y configuración ya tienen un reporte. Abre el existente.'; end if;
 insert into public.energy_reports(system_id,import_id,title,notes,period_start,period_end,snapshot,created_by,normalization_key)
 values(sid,iid,p_title,p_notes,(p_snapshot->'options'->>'start')::date,(p_snapshot->'options'->>'end')::date,p_snapshot,auth.uid(),md5((p_snapshot->'options')::text||'v'||coalesce(p_snapshot->'quality'->>'calculationVersion','1'))) returning id into rid;
 for item in select * from jsonb_array_elements(p_snapshot->'rows') loop
  insert into public.energy_measurements values(rid,(item->>'at')::timestamptz,(item->>'local')::timestamp,(item->>'consumption')::numeric,(item->>'production')::numeric,(item->>'imported')::numeric,(item->>'exported')::numeric);
 end loop;
 insert into public.energy_report_events(report_id,actor,action,revision,notes) values(rid,auth.uid(),'created',1,p_notes);
 return rid;
end $$;

create function public.admin_energy_update(p_id uuid,p_revision integer,p_action text,p_notes text)
returns boolean language plpgsql security definer set search_path='' as $$
declare report public.energy_reports%rowtype;
begin
 if private.current_portal_role()<>'admin' then raise exception using errcode='42501',message='Administrator access required'; end if;
 select * into report from public.energy_reports where id=p_id for update;
 if report.id is null or report.revision<>p_revision then raise exception 'El reporte cambió. Actualiza antes de continuar.'; end if;
 if p_action not in ('notes','publish','unpublish') then raise exception 'Invalid action'; end if;
 if p_action='notes' and report.status<>'draft' then raise exception 'Despublica el reporte antes de editarlo.'; end if;
 if p_action='publish' then
  if report.status<>'draft' or jsonb_array_length(report.snapshot->'errors')<>0 then raise exception 'Corrige las inconsistencias antes de publicar.'; end if;
  if length(btrim(report.notes))=0 then raise exception 'Revisa y guarda las conclusiones antes de publicar.'; end if;
 end if;
 update public.energy_reports set notes=case when p_action='notes' then p_notes else notes end,
 status=case when p_action='publish' then 'published' when p_action='unpublish' then 'draft' else status end,
 published_at=case when p_action='publish' then now() when p_action='unpublish' then null else published_at end,
 revision=revision+1,updated_at=now() where id=p_id;
 insert into public.energy_report_events(report_id,actor,action,revision,notes)
 select id,auth.uid(),p_action,revision,notes from public.energy_reports where id=p_id;
 return true;
end $$;
revoke all on function public.energy_report_list(uuid,text,uuid) from public;
grant execute on function public.energy_report_list(uuid,text,uuid) to anon,authenticated;
revoke all on function public.admin_energy_draft(text,text,text,text,text,text,text,jsonb),public.admin_energy_update(uuid,integer,text,text) from public,anon;
grant execute on function public.admin_energy_draft(text,text,text,text,text,text,text,jsonb),public.admin_energy_update(uuid,integer,text,text) to authenticated;
notify pgrst,'reload schema';
commit;
