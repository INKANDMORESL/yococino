// Junta los ingredientes de varias comidas en una lista de la compra.
import { mayuscula, normalizar } from '../../lib/texto';

export const SECCIONES: { clave: string; texto: string; emoji: string }[] = [
  { clave: 'fruta_verdura', texto: 'Frutas y verduras', emoji: '🥦' },
  { clave: 'carne_pescado', texto: 'Carne, pescado y huevos', emoji: '🥩' },
  { clave: 'lacteos', texto: 'Lácteos', emoji: '🥛' },
  { clave: 'cereales', texto: 'Pan, cereales y pasta', emoji: '🍞' },
  { clave: 'despensa', texto: 'Despensa', emoji: '🥫' },
  { clave: 'congelados', texto: 'Congelados', emoji: '🧊' },
];

export interface IngredienteCompra {
  nombre: string;
  cantidad: number | null;
  unidad: string | null;
  seccion: string | null;
}

export interface ComidaConIngredientes {
  id?: number;
  fecha?: string;
  tipo_comida?: string;
  factor: number;
  receta: { id?: number; nombre?: string; ingredientes: IngredienteCompra[] } | null;
}

export interface Articulo {
  clave: string;
  nombre: string;
  cantidad: number | null;
  unidad: string;
  seccion: string;
  platos: number;
}

const UNIDADES_SUMABLES = new Set(['g', 'ml', 'ud', 'cda', 'cdta', 'pizca']);

// Raciones de la casa: la tuya (ajustada a tu plan con el factor), una ración normal por cada otro adulto
// y algo más de media por cada peque (orientativo: los peques comen según su hambre).
export const RACION_PEQUE = 0.6;
export interface Comensales {
  adultos: number;
  peques: number;
}

export function agruparCompra(comidas: ComidaConIngredientes[], casa: Comensales = { adultos: 1, peques: 0 }): Articulo[] {
  const otros = Math.max(0, casa.adultos - 1) + Math.max(0, casa.peques) * RACION_PEQUE;
  const mapa = new Map<string, Articulo>();
  for (const c of comidas) {
    for (const i of c.receta?.ingredientes ?? []) {
      const nombre = normalizar(i.nombre);
      if (!nombre) continue;
      const unidad = i.unidad && UNIDADES_SUMABLES.has(i.unidad) ? i.unidad : 'al gusto';
      const clave = `${nombre}|${unidad}`;
      const cantidad = unidad === 'al gusto' || i.cantidad === null ? null : i.cantidad * ((c.factor || 1) + otros);
      const previo = mapa.get(clave);
      if (previo) {
        previo.platos += 1;
        if (cantidad !== null) previo.cantidad = (previo.cantidad ?? 0) + cantidad;
      } else {
        mapa.set(clave, {
          clave,
          nombre: mayuscula(i.nombre.trim()),
          cantidad,
          unidad,
          seccion: SECCIONES.some((s) => s.clave === i.seccion) ? (i.seccion as string) : 'despensa',
          platos: 1,
        });
      }
    }
  }
  return [...mapa.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

// Cantidad para comprar: se redondea hacia arriba (no se compra medio huevo).
export function cantidadCompra(a: Articulo): string {
  if (a.cantidad === null) return '';
  const v = a.cantidad;
  if (a.unidad === 'g' || a.unidad === 'ml') {
    if (v >= 1000) return `${(Math.ceil(v / 50) * 50 / 1000).toLocaleString('es-ES', { maximumFractionDigits: 2 })} ${a.unidad === 'g' ? 'kg' : 'l'}`;
    return `${v >= 50 ? Math.ceil(v / 10) * 10 : Math.ceil(v)} ${a.unidad}`;
  }
  if (a.unidad === 'ud') {
    const n = Math.ceil(v - 0.15);
    return `${Math.max(1, n)} ${n === 1 ? 'unidad' : 'unidades'}`;
  }
  if (a.unidad === 'pizca') return '';
  return `${Math.ceil(v)} ${a.unidad}`;
}
