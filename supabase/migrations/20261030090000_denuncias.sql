-- Denuncias de recetas desde la app (requisito de Apple para contenido creado por usuarios).
-- La receta denunciada se oculta al momento para quien la denuncia; el equipo la revisa.
create table if not exists public.recetas_denuncias (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  receta_id bigint not null references public.recetas (id) on delete cascade,
  motivo text not null check (char_length(btrim(motivo)) between 1 and 200),
  created_at timestamptz not null default now(),
  revisada_at timestamptz,
  unique (user_id, receta_id)
);
create index if not exists recetas_denuncias_receta on public.recetas_denuncias (receta_id);
alter table public.recetas_denuncias enable row level security;

drop policy if exists "veo mis denuncias" on public.recetas_denuncias;
create policy "veo mis denuncias" on public.recetas_denuncias for select to authenticated using (user_id = auth.uid());
drop policy if exists "denuncio recetas" on public.recetas_denuncias;
create policy "denuncio recetas" on public.recetas_denuncias for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "quito mis denuncias" on public.recetas_denuncias;
create policy "quito mis denuncias" on public.recetas_denuncias for delete to authenticated using (user_id = auth.uid());
