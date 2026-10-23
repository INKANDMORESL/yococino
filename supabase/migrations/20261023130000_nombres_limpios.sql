-- Quita de los nombres visibles las notas internas entre paréntesis, como "(sin pescado)" o "(variante 2)".
-- Solo cambia lo que se ve: nombre_norm (la clave interna) y las direcciones de la web se quedan igual. Idempotente.
update public.recetas
set nombre = btrim(regexp_replace(nombre, '\s*\((sin|aptos?|aptas?|variante|version|versión|para)\M[^)"]*\)', '', 'gi'))
where nombre ~* '\((sin|aptos?|aptas?|variante|version|versión|para)\M[^)"]*\)';

update public.blog_recetas
set titulo = btrim(regexp_replace(titulo, '\s*\((sin|aptos?|aptas?|variante|version|versión|para)\M[^)"]*\)', '', 'gi')),
    meta = btrim(regexp_replace(meta, '\s*\((sin|aptos?|aptas?|variante|version|versión|para)\M[^)"]*\)', '', 'gi')),
    contenido = regexp_replace(contenido::text, '\s*\((sin|aptos?|aptas?|variante|version|versión|para)\M[^)"]*\)', '', 'gi')::jsonb
where titulo ~* '\((sin|aptos?|aptas?|variante|version|versión|para)\M[^)"]*\)'
   or meta ~* '\((sin|aptos?|aptas?|variante|version|versión|para)\M[^)"]*\)'
   or contenido::text ~* '\((sin|aptos?|aptas?|variante|version|versión|para)\M[^)"]*\)';
