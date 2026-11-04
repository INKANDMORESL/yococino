// Platos que el dueño no quiere en Yococino (de momento: gachas y porridge). No se proponen, no se crean
// y los que ya existían están ocultos (migración 20261104160000_vetados.sql, con la misma regla).
import { normalizar } from './texto.ts';

const VETADOS = /\b(gachas?|porridges?|papillas?)\b/;

export function platoVetado(nombre: string): boolean {
  return VETADOS.test(normalizar(nombre));
}

// Para la IA (menú, recetario y recetas nuevas).
export const REGLA_VETADOS = '- Nunca propongas ni escribas gachas ni porridge (de avena, quinoa, sarraceno ni de nada): son otro tipo de desayuno.';
