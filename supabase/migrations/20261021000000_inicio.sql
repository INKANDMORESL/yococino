-- Yococino: estructura inicial de la base de datos.
-- Cada persona solo puede ver y cambiar sus propios datos (Row Level Security).
-- La biblioteca de recetas es compartida: todos la leen, solo el servidor la escribe.

-- ---------- Perfil y encuesta ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre text,
  fecha_nacimiento date,
  sexo text check (sexo in ('mujer', 'hombre', 'otro')),
  altura_cm numeric(5,1) check (altura_cm between 120 and 230),
  peso_inicial_kg numeric(5,1) check (peso_inicial_kg between 30 and 300),
  objetivo text check (objetivo in ('perder', 'mantener', 'musculo')),
  peso_objetivo_kg numeric(5,1),
  actividad text check (actividad in ('nada', 'poca', 'media', 'alta')),
  nivel_cocina text check (nivel_cocina in ('facil', 'medio', 'elaborado')),
  comidas_dia smallint not null default 5 check (comidas_dia between 3 and 5),
  -- Datos de salud: alergias, intolerancias y situaciones que requieren un profesional.
  alergias text[] not null default '{}',
  condiciones text[] not null default '{}',
  no_me_gusta text[] not null default '{}',
  -- De los peques solo se guarda cuántos hay y sus franjas de edad. Nunca nombres.
  num_peques smallint not null default 0 check (num_peques between 0 and 10),
  franjas_peques text[] not null default '{}',
  -- Consentimiento explícito para tratar datos de salud (RGPD, art. 9).
  consentimiento_salud_at timestamptz,
  encuesta_completada_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Objetivo de peso por encima del mínimo saludable para la altura (IMC 18,5).
  constraint objetivo_saludable check (
    peso_objetivo_kg is null or altura_cm is null
    or peso_objetivo_kg >= round(18.5 * (altura_cm / 100) ^ 2, 1)
  )
);

-- ---------- Suscripciones (las actualiza el servidor con los avisos de RevenueCat) ----------
create table public.suscripciones (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan_anual boolean not null default false,
  peques boolean not null default false,
  activa_hasta timestamptz,
  updated_at timestamptz not null default now()
);

-- ---------- Biblioteca de recetas compartida ----------
create table public.recetas (
  id bigint generated always as identity primary key,
  nombre text not null,
  nombre_norm text not null unique,
  tipo_comida text not null check (tipo_comida in ('desayuno', 'media_manana', 'almuerzo', 'merienda', 'cena', 'otro')),
  nivel text not null default 'facil' check (nivel in ('facil', 'medio', 'elaborado')),
  minutos smallint,
  raciones smallint not null default 1,
  pasos jsonb not null default '[]',
  consejos jsonb not null default '[]',
  sustituciones jsonb not null default '[]',
  nutricion jsonb, -- por ración: kcal, proteinas, hidratos, grasas, fibra
  alergenos text[] not null default '{}', -- los 14 alérgenos de declaración obligatoria en la UE
  version_peques jsonb, -- receta infantil con los mismos ingredientes
  imagen text,
  revisada boolean not null default false, -- validada por un dietista-nutricionista
  created_at timestamptz not null default now()
);

create table public.ingredientes (
  id bigint generated always as identity primary key,
  receta_id bigint not null references public.recetas (id) on delete cascade,
  orden smallint not null default 0,
  nombre text not null,
  cantidad numeric,
  unidad text,
  nota text,
  seccion text check (seccion in ('carne_pescado', 'fruta_verdura', 'lacteos', 'cereales', 'despensa', 'congelados'))
);
create index ingredientes_receta on public.ingredientes (receta_id);

-- ---------- Menú de cada persona (siempre 30 días por delante) ----------
create table public.comidas (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  fecha date not null,
  orden smallint not null,
  tipo_comida text not null,
  receta_id bigint references public.recetas (id) on delete set null,
  hecha boolean not null default false,
  hecha_at timestamptz,
  unique (user_id, fecha, orden)
);
create index comidas_usuario_fecha on public.comidas (user_id, fecha);

create table public.favoritas (
  user_id uuid not null references auth.users (id) on delete cascade,
  receta_id bigint not null references public.recetas (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, receta_id)
);

-- ---------- Progreso ----------
create table public.pesos (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  fecha date not null,
  peso_kg numeric(5,1) not null check (peso_kg between 30 and 300),
  nota text
);
create index pesos_usuario_fecha on public.pesos (user_id, fecha);

create table public.medidas (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  fecha date not null,
  cintura numeric(5,1), pecho numeric(5,1), abdomen numeric(5,1),
  cadera numeric(5,1), brazo numeric(5,1), muslo numeric(5,1),
  nota text
);

-- ---------- Lista de la compra ----------
create table public.compra_marcas (
  user_id uuid not null references auth.users (id) on delete cascade,
  clave text not null,
  marcado boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, clave)
);

-- ---------- Seguridad por filas ----------
alter table public.profiles enable row level security;
alter table public.suscripciones enable row level security;
alter table public.recetas enable row level security;
alter table public.ingredientes enable row level security;
alter table public.comidas enable row level security;
alter table public.favoritas enable row level security;
alter table public.pesos enable row level security;
alter table public.medidas enable row level security;
alter table public.compra_marcas enable row level security;

create policy "perfil propio" on public.profiles
  for all to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "ver mi suscripcion" on public.suscripciones
  for select to authenticated using (user_id = auth.uid());

create policy "recetas para todos" on public.recetas
  for select to authenticated using (true);
create policy "ingredientes para todos" on public.ingredientes
  for select to authenticated using (true);

create policy "mis comidas" on public.comidas
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "mis favoritas" on public.favoritas
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "mis pesos" on public.pesos
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "mis medidas" on public.medidas
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "mi compra" on public.compra_marcas
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Crear el perfil vacío automáticamente al registrarse.
create function public.crear_perfil() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger al_registrarse
  after insert on auth.users
  for each row execute function public.crear_perfil();

-- Mantener updated_at al día.
create function public.tocar_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger perfiles_updated before update on public.profiles
  for each row execute function public.tocar_updated_at();
