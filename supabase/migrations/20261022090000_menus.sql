-- Menús: ajustes nutricionales, campos para recetas compartidas y raciones ajustadas por persona.
-- Escrita para poder aplicarse más de una vez sin errores.

-- Ajustes nutricionales (una sola fila). PENDIENTES DE VALIDAR por un dietista-nutricionista.
create table if not exists public.ajustes_nutricion (
  id boolean primary key default true check (id),
  kcal_minimo_mujer integer not null default 1400,
  kcal_minimo_hombre integer not null default 1700,
  deficit_pct numeric(4,3) not null default 0.150 check (deficit_pct between 0 and 0.25),
  deficit_max_kcal integer not null default 500 check (deficit_max_kcal between 0 and 750),
  superavit_pct numeric(4,3) not null default 0.100 check (superavit_pct between 0 and 0.2),
  validado_por text,
  validado_at timestamptz,
  updated_at timestamptz not null default now()
);
insert into public.ajustes_nutricion (id) values (true) on conflict (id) do nothing;
alter table public.ajustes_nutricion enable row level security;
-- Sin políticas: solo el servidor (función preparar-menu) la lee.

-- Recetas compartidas.
alter table public.recetas add column if not exists descripcion text;
alter table public.recetas add column if not exists kcal integer;
alter table public.recetas add column if not exists etiquetas text[] not null default '{}';
alter table public.recetas add column if not exists modelo text;
create index if not exists recetas_tipo_nivel on public.recetas (tipo_comida, nivel);

-- Comidas de cada persona: factor para ajustar la ración estándar a su plan.
alter table public.comidas add column if not exists factor numeric(4,2) not null default 1
  check (factor between 0.5 and 2);
alter table public.comidas add column if not exists kcal integer;
create index if not exists comidas_receta on public.comidas (receta_id);

-- Energía diaria calculada (orientativa).
alter table public.profiles add column if not exists kcal_dia integer;

-- Permisos de la app (la seguridad real la ponen las políticas de cada fila).
grant select, insert, update, delete on public.profiles, public.comidas, public.favoritas, public.pesos,
  public.medidas, public.compra_marcas to authenticated;
grant select on public.recetas, public.ingredientes, public.suscripciones to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

-- Cada persona solo puede marcar como hecha su comida; no puede cambiar la receta ni la ración.
revoke update on public.comidas from authenticated;
grant update (hecha, hecha_at) on public.comidas to authenticated;
revoke insert on public.comidas from authenticated;
