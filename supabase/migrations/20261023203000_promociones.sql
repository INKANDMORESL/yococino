-- Permiso opcional para recibir novedades y promociones por email. Se guarda cuándo se dio y cuándo se retiró. Idempotente.
alter table public.profiles add column if not exists promociones boolean not null default false;
alter table public.profiles add column if not exists promociones_at timestamptz;
alter table public.profiles add column if not exists promociones_baja_at timestamptz;
