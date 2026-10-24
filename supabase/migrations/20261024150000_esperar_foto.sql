-- Recetas del recetario creadas por lotes: no se enseñan hasta tener su foto. Idempotente.
alter table public.recetas add column if not exists espera_foto boolean not null default false;

-- Clave interna para que GitHub lance tareas del recetario (lotes de recetas y fotos) sin sesión de administrador.
-- Solo la leen el servidor y quien gestiona el proyecto; nunca la app.
create table if not exists public.ajustes_internos (
  id smallint primary key default 1 check (id = 1),
  clave_tareas text not null default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''))
);
insert into public.ajustes_internos (id) values (1) on conflict (id) do nothing;
alter table public.ajustes_internos enable row level security;
revoke all on public.ajustes_internos from anon, authenticated;
grant all on public.ajustes_internos to service_role;
