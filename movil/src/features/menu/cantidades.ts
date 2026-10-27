// Cantidades de una receta ajustadas a la ración de cada persona, redondeadas para la cocina.
import { enPiezas } from './piezas';

const FRACCIONES: [number, string][] = [
  [0.25, '¼'],
  [0.33, '⅓'],
  [0.5, '½'],
  [0.67, '⅔'],
  [0.75, '¾'],
];

function conFraccion(v: number): string {
  const entero = Math.floor(v);
  const resto = v - entero;
  if (resto < 0.12) return String(entero || 1);
  if (resto > 0.88) return String(entero + 1);
  const [, simbolo] = FRACCIONES.reduce((mejor, f) => (Math.abs(f[0] - resto) < Math.abs(mejor[0] - resto) ? f : mejor));
  return entero ? `${entero} ${simbolo}` : simbolo;
}

// Con el nombre del ingrediente, lo que se compra por piezas sale como «1 ½ (225 g)» (ver piezas.ts).
export function cantidadTexto(cantidad: number | null, unidad: string | null, factor = 1, nombre?: string): string {
  const u = unidad ?? '';
  if (u === 'al gusto' || cantidad === null || cantidad === undefined) return 'al gusto';
  const v = cantidad * factor;
  if (u === 'g' && nombre) {
    const piezas = enPiezas(nombre, v);
    if (piezas) return piezas;
  }
  if (u === 'g' || u === 'ml') {
    if (v >= 1000) return `${(v / 1000).toLocaleString('es-ES', { maximumFractionDigits: 1 })} ${u === 'g' ? 'kg' : 'l'}`;
    const redondeado = v >= 20 ? Math.round(v / 5) * 5 : Math.max(1, Math.round(v));
    return `${redondeado} ${u}`;
  }
  if (u === 'pizca') return v > 1.5 ? `${Math.round(v)} pizcas` : '1 pizca';
  if (u === 'ud') return conFraccion(v);
  if (u === 'cda' || u === 'cdta') return `${conFraccion(v)} ${u}`;
  return `${conFraccion(v)} ${u}`.trim();
}

export const kcalTexto = (kcal: number | null | undefined, factor = 1) =>
  kcal ? `${Math.round((kcal * factor) / 10) * 10} kcal` : null;
