// Fruta de temporada en España. Meses del 1 (enero) al 12 (diciembre).
// Orientativo, según los calendarios de temporada habituales (producción española o de cercanía).
// Las frutas que no están en la lista (por ejemplo, plátano de Canarias, limón o manzana) se dan por buenas todo el año.
import { contieneAlimento, contienePalabra } from './texto.ts';

const rango = (desde: number, hasta: number): number[] => {
  const meses: number[] = [];
  for (let m = desde; ; m = (m % 12) + 1) {
    meses.push(m);
    if (m === hasta) break;
  }
  return meses;
};

export const FRUTAS_TEMPORADA: Record<string, number[]> = {
  naranja: rango(11, 5),
  mandarina: rango(10, 2),
  pomelo: rango(11, 4),
  kiwi: rango(11, 5),
  fresa: rango(2, 6),
  'fresón': rango(2, 6),
  'níspero': rango(4, 6),
  cereza: rango(5, 7),
  albaricoque: rango(5, 7),
  'melocotón': rango(6, 9),
  nectarina: rango(6, 9),
  paraguayo: rango(6, 9),
  ciruela: rango(6, 9),
  'sandía': rango(6, 9),
  'melón': rango(6, 9),
  frambuesa: rango(6, 9),
  'arándano': rango(5, 9),
  mora: rango(7, 9),
  higo: rango(8, 10),
  breva: rango(6, 7),
  uva: rango(8, 11),
  mango: rango(8, 11),
  granada: rango(9, 12),
  caqui: rango(10, 12),
  membrillo: rango(9, 12),
  chirimoya: rango(10, 2),
  pera: rango(7, 3),
  aguacate: rango(10, 5),
};

// La fruta seca, en conserva, congelada o en mermelada se puede usar todo el año.
const PRESERVADA = ['pasa', 'seca', 'seco', 'deshidratada', 'deshidratado', 'mermelada', 'congelada', 'congelado', 'confitura', 'almibar', 'zumo envasado'];

// Frutas fuera de temporada en ese mes que aparecen en los textos (ingredientes o nombre del plato).
export function frutasFueraDeTemporada(textos: string[], mes: number): string[] {
  const fuera = new Set<string>();
  for (const t of textos) {
    if (PRESERVADA.some((p) => contienePalabra(t, p))) continue;
    for (const [fruta, meses] of Object.entries(FRUTAS_TEMPORADA)) {
      if (!meses.includes(mes) && contieneAlimento(t, fruta)) fuera.add(fruta);
    }
  }
  return [...fuera];
}

// Frutas de temporada para ese mes, para decírselo a la IA.
export function frutasDelMes(mes: number): string[] {
  return Object.entries(FRUTAS_TEMPORADA)
    .filter(([, meses]) => meses.includes(mes))
    .map(([fruta]) => fruta)
    .concat(['manzana', 'plátano', 'limón']);
}

export const mesDe = (iso: string) => Number(iso.slice(5, 7));
