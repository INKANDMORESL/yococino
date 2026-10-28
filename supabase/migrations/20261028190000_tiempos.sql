-- Revisión de los tiempos de cocción de las recetas ya guardadas (patatas, calabaza… que quedaban duras).
alter table public.recetas add column if not exists tiempos_revisados boolean not null default false;
