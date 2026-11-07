-- El dueño no quiere en la web la receta de caballa del 7/11 (había demasiado pescado seguido).
-- Se quita su artículo; la página queda como redirección a /recetas/ (web/recetas/…-27.html).
delete from public.blog_recetas where slug = 'caballa-al-horno-con-patata-y-pimiento-rojo-27';
