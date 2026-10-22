-- Recetas publicadas en la web (yococino.app/recetas), una al día, para atraer visitas desde Google. Idempotente.
create table if not exists public.blog_recetas (
  id bigint generated always as identity primary key,
  receta_id bigint not null unique references public.recetas (id) on delete cascade,
  slug text not null unique,
  titulo text not null,
  meta text not null,
  contenido jsonb not null,
  publicada_el date not null default ((now() at time zone 'Europe/Madrid')::date),
  created_at timestamptz not null default now()
);
create index if not exists blog_recetas_fecha on public.blog_recetas (publicada_el desc);
alter table public.blog_recetas enable row level security;
revoke all on public.blog_recetas from anon, authenticated;
grant all on public.blog_recetas to service_role;
grant usage, select on all sequences in schema public to service_role;
