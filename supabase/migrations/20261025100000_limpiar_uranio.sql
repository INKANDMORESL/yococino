-- Limpieza: una prueba cambió «cebolla» por «uranio» y la receta 435 quedó con un consejo sobre el error.
-- Se quita ese consejo (la receta es válida con puerro) y se borra la variante para que nadie la reutilice. Idempotente.
update public.recetas
set consejos = coalesce((select jsonb_agg(c) from jsonb_array_elements(consejos) c where c::text not ilike '%uranio%'), '[]'::jsonb)
where consejos::text ilike '%uranio%';
update public.recetas
set sustituciones = coalesce((select jsonb_agg(c) from jsonb_array_elements(sustituciones) c where c::text not ilike '%uranio%'), '[]'::jsonb)
where sustituciones::text ilike '%uranio%';
delete from public.variantes_receta where por ilike '%uranio%';
