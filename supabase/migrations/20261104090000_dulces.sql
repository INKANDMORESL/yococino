-- Dulces (bizcochos, tartas, galletas, postres y todo lo que lleva azúcar añadido): nunca en el menú diario.
-- Se ofrecen aparte en «Dale un toque dulce a tu vida». La regla es la misma que _shared/dulces.ts.
alter table public.recetas add column if not exists dulce boolean not null default false;
create index if not exists recetas_dulce on public.recetas (dulce) where dulce;

update public.recetas r set dulce = true
where not r.dulce and (
  (
    r.tipo_comida in ('desayuno', 'media_manana', 'merienda', 'otro')
    and r.nombre_norm ~ '\m(bizcoch\w*|tartas?|tartaleta\w*|pastel(es)?|magdalen\w*|muffins?|brownies?|flan(es)?|natillas?|crema catalana|mousse|helados?|sorbete\w*|granizados?|gofres?|torrijas?|cookies?|galletas?|galletitas?|turron\w*|polvoron\w*|mantecados?|roscon\w*|bunuelos?|huesos de santo|membrillo|arroz con leche|crumble|coulant|bollos?|bolleria|donuts?|churros?|rosquill\w*|bombon\w*|trufas?|tiramisu|cheesecake|profiteroles?|panna cotta|leche frita|mazapan\w*|carrot cake|plum cake|pudin de pan)\M'
    and r.nombre_norm !~ '\m(galletas? de arroz|tortitas? de arroz|pastel de (carne|verdura|verduras|puerro|puerros|pescado|patata|berenjena|calabacin|atun|espinacas|cabracho)|tarta (salada|de (puerro|puerros|verduras|queso y espinacas|atun)))\M'
  )
  or exists (
    select 1 from public.ingredientes i
    where i.receta_id = r.id
      and translate(lower(i.nombre || ' ' || coalesce(i.nota, '')), 'áéíóúüñ', 'aeiouun') ~ '\m(azucar\w*|panela|sirope\w*|melaza|almibar|caramelo|leche condensada|dulce de leche|chocolate con leche|chocolate blanco|nocilla|nutella)\M'
      and translate(lower(i.nombre || ' ' || coalesce(i.nota, '')), 'áéíóúüñ', 'aeiouun') !~ '\msin azucar\M'
  )
);

-- Se quitan del menú desde hoy (sin tocar lo ya hecho); la app rellena esos huecos con otras recetas.
delete from public.comidas c
using public.recetas r
where c.receta_id = r.id and r.dulce and not c.hecha and c.fecha >= (now() at time zone 'Europe/Madrid')::date;
