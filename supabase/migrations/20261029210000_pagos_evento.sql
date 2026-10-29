-- Último aviso recibido de RevenueCat (tipo), para diagnosticar pagos.
alter table public.suscripciones add column if not exists ultimo_evento text;
