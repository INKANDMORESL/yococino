-- Guardar recetas desde redes sociales (TikTok, Instagram, YouTube, webs). Idempotente.
-- · Las saludables pasan al recetario de todos; las que tienen mucho azúcar, grasa o calorías quedan solo para quien las guardó.
alter table public.recetas add column if not exists privada_de uuid references auth.users (id) on delete cascade;
alter table public.recetas add column if not exists origen_url text;
create index if not exists recetas_privada_de on public.recetas (privada_de) where privada_de is not null;

-- Las recetas privadas solo las ve su dueño.
drop policy if exists "recetas para todos" on public.recetas;
drop policy if exists "recetas visibles" on public.recetas;
create policy "recetas visibles" on public.recetas
  for select to authenticated using (privada_de is null or privada_de = auth.uid());

-- «Mis recetas»: lo que cada persona ha guardado desde redes, con sus avisos.
create table if not exists public.mis_recetas (
  user_id uuid not null references auth.users (id) on delete cascade,
  receta_id bigint not null references public.recetas (id) on delete cascade,
  origen_url text,
  avisos jsonb not null default '[]',
  created_at timestamptz not null default now(),
  primary key (user_id, receta_id)
);
alter table public.mis_recetas enable row level security;
drop policy if exists "mis recetas: ver" on public.mis_recetas;
create policy "mis recetas: ver" on public.mis_recetas for select to authenticated using (user_id = auth.uid());
drop policy if exists "mis recetas: quitar" on public.mis_recetas;
create policy "mis recetas: quitar" on public.mis_recetas for delete to authenticated using (user_id = auth.uid());
grant select, delete on public.mis_recetas to authenticated;
grant all on public.mis_recetas to service_role;

-- Enlaces ya analizados: si otra persona comparte el mismo, se reutiliza sin gastar IA.
create table if not exists public.importaciones (
  url_norm text primary key,
  clase text not null,
  receta_id bigint references public.recetas (id) on delete set null,
  publica boolean not null default false,
  avisos jsonb not null default '[]',
  created_at timestamptz not null default now()
);
alter table public.importaciones enable row level security;
revoke all on public.importaciones from anon, authenticated;
grant all on public.importaciones to service_role;

-- Prueba gratis: como mucho 1 receta guardada desde redes (se cambia en ajustes_planes.importar_prueba).
alter table public.ajustes_planes add column if not exists importar_prueba integer not null default 1;
alter table public.pruebas add column if not exists importadas integer not null default 0;

create or replace function public.sumar_importada_prueba(p_user uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.pruebas set importadas = importadas + 1 where user_id = p_user;
$$;
revoke all on function public.sumar_importada_prueba(uuid) from public, anon, authenticated;
grant execute on function public.sumar_importada_prueba(uuid) to service_role;
