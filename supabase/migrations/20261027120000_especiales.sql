-- Recetas especiales de temporada (ver _shared/especiales.ts).
-- solo_especial: receta creada para un especial; nunca entra en el menú (sí en el recetario, con su etiqueta).
-- avisos: «azúcar», «grasas»… por ración (semáforo de importar_reglas.ts), para avisar en la receta.
alter table public.recetas add column if not exists solo_especial boolean not null default false;
alter table public.recetas add column if not exists avisos text[];

-- Qué recetas tiene cada especial (también recetas normales del recetario, como el cocido en «Invierno»).
create table if not exists public.especial_recetas (
  especial text not null,
  receta_id bigint not null references public.recetas (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (especial, receta_id)
);
alter table public.especial_recetas enable row level security;
drop policy if exists "especiales visibles" on public.especial_recetas;
create policy "especiales visibles" on public.especial_recetas for select to authenticated using (true);
grant select on public.especial_recetas to authenticated;
grant all on public.especial_recetas to service_role;

create index if not exists recetas_solo_especial on public.recetas (solo_especial) where solo_especial;

-- Última vez que se prepararon los especiales (sembrar-recetas, una vez al día).
alter table public.ajustes_internos add column if not exists especiales_at timestamptz;
