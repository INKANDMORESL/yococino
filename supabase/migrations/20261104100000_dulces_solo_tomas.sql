-- Los dulces son solo desayunos, medias mañanas, meriendas y «otro»: en comidas y cenas, una pizca de azúcar
-- en el tomate no hace el plato dulce (misma regla que _shared/dulces.ts).
update public.recetas set dulce = false where dulce and tipo_comida in ('almuerzo', 'cena');
