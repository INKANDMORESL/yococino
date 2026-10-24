-- Registro de fallos del servidor para el panel (solo el nombre de la función y el mensaje técnico; nunca datos de personas).
create table if not exists public.errores_servidor (
  id bigint generated always as identity primary key,
  funcion text not null,
  tipo text not null default 'interno',
  mensaje text not null,
  created_at timestamptz not null default now()
);
create index if not exists errores_servidor_fecha on public.errores_servidor (created_at desc);
alter table public.errores_servidor enable row level security;
revoke all on public.errores_servidor from anon, authenticated;
grant all on public.errores_servidor to service_role;
