// Platos según la época del año: con calor, más platos fríos y frescos (gazpacho, salmorejo, ensaladas…);
// con frío, más platos calientes de cuchara (sopas, cremas, guisos, legumbres…). Sin IA: por el nombre del plato.
// Sin dependencias de Deno: se prueba en reglas_test.ts.
import { normalizar } from './texto.ts';

export type Estacion = 'calor' | 'frio' | 'templado';
export type Temperatura = 'frio' | 'caliente';

// Junio a septiembre, calor; noviembre a marzo, frío; abril, mayo y octubre, entretiempo.
export function estacionDe(mes: number): Estacion {
  if (mes >= 6 && mes <= 9) return 'calor';
  if (mes >= 11 || mes <= 3) return 'frio';
  return 'templado';
}

const FRIOS = [
  'gazpacho', 'salmorejo', 'ajoblanco', 'ajo blanco', 'porra', 'pipirrana', 'esqueixada', 'remojon', 'empedrado',
  'ensalada', 'ensaladilla', 'vichyssoise', 'tartar', 'tartaro', 'carpaccio', 'ceviche', 'poke', 'tabule', 'tabbouleh',
  'cogollos', 'sopa fria', 'crema fria', 'fria', 'frio', 'frias', 'frios',
];
const CALIENTES = [
  'sopa', 'caldo', 'consome', 'crema de', 'pure', 'cocido', 'potaje', 'guiso', 'guisado', 'guisada', 'estofado', 'estofada',
  'fabada', 'lentejas', 'alubias', 'judiones', 'garbanzos con', 'pochas', 'caldereta', 'marmitako', 'olla', 'pote',
  'puchero', 'gachas', 'migas', 'gazpachuelo', 'callos', 'menestra',
  'sopas de ajo', 'caldoso', 'caldosa', 'escudella', 'porrusalda',
];

const contiene = (texto: string, palabra: string) => new RegExp(`(^| )${palabra}( |$)`).test(texto);

// 'frio' = plato frío o fresco; 'caliente' = plato caliente de cuchara o guiso; null = ni lo uno ni lo otro.
export function temperaturaPlato(nombre: string): Temperatura | null {
  const t = normalizar(nombre);
  // «Crema fría de calabacín» o «sopa fría» es fría aunque sea crema o sopa.
  if (FRIOS.some((p) => contiene(t, p))) return 'frio';
  if (CALIENTES.some((p) => contiene(t, p))) return 'caliente';
  return null;
}

// ¿Pega con la época? true = muy de temporada, false = mejor en otra época, null = vale siempre.
export function pegaConEstacion(nombre: string, estacion: Estacion): boolean | null {
  if (estacion === 'templado') return null;
  const temp = temperaturaPlato(nombre);
  if (!temp) return null;
  return estacion === 'calor' ? temp === 'frio' : temp === 'caliente';
}

// Regla para el menú (almuerzos y cenas).
export function reglaEstacion(estacion: Estacion): string | null {
  if (estacion === 'calor')
    return 'Hace calor: en almuerzos y cenas pon muchos platos fríos o frescos (gazpacho, salmorejo, ensaladas completas, ensaladas de legumbres o de pasta, pescado a la plancha con ensalada…), al menos 5 a la semana, marcados «fresco» en el catálogo. Como mucho 1 plato caliente de cuchara a la semana (marcados «caliente»); las legumbres, mejor en ensalada.';
  if (estacion === 'frio')
    return 'Hace frío: en almuerzos y cenas pon platos calientes de cuchara (sopas, cremas, guisos, legumbres, cocidos…), entre 4 y 6 a la semana, marcados «caliente» en el catálogo. Nada de gazpacho, salmorejo ni platos fríos como plato principal (marcados «fresco»); las ensaladas, solo de acompañamiento.';
  return null;
}
