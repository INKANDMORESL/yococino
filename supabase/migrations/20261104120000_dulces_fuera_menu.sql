-- Hasta hoy el servidor seguía con la versión anterior del menú (sin el filtro de dulces) y pudo volver a
-- poner algún dulce al rellenar huecos. Se quitan otra vez desde hoy, sin tocar lo ya hecho.
delete from public.comidas c
using public.recetas r
where c.receta_id = r.id and r.dulce and not c.hecha and c.fecha >= (now() at time zone 'Europe/Madrid')::date;
