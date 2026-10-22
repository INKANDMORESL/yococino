-- Límite global de recetas nuevas al mes (entre todos los clientes) y administradores. Idempotente.
-- Primeros 7 meses desde el lanzamiento: 600 al mes; después: 200 al mes (decisión del dueño).

create table if not exists public.ajustes_recetas (
  id smallint primary key default 1 check (id = 1),
  fecha_inicio date not null default current_date,
  tope_inicial integer not null default 600,
  meses_iniciales integer not null default 7,
  tope_despues integer not null default 200
);
insert into public.ajustes_recetas (id) values (1) on conflict (id) do nothing;
alter table public.ajustes_recetas enable row level security;
revoke all on public.ajustes_recetas from anon, authenticated;
grant all on public.ajustes_recetas to service_role;

create index if not exists recetas_creadas on public.recetas (created_at);

-- Tope de este mes y recetas ya creadas este mes (hora de España).
create or replace function public.cupo_recetas()
returns table (tope integer, usadas integer)
language sql stable security definer set search_path = public as $$
  select
    case when (now() at time zone 'Europe/Madrid')::date < (a.fecha_inicio + make_interval(months => a.meses_iniciales))::date
         then a.tope_inicial else a.tope_despues end,
    (select count(*)::integer from public.recetas
      where created_at >= (date_trunc('month', now() at time zone 'Europe/Madrid') at time zone 'Europe/Madrid'))
  from public.ajustes_recetas a where a.id = 1;
$$;
revoke all on function public.cupo_recetas() from public, anon, authenticated;
grant execute on function public.cupo_recetas() to service_role;

-- Administradores (el dueño). Cada uno solo puede ver su propia fila; nadie puede darse de alta desde la app.
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
drop policy if exists "me veo" on public.admins;
create policy "me veo" on public.admins for select to authenticated using (user_id = auth.uid());
revoke all on public.admins from anon, authenticated;
grant select on public.admins to authenticated;
grant all on public.admins to service_role;

insert into public.admins (user_id)
select id from auth.users where lower(email) = 'adrianpedrazag@gmail.com'
on conflict (user_id) do nothing;
