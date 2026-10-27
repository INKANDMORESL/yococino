// Equivalencias de cocina para la lista de la compra («no hay merluza: ¿qué compro?»), sin IA.
// Cada grupo son ingredientes que se pueden usar uno por otro en la misma cantidad.
// Sin dependencias de Deno: se prueba en reglas_test.ts.
import { contieneAlimento, normalizar } from './texto.ts';

const GRUPOS: string[][] = [
  ['merluza', 'bacalao fresco', 'rosada', 'pescadilla', 'abadejo', 'gallo', 'lenguado', 'lubina', 'dorada', 'rape'],
  ['salmón', 'trucha', 'caballa', 'bonito', 'atún fresco', 'sardinas'],
  ['gambas', 'langostinos'],
  ['calamar', 'sepia', 'chipirones', 'pota'],
  ['mejillones', 'almejas', 'berberechos'],
  ['pechuga de pollo', 'pechuga de pavo', 'contramuslo de pollo', 'solomillo de pollo'],
  ['muslo de pollo', 'contramuslo de pollo', 'jamoncito de pollo'],
  ['carne picada de ternera', 'carne picada de pollo', 'carne picada de pavo', 'carne picada mixta'],
  ['filete de ternera', 'lomo de cerdo', 'solomillo de cerdo', 'filete de pavo'],
  ['jamón serrano', 'jamón cocido', 'pechuga de pavo en lonchas'],
  ['atún en lata', 'bonito en conserva', 'caballa en lata', 'sardinas en lata'],
  ['tofu', 'tempeh', 'seitán'],
  ['cebolla', 'cebolleta', 'chalota', 'cebolla morada', 'puerro'],
  ['pimiento rojo', 'pimiento verde', 'pimiento amarillo', 'pimiento italiano'],
  ['tomate', 'tomate pera', 'tomate en rama', 'tomate cherry'],
  ['tomate triturado', 'tomate natural rallado', 'tomate en conserva'],
  ['calabacín', 'berenjena'],
  ['espinacas', 'acelgas', 'kale', 'canónigos'],
  ['lechuga', 'lechuga romana', 'cogollos', 'escarola', 'rúcula', 'canónigos'],
  ['brócoli', 'coliflor', 'romanesco', 'judías verdes'],
  ['judías verdes', 'guisantes', 'brócoli'],
  ['zanahoria', 'calabaza', 'boniato'],
  ['calabaza', 'boniato', 'zanahoria'],
  ['patata', 'boniato'],
  ['champiñones', 'setas', 'portobello'],
  ['espárragos verdes', 'judías verdes', 'calabacín'],
  ['pepino', 'calabacín'],
  ['arroz', 'arroz integral', 'quinoa'],
  ['pasta', 'pasta integral', 'pasta de lentejas', 'pasta de garbanzos'],
  ['pan integral', 'pan de centeno', 'pan de molde integral', 'pan sin gluten'],
  ['copos de avena', 'copos de espelta'],
  ['garbanzos cocidos', 'alubias blancas cocidas', 'lentejas cocidas', 'alubias rojas cocidas'],
  ['lentejas', 'lentejas rojas', 'garbanzos'],
  ['yogur natural', 'yogur griego', 'kéfir', 'skyr', 'queso fresco batido'],
  ['leche', 'leche semidesnatada', 'leche sin lactosa', 'bebida de avena', 'bebida de soja'],
  ['queso fresco', 'requesón', 'queso de burgos', 'mozzarella fresca', 'ricotta'],
  ['queso curado', 'queso manchego', 'parmesano', 'grana padano'],
  ['nata para cocinar', 'leche evaporada', 'yogur griego'],
  ['mantequilla', 'aceite de oliva virgen extra'],
  ['aceite de oliva virgen extra', 'aceite de oliva suave', 'aceite de girasol'],
  ['limón', 'lima'],
  ['vinagre de vino', 'vinagre de manzana', 'vinagre de jerez'],
  ['nueces', 'almendras', 'avellanas', 'anacardos'],
  ['manzana', 'pera'],
  ['fresas', 'frambuesas', 'arándanos', 'moras'],
  ['plátano', 'mango'],
  ['naranja', 'mandarina'],
  ['miel', 'sirope de arce'],
  ['caldo de pollo', 'caldo de verduras'],
  ['perejil', 'cilantro'],
  ['albahaca', 'orégano'],
  ['pimentón dulce', 'pimentón de la vera'],
  ['harina de trigo', 'harina integral', 'harina de avena', 'harina de arroz'],
];

// Equivalentes de un ingrediente (sin el propio). Se usa el grupo cuyo nombre encaja mejor (el más largo).
export function equivalentesDe(ingrediente: string): string[] {
  const n = normalizar(ingrediente);
  if (!n) return [];
  let mejor: { largo: number; grupo: string[]; miembro: string } | null = null;
  for (const g of GRUPOS) {
    for (const m of g) {
      if (contieneAlimento(n, m) && (!mejor || normalizar(m).length > mejor.largo)) mejor = { largo: normalizar(m).length, grupo: g, miembro: m };
    }
  }
  if (!mejor) return [];
  const propio = normalizar(mejor.miembro);
  // Varios grupos pueden compartir miembros: se juntan los de todos los grupos de ese miembro.
  const todos = GRUPOS.filter((g) => g.some((m) => normalizar(m) === propio)).flat();
  return [...new Set(todos.filter((m) => normalizar(m) !== propio && normalizar(m) !== n))].slice(0, 6);
}
