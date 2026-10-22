-- Mensajes de contacto entre cada cliente y el equipo de Yococino. Idempotente.
-- El cliente ve y escribe solo sus mensajes; las respuestas del equipo las escribe el servidor (panel).
create table if not exists public.mensajes (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  de text not null check (de in ('cliente', 'equipo')),
  texto text not null check (char_length(btrim(texto)) between 1 and 2000),
  created_at timestamptz not null default now(),
  leido_at timestamptz
);
create index if not exists mensajes_usuario on public.mensajes (user_id, created_at);
alter table public.mensajes enable row level security;

drop policy if exists "leo mis mensajes" on public.mensajes;
create policy "leo mis mensajes" on public.mensajes for select to authenticated using (user_id = auth.uid());
drop policy if exists "escribo como cliente" on public.mensajes;
create policy "escribo como cliente" on public.mensajes for insert to authenticated
  with check (user_id = auth.uid() and de = 'cliente' and leido_at is null);

revoke all on public.mensajes from anon, authenticated;
grant select, insert on public.mensajes to authenticated;
-- El cliente solo puede marcar como leídas las respuestas del equipo.
grant update (leido_at) on public.mensajes to authenticated;
drop policy if exists "marco leidos" on public.mensajes;
create policy "marco leidos" on public.mensajes for update to authenticated
  using (user_id = auth.uid() and de = 'equipo') with check (user_id = auth.uid() and de = 'equipo');
grant all on public.mensajes to service_role;

-- Como mucho 20 mensajes del cliente al día (evita abusos).
create or replace function public.limitar_mensajes() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.de = 'cliente' and (select count(*) from public.mensajes
      where user_id = new.user_id and de = 'cliente' and created_at > now() - interval '1 day') >= 20 then
    raise exception 'Has enviado muchos mensajes hoy. Te responderemos pronto.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
drop trigger if exists limitar_mensajes on public.mensajes;
create trigger limitar_mensajes before insert on public.mensajes for each row execute function public.limitar_mensajes();

-- Recetas: se pueden ocultar desde el panel (no se borran porque los menús las usan).
alter table public.recetas add column if not exists oculta boolean not null default false;
