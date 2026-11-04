-- 1) Gachas y porridge: el dueño no los quiere. Se ocultan (no salen en menús, recetario ni web) y se quitan
--    del menú desde hoy, sin tocar lo ya hecho (misma regla que _shared/vetados.ts).
update public.recetas set oculta = true
where not oculta and nombre_norm ~ '\m(gachas?|porridges?|papillas?)\M';

delete from public.comidas c
using public.recetas r
where c.receta_id = r.id and r.nombre_norm ~ '\m(gachas?|porridges?|papillas?)\M'
  and not c.hecha and c.fecha >= (now() at time zone 'Europe/Madrid')::date;

-- 2) Recetas creadas al cambiar un ingrediente: solo para quien las pidió, nunca para nadie más.
--    Se ocultan del catálogo; si solo una persona la tiene en su menú, pasa a ser privada suya.
--    (Si ya la usan varias personas, se queda visible para ellas, pero no se ofrece a nadie más.)
update public.recetas r set oculta = true
where r.id in (select nueva_id from public.variantes_receta) and not r.oculta;

update public.recetas r set privada_de = u.user_id
from (
  select c.receta_id, min(c.user_id::text)::uuid as user_id
  from public.comidas c
  where c.receta_id in (select nueva_id from public.variantes_receta)
  group by c.receta_id
  having count(distinct c.user_id) = 1
) u
where r.id = u.receta_id and r.privada_de is null;
