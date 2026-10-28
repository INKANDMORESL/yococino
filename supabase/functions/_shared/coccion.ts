// Tiempos de cocción reales de los ingredientes duros (patata, calabaza, boniato, zanahoria…).
// Se dan a la IA al escribir recetas y al revisar las ya guardadas, para que no queden duros.
// Sin dependencias de Deno: se prueba en reglas_test.ts.
import { normalizar } from './texto.ts';

export const INGREDIENTES_DUROS = [
  'patata', 'patatas', 'calabaza', 'boniato', 'batata', 'zanahoria', 'zanahorias', 'nabo', 'chirivia', 'remolacha',
  'yuca', 'colinabo', 'apionabo', 'castana', 'castanas', 'alcachofa', 'alcachofas', 'judia verde', 'judias verdes',
];

// ¿La receta lleva alguno de esos ingredientes?
export function llevaIngredienteDuro(ingredientes: { nombre: string }[]): boolean {
  return ingredientes.some((i) => {
    const n = ` ${normalizar(i.nombre)} `;
    return INGREDIENTES_DUROS.some((d) => n.includes(` ${d} `));
  });
}

export const REGLA_COCCION = `- Tiempos de cocción REALES, para que nada quede duro (si dudas, pon el tiempo más largo):
  · Patata o boniato: en dados de 2 cm, hervidos o en guiso 20-25 min; en rodajas de 1 cm a la sartén tapada 15-20 min; al horno en gajos o dados 35-45 min a 200 °C; enteros medianos hervidos 30-40 min; en airfryer en dados 18-22 min a 190 °C agitando a mitad.
  · Calabaza: en dados de 2 cm hervida o en guiso 15-20 min; al horno en dados 25-35 min a 200 °C.
  · Zanahoria: en rodajas hervida 12-15 min; al horno 30-35 min a 200 °C. Judías verdes hervidas 8-12 min. Alcachofas hervidas 20-25 min.
  · Si un paso cuece patata, calabaza o similares, di el tamaño del corte y cómo comprobar que está hecho («hasta que se pinchen fácilmente con un cuchillo»).
  · Nunca acortes una cocción para que la receta quepa en los minutos del nivel: corta más pequeño o usa otra técnica. Los minutos totales deben incluir esos tiempos.`;
