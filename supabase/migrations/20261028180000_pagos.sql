-- Pagos con RevenueCat: la función pagos-revenuecat guarda aquí cada suscripción (una fila por persona).
-- activa_hasta > ahora = premium (estado_plan). peques = plan «Premium + Peques».
alter table public.suscripciones add column if not exists producto text;
alter table public.suscripciones add column if not exists tienda text;
alter table public.suscripciones add column if not exists cancelada boolean not null default false;
alter table public.suscripciones add column if not exists evento_ms bigint;
alter table public.suscripciones add column if not exists entorno text;
