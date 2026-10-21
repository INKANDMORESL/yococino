import type { Encuesta } from '../modelo';

export interface PasoProps {
  e: Encuesta;
  cambiar: (parcial: Partial<Encuesta>) => void;
}

export const alternar = <T,>(lista: readonly T[], valor: T): T[] =>
  lista.includes(valor) ? lista.filter((x) => x !== valor) : [...lista, valor];
