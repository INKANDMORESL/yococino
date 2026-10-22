-- Fase 2: cambiar platos, cocinar con lo que tienes y versión Peques. Idempotente.

-- Registro de usos de la IA por persona, para poner un límite diario y controlar el gasto.
-- Solo lo usan las funciones del servidor: la app no puede leerlo ni escribirlo.
create table if not exists public.usos_ia (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  tipo text not null,
  created_at timestamptz not null default now()
);
create index if not exists usos_ia_usuario on public.usos_ia (user_id, tipo, created_at);
alter table public.usos_ia enable row level security;
revoke all on public.usos_ia from anon, authenticated;
grant all on public.usos_ia to service_role;
grant usage, select on all sequences in schema public to service_role;

-- Versión Peques de cada receta compartida: se genera una sola vez y se guarda.
alter table public.recetas add column if not exists peques jsonb;
alter table public.recetas add column if not exists peques_modelo text;

