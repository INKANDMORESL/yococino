-- Prueba gratis de 7 días y estado del plan de cada persona. Idempotente.

-- Interruptor general: con planes desactivados, todos ven la versión completa (como hasta ahora).
create table if not exists public.ajustes_planes (
  id smallint primary key default 1 check (id = 1),
  planes_activos boolean not null default true,
  dias_prueba integer not null default 7,
  presupuesto_prueba_eur numeric(6,2) not null default 0.50
);
insert into public.ajustes_planes (id) values (1) on conflict (id) do nothing;
alter table public.ajustes_planes enable row level security;
revoke all on public.ajustes_planes from anon, authenticated;
grant all on public.ajustes_planes to service_role;

-- Inicio de la prueba de cada persona: lo apunta el servidor al preparar su primer menú (la app no puede cambiarlo).
create table if not exists public.pruebas (
  user_id uuid primary key references auth.users (id) on delete cascade,
  inicio date not null default ((now() at time zone 'Europe/Madrid')::date)
);
alter table public.pruebas enable row level security;
revoke all on public.pruebas from anon, authenticated;
grant all on public.pruebas to service_role;

-- Estado del plan: 'premium', 'prueba' o 'caducada', con el último día de la prueba.
create or replace function public.estado_plan(p_user uuid)
returns table (estado text, fin_prueba date)
language plpgsql stable security definer set search_path = public as $$
declare
  hoy date := (now() at time zone 'Europe/Madrid')::date;
  dias integer;
  activos boolean;
  inicio_prueba date;
begin
  select coalesce(a.planes_activos, true), coalesce(a.dias_prueba, 7) into activos, dias from public.ajustes_planes a where a.id = 1;
  activos := coalesce(activos, true);
  dias := coalesce(dias, 7);
  select p.inicio into inicio_prueba from public.pruebas p where p.user_id = p_user;
  if not activos
     or exists (select 1 from public.admins where user_id = p_user)
     or exists (select 1 from public.suscripciones s where s.user_id = p_user and s.activa_hasta > now()) then
    return query select 'premium'::text, null::date;
    return;
  end if;
  if inicio_prueba is null then
    return query select 'prueba'::text, hoy + (dias - 1);
  elsif hoy <= inicio_prueba + (dias - 1) then
    return query select 'prueba'::text, inicio_prueba + (dias - 1);
  else
    return query select 'caducada'::text, inicio_prueba + (dias - 1);
  end if;
end;
$$;
revoke all on function public.estado_plan(uuid) from public, anon, authenticated;
grant execute on function public.estado_plan(uuid) to service_role;

-- Para la app: el plan de quien llama.
create or replace function public.mi_plan()
returns table (estado text, fin_prueba date)
language sql stable security definer set search_path = public as $$
  select * from public.estado_plan(auth.uid());
$$;
revoke all on function public.mi_plan() from public, anon;
grant execute on function public.mi_plan() to authenticated;
