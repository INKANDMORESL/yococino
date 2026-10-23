-- Prueba gratis: como mucho 10 platos nuevos creados por la persona (cambiar plato, cocina con lo que tienes,
-- cambiar ingrediente). Más allá, hay que suscribirse. El máximo se cambia en ajustes_planes.recetas_prueba. Idempotente.
alter table public.ajustes_planes add column if not exists recetas_prueba integer not null default 10;
alter table public.pruebas add column if not exists recetas_nuevas integer not null default 0;

create or replace function public.sumar_receta_prueba(p_user uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.pruebas set recetas_nuevas = recetas_nuevas + 1 where user_id = p_user;
$$;
revoke all on function public.sumar_receta_prueba(uuid) from public, anon, authenticated;
grant execute on function public.sumar_receta_prueba(uuid) to service_role;
