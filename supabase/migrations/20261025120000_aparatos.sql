-- Aparatos de cocina: lo que tiene cada persona y lo que necesita cada receta (ver _shared/aparatos.ts).
-- profiles.aparatos null = sin contestar (se supone horno y microondas).
alter table public.profiles add column if not exists aparatos text[];

alter table public.recetas add column if not exists aparatos text[];
-- '' = revisada y no se adapta a airfryer; null = sin revisar.
alter table public.recetas add column if not exists nota_airfryer text;

-- Recetas ya guardadas: se marcan por lo que dicen sus pasos (sin IA).
update public.recetas
set aparatos = array_remove(array[
  case when pasos::text ~* '(horno|hornea|gratin)' then 'horno' end,
  case when pasos::text ~* '(airfryer|air fryer|freidora de aire|freidora sin aceite)' then 'airfryer' end,
  case when pasos::text ~* 'microondas' then 'microondas' end,
  case when pasos::text ~* '(thermomix|robot de cocina|varoma|velocidad cuchara)' then 'robot' end
], null)
where aparatos is null;

alter table public.recetas alter column aparatos set default '{}';
update public.recetas set aparatos = '{}' where aparatos is null;

create index if not exists recetas_aparatos on public.recetas using gin (aparatos);
