// Lo que se compra por piezas (pimientos, cebollas, tomates…): se enseña «1 ½ pimientos» en vez de «225 g».
// Pesos medios de una pieza mediana; la cantidad exacta en gramos sigue al lado, entre paréntesis.
import { contieneAlimento, normalizar } from '../../lib/texto';

const PIEZAS: [string, number, string?][] = [
  // [alimento, gramos por pieza, nombre de la pieza si no es «unidad»]
  ['pimiento', 150], ['cebolla', 150], ['cebolleta', 60], ['chalota', 30], ['puerro', 150],
  ['tomate cherry', 15], ['tomate', 120], ['patata', 200], ['boniato', 250], ['zanahoria', 80],
  ['calabacin', 250], ['berenjena', 300], ['pepino', 250], ['aguacate', 180], ['alcachofa', 120],
  ['remolacha', 150], ['nabo', 150], ['cogollo', 120], ['limon', 100], ['lima', 60], ['naranja', 200],
  ['mandarina', 80], ['manzana', 180], ['pera', 170], ['platano', 120], ['kiwi', 80], ['melocoton', 150],
  ['nectarina', 150], ['caqui', 200], ['granada', 300], ['mango', 300], ['higo', 50], ['huevo', 60],
  ['ajo', 5, 'diente'],
];
// Si el nombre lleva algo de esto, se compra a peso o en bote: se deja en gramos.
const A_PESO = ['clara', 'yema', 'polvo', 'triturad', 'frito', 'concentrad', 'seco', 'deshidratad', 'molid', 'zumo', 'ralladura', 'conserva',
  'piquillo', 'congelad', 'mermelada', 'compota', 'pasta de', 'salsa', 'pimenton', 'asado en', 'en tiras', 'cocid', 'pure'];

function piezaDe(nombre: string): { gramos: number; pieza?: string } | null {
  const n = normalizar(nombre);
  if (A_PESO.some((p) => n.includes(p))) return null;
  for (const [alimento, gramos, pieza] of PIEZAS) {
    if (contieneAlimento(n, alimento)) return { gramos, pieza };
  }
  return null;
}

// Medias piezas: 0,5 · 1 · 1,5 · 2… (nunca menos de media).
const aMedios = (v: number, haciaArriba = false) => Math.max(0.5, (haciaArriba ? Math.ceil(v * 2 - 0.15) : Math.round(v * 2)) / 2);
export const textoMedios = (v: number) => {
  const entero = Math.floor(v);
  const medio = v - entero >= 0.5;
  return entero ? `${entero}${medio ? ' ½' : ''}` : '½';
};

// «1 ½ (225 g)» para un ingrediente en gramos que se compra por piezas; null si va a peso.
export function enPiezas(nombre: string, gramos: number, haciaArriba = false): string | null {
  const p = piezaDe(nombre);
  if (!p || !(gramos > 0)) return null;
  const n = aMedios(gramos / p.gramos, haciaArriba);
  const g = gramos >= 20 ? Math.round(gramos / 5) * 5 : Math.round(gramos);
  if (p.pieza) return `${textoMedios(n)} ${n > 1 ? `${p.pieza}s` : p.pieza} (${g} g)`;
  return `${textoMedios(n)} (${g} g)`;
}
