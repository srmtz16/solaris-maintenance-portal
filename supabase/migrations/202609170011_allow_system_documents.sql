-- Documents may belong directly to a system without a maintenance record.
-- Both administrator registration functions intentionally pass NULL in this case.
begin;
alter table public."Documentos" alter column maintenance_id drop not null;
notify pgrst, 'reload schema';
commit;
