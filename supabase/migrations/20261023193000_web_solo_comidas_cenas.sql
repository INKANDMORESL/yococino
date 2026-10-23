-- En la web solo se publican comidas y cenas: se retiran los desayunos, medias mañanas y meriendas ya publicados. Idempotente.
delete from public.blog_recetas b
using public.recetas r
where r.id = b.receta_id and r.tipo_comida not in ('almuerzo', 'cena');
