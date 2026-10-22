-- Ahorro de IA sin quitar funciones. Idempotente.

-- Cambios de ingrediente ya hechos: si otra persona pide el mismo cambio en la misma receta, se reutiliza.
create table if not exists public.variantes_receta (
  receta_id bigint not null references public.recetas (id) on delete cascade,
  original text not null,
  por text not null,
  nueva_id bigint not null references public.recetas (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (receta_id, original, por)
);
alter table public.variantes_receta enable row level security;
revoke all on public.variantes_receta from anon, authenticated;
grant all on public.variantes_receta to service_role;

-- Lotes a mitad de precio (solo los lanza el administrador): recetas con Claude y fotos con Google.
create table if not exists public.lotes_ia (
  id bigint generated always as identity primary key,
  tipo text not null check (tipo in ('recetas', 'fotos')),
  proveedor_id text not null,
  estado text not null default 'enviado' check (estado in ('enviado', 'terminado', 'fallido')),
  datos jsonb not null default '{}'::jsonb,
  resultado jsonb,
  created_at timestamptz not null default now(),
  terminado_at timestamptz
);
alter table public.lotes_ia enable row level security;
revoke all on public.lotes_ia from anon, authenticated;
grant all on public.lotes_ia to service_role;
grant usage, select on all sequences in schema public to service_role;

-- Foto pedida en un lote: mientras tanto no se genera otra al verla.
alter table public.recetas add column if not exists foto_en_lote boolean not null default false;
