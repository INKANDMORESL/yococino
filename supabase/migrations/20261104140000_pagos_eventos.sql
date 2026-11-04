-- Registro de los avisos de RevenueCat (compras, renovaciones, cancelaciones, reembolsos…) para la
-- sección Facturación del panel. Sin datos personales: cuenta, plan, importe y fecha.
create table if not exists public.pagos_eventos (
  id text primary key, -- id del aviso en RevenueCat (si llega repetido, no se duplica)
  user_id uuid references auth.users (id) on delete set null,
  tipo text not null,
  producto text,
  tienda text,
  entorno text,
  periodo text, -- NORMAL, TRIAL, INTRO…
  precio numeric, -- en la moneda de la compra, con IVA (negativo en reembolsos)
  moneda text,
  precio_usd numeric,
  neto_pct numeric, -- parte que llega al vendedor tras comisión de la tienda e impuestos (0-1), si RevenueCat la da
  motivo text, -- motivo de cancelación o caducidad
  momento timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists pagos_eventos_momento on public.pagos_eventos (momento desc);
alter table public.pagos_eventos enable row level security;
revoke all on public.pagos_eventos from anon, authenticated;
grant all on public.pagos_eventos to service_role;
