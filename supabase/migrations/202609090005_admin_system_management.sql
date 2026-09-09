-- Real administrator operations for clients and photovoltaic systems.
-- Apply after 202609090004_secure_admin_documents.sql.
begin;

create unique index if not exists sistemas_system_code_uidx
  on public."Sistemas" (system_code);

alter table public."Maintainance" enable row level security;
grant select on table public."Maintainance" to authenticated;

drop policy if exists admin_read_maintenance on public."Maintainance";
create policy admin_read_maintenance on public."Maintainance"
for select to authenticated
using ((select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin');

create or replace function public.admin_create_system(
  p_full_name text,
  p_welcome_label text,
  p_phone text,
  p_email text,
  p_notes text,
  p_adress text,
  p_num_panels integer,
  p_panel_power_w numeric,
  p_panel_brand text,
  p_inverter_model text,
  p_inverter_serial text,
  p_installation_date date,
  p_system_status text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client_id bigint;
  v_system_id bigint;
  v_public_token uuid;
  v_next_number integer;
  v_system_code text;
begin
  if coalesce((select auth.jwt()) -> 'app_metadata' ->> 'role', '') <> 'admin' then
    raise exception using errcode = '42501', message = 'Administrator access required';
  end if;

  p_full_name := btrim(p_full_name);
  p_phone := btrim(p_phone);
  p_email := nullif(btrim(p_email), '');
  p_notes := nullif(btrim(p_notes), '');
  p_adress := btrim(p_adress);
  p_panel_brand := nullif(btrim(p_panel_brand), '');
  p_inverter_model := nullif(btrim(p_inverter_model), '');
  p_inverter_serial := nullif(btrim(p_inverter_serial), '');
  p_system_status := coalesce(nullif(btrim(p_system_status), ''), 'Activo');

  if p_full_name is null or char_length(p_full_name) not between 2 and 120
    or p_phone is null or char_length(p_phone) not between 7 and 30
    or p_adress is null or char_length(p_adress) not between 5 and 250
    or p_welcome_label not in ('Bienvenido', 'Bienvenida')
    or (p_email is not null and (char_length(p_email) > 254 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'))
    or (p_num_panels is not null and p_num_panels <= 0)
    or (p_panel_power_w is not null and p_panel_power_w <= 0)
  then
    raise exception using errcode = '22023', message = 'Invalid client or system data';
  end if;

  -- One allocator at a time. MAX+1 means issued folios are never reused.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('solaris-system-folio'));
  select coalesce(max(substring(s.system_code from 4)::integer), 0) + 1
    into v_next_number
  from public."Sistemas" s
  where s.system_code ~ '^FV-[0-9]{4,}$';
  v_system_code := 'FV-' || lpad(v_next_number::text, 4, '0');

  insert into public."Clientes" (full_name, phone, notes, email, welcome_label)
  values (p_full_name, p_phone, p_notes, p_email, p_welcome_label)
  returning id into v_client_id;

  insert into public."Sistemas" (
    client_id, adress, num_panels, system_code, panel_power_w, panel_brand,
    inverter_model, inverter_serial, installation_date, system_status
  ) values (
    v_client_id, p_adress, p_num_panels, v_system_code, p_panel_power_w,
    p_panel_brand, p_inverter_model, p_inverter_serial, p_installation_date,
    p_system_status
  ) returning id, public_token into v_system_id, v_public_token;

  return jsonb_build_object(
    'systemId', v_system_id,
    'clientId', v_client_id,
    'systemCode', v_system_code,
    'publicToken', v_public_token
  );
end;
$$;

create or replace function public.admin_update_system(
  p_system_id bigint,
  p_full_name text,
  p_welcome_label text,
  p_phone text,
  p_email text,
  p_notes text,
  p_adress text,
  p_num_panels integer,
  p_panel_power_w numeric,
  p_panel_brand text,
  p_inverter_model text,
  p_inverter_serial text,
  p_installation_date date,
  p_system_status text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client_id bigint;
  v_system_code text;
  v_public_token uuid;
begin
  if coalesce((select auth.jwt()) -> 'app_metadata' ->> 'role', '') <> 'admin' then
    raise exception using errcode = '42501', message = 'Administrator access required';
  end if;

  p_full_name := btrim(p_full_name);
  p_phone := btrim(p_phone);
  p_email := nullif(btrim(p_email), '');
  p_notes := nullif(btrim(p_notes), '');
  p_adress := btrim(p_adress);
  p_panel_brand := nullif(btrim(p_panel_brand), '');
  p_inverter_model := nullif(btrim(p_inverter_model), '');
  p_inverter_serial := nullif(btrim(p_inverter_serial), '');
  p_system_status := coalesce(nullif(btrim(p_system_status), ''), 'Activo');

  if p_full_name is null or char_length(p_full_name) not between 2 and 120
    or p_phone is null or char_length(p_phone) not between 7 and 30
    or p_adress is null or char_length(p_adress) not between 5 and 250
    or p_welcome_label not in ('Bienvenido', 'Bienvenida')
    or (p_email is not null and (char_length(p_email) > 254 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'))
    or (p_num_panels is not null and p_num_panels <= 0)
    or (p_panel_power_w is not null and p_panel_power_w <= 0)
  then
    raise exception using errcode = '22023', message = 'Invalid client or system data';
  end if;

  select s.client_id, s.system_code, s.public_token
    into v_client_id, v_system_code, v_public_token
  from public."Sistemas" s
  where s.id = p_system_id
  for update;
  if not found then
    raise exception using errcode = '22023', message = 'System not found';
  end if;

  update public."Clientes"
  set full_name = p_full_name,
      phone = p_phone,
      email = p_email,
      notes = p_notes,
      welcome_label = p_welcome_label
  where id = v_client_id;

  update public."Sistemas"
  set adress = p_adress,
      num_panels = p_num_panels,
      panel_power_w = p_panel_power_w,
      panel_brand = p_panel_brand,
      inverter_model = p_inverter_model,
      inverter_serial = p_inverter_serial,
      installation_date = p_installation_date,
      system_status = p_system_status
  where id = p_system_id;

  return jsonb_build_object(
    'systemId', p_system_id,
    'clientId', v_client_id,
    'systemCode', v_system_code,
    'publicToken', v_public_token
  );
end;
$$;

revoke all on function public.admin_create_system(text, text, text, text, text, text, integer, numeric, text, text, text, date, text) from public;
grant execute on function public.admin_create_system(text, text, text, text, text, text, integer, numeric, text, text, text, date, text) to authenticated;
revoke all on function public.admin_update_system(bigint, text, text, text, text, text, text, integer, numeric, text, text, text, date, text) from public;
grant execute on function public.admin_update_system(bigint, text, text, text, text, text, text, integer, numeric, text, text, text, date, text) to authenticated;

notify pgrst, 'reload schema';
commit;
