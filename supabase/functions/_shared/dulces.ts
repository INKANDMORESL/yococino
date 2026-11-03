// Dulces (bizcochos, tartas, galletas, postres…): nunca entran en el menú diario.
// Se ofrecen aparte, en «Dale un toque dulce a tu vida» (función especiales, clave 'dulce'),
// como algo para tomar de vez en cuando. Sin IA: reglas por nombre e ingredientes.
// La misma regla está en SQL en la migración 20261104090000_dulces.sql: si cambias una, cambia la otra.
import { normalizar } from './texto.ts';

// Repostería y postres (solo en desayunos, medias mañanas, meriendas y «otro»).
const POSTRE = /\b(bizcoch\w*|tartas?|tartaleta\w*|pastel(es)?|magdalen\w*|muffins?|brownies?|flan(es)?|natillas?|crema catalana|mousse|helados?|sorbete\w*|granizados?|gofres?|torrijas?|cookies?|galletas?|galletitas?|turron\w*|polvoron\w*|mantecados?|roscon\w*|bunuelos?|huesos de santo|membrillo|arroz con leche|crumble|coulant|bollos?|bolleria|donuts?|churros?|rosquill\w*|bombon\w*|trufas?|tiramisu|cheesecake|profiteroles?|panna cotta|leche frita|mazapan\w*|carrot cake|plum cake|pudin de pan)\b/;
// No son dulces aunque lo parezcan por el nombre.
const SALADO = /\b(galletas? de arroz|tortitas? de arroz|pastel de (carne|verdura|verduras|puerro|puerros|pescado|patata|berenjena|calabacin|atun|espinacas|cabracho)|tarta (salada|de (puerro|puerros|verduras|queso y espinacas|atun)))\b/;
// Azúcar añadido.
const AZUCAR = /\b(azucar\w*|panela|sirope\w*|melaza|almibar|caramelo|leche condensada|dulce de leche|chocolate con leche|chocolate blanco|nocilla|nutella)\b/;
const SIN_AZUCAR = /\bsin azucar\b/;

const TIPOS_DULCES = new Set(['desayuno', 'media_manana', 'merienda', 'otro']);

export interface RecetaParaDulce {
  nombre: string;
  tipo_comida: string;
  ingredientes: { nombre: string; nota?: string | null }[];
}

// Solo desayunos, medias mañanas, meriendas y «otro»: en comidas y cenas, una pizca de azúcar en un sofrito
// no hace el plato dulce (y las recetas nuevas del menú ya se piden sin azúcar añadido).
export function esDulce(r: RecetaParaDulce): boolean {
  if (!TIPOS_DULCES.has(r.tipo_comida)) return false;
  const nombre = normalizar(r.nombre);
  if (POSTRE.test(nombre) && !SALADO.test(nombre)) return true;
  return r.ingredientes.some((i) => {
    const t = normalizar(`${i.nombre} ${i.nota ?? ''}`);
    return AZUCAR.test(t) && !SIN_AZUCAR.test(t);
  });
}

// Para las recetas del menú diario (va en sistemaReceta).
export const REGLA_SIN_AZUCAR =
  '- Nada de azúcar añadido (ni azúcar blanco o moreno, panela, siropes, leche condensada ni chocolate con leche) y nada de repostería (bizcochos, tartas, galletas, magdalenas, flanes, natillas, helados…): el dulzor, de la fruta. Miel, como mucho una cucharadita.';

// Para los dulces de «Dale un toque dulce a tu vida».
export const REGLA_DULCE =
  '- Es un dulce casero BAJO EN AZÚCAR para tomar de vez en cuando: endulza sobre todo con fruta madura (plátano, manzana, dátiles, pasas) y, si hace falta, como mucho 10 g de azúcar o miel por ración. Mejor harina integral o avena, yogur natural y aceite de oliva en vez de mantequilla. Ración pequeña.';

// Dulces bajos en azúcar para el apartado (acción «dulces» de sembrar-recetas; solo los que faltan).
// Todos tienen que reconocerse con esDulce (lo comprueba reglas_test.ts).
export const LISTA_DULCES: string[] = [
  'Bizcocho de plátano y avena sin azúcar añadido',
  'Bizcocho de zanahoria y nueces con dátiles',
  'Bizcocho de manzana y canela integral',
  'Bizcocho de limón y yogur ligero',
  'Bizcocho de naranja entera',
  'Tarta de queso ligera al horno',
  'Tarta de manzana fina',
  'Tarta de requesón y frutos rojos',
  'Magdalenas integrales de plátano',
  'Muffins de arándanos y avena',
  'Galletas de avena y pasas',
  'Galletas de almendra y canela',
  'Brownie de cacao puro y plátano',
  'Flan de huevo con poco azúcar',
  'Natillas caseras ligeras con canela',
  'Arroz con leche ligero',
  'Crema catalana ligera',
  'Mousse de yogur y fresas',
  'Helado de plátano y cacao',
  'Sorbete de mango',
  'Torrijas al horno ligeras',
  'Crumble de manzana y avena',
  'Cheesecake de yogur sin horno',
  'Bizcocho de calabaza y especias',
];

// Cómo se presenta el apartado en la app (Inicio y su pantalla).
export const DULCE = {
  clave: 'dulce',
  emoji: '🍰',
  titulo: 'Dale un toque dulce a tu vida',
  descripcion: 'Bizcochos, tartas y postres caseros con poco azúcar, endulzados sobre todo con fruta.',
  nota: 'Aunque llevan poco azúcar, siguen siendo dulces: disfrútalos de vez en cuando, no a diario. Por eso no entran en tu menú.',
};
