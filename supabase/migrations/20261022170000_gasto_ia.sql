-- Control de gasto por cliente (máximo 9 €/año en IA, fotos y demás). Idempotente.
alter table public.usos_ia add column if not exists coste_usd numeric(10,6) not null default 0;

-- Gasto en dólares de una persona desde una fecha (solo lo usa el servidor).
create or replace function public.gasto_ia(p_user uuid, p_desde timestamptz)
returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce(sum(coste_usd), 0) from public.usos_ia where user_id = p_user and created_at >= p_desde;
$$;
revoke all on function public.gasto_ia(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.gasto_ia(uuid, timestamptz) to service_role;
