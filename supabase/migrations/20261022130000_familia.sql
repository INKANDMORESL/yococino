-- Familia en Progreso: hasta 4 personas más (adultas) por cuenta, cada una con su peso y sus medidas.
-- Idempotente: se puede aplicar más de una vez.

create table if not exists public.miembros (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nombre text not null check (char_length(btrim(nombre)) between 1 and 40),
  altura_cm numeric(5,1) check (altura_cm between 120 and 230),
  peso_inicial_kg numeric(5,1) check (peso_inicial_kg between 30 and 300),
  objetivo text not null default 'mantener' check (objetivo in ('perder', 'mantener', 'musculo')),
  peso_objetivo_kg numeric(5,1) check (peso_objetivo_kg between 30 and 300),
  mayor_edad boolean not null check (mayor_edad),
  consentimiento_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (id, user_id),
  -- El peso objetivo nunca puede dejar el IMC por debajo de 18,5.
  constraint miembros_imc_objetivo check (
    peso_objetivo_kg is null or altura_cm is null
    or peso_objetivo_kg / ((altura_cm / 100.0) * (altura_cm / 100.0)) >= 18.5
  )
);

alter table public.miembros enable row level security;

drop policy if exists "mis miembros" on public.miembros;
create policy "mis miembros" on public.miembros
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update, delete on public.miembros to authenticated;

-- Máximo 4 personas más por cuenta.
create or replace function public.limitar_miembros() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.miembros where user_id = new.user_id) >= 4 then
    raise exception 'Puedes añadir hasta 4 personas.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists limitar_miembros on public.miembros;
create trigger limitar_miembros before insert on public.miembros
  for each row execute function public.limitar_miembros();

-- Pesos y medidas: sin miembro = la persona de la cuenta.
alter table public.pesos add column if not exists miembro_id bigint;
alter table public.medidas add column if not exists miembro_id bigint;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'pesos_miembro_fk') then
    alter table public.pesos add constraint pesos_miembro_fk
      foreign key (miembro_id, user_id) references public.miembros (id, user_id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'medidas_miembro_fk') then
    alter table public.medidas add constraint medidas_miembro_fk
      foreign key (miembro_id, user_id) references public.miembros (id, user_id) on delete cascade;
  end if;
end;
$$;

create index if not exists pesos_miembro on public.pesos (miembro_id) where miembro_id is not null;
create index if not exists medidas_miembro on public.medidas (miembro_id) where miembro_id is not null;
