// Cálculos del progreso. Se prioriza la tendencia semanal frente al peso de un día.
import type { Peso } from './api';

const ms = (f: string) => new Date(`${f}T12:00:00`).getTime();
const DIA = 864e5;

// Media de los registros de los 7 días anteriores a cada uno: suaviza las subidas puntuales.
export function tendencia(pesos: Peso[]): { fecha: string; valor: number }[] {
  return pesos.map((p) => {
    const t = ms(p.fecha);
    const ventana = pesos.filter((x) => ms(x.fecha) <= t && ms(x.fecha) > t - 7 * DIA);
    return { fecha: p.fecha, valor: ventana.reduce((s, x) => s + x.peso_kg, 0) / ventana.length };
  });
}

export function mediasSemanales(pesos: Peso[]): { lunes: string; media: number }[] {
  const grupos = new Map<string, number[]>();
  for (const p of pesos) {
    const d = new Date(`${p.fecha}T12:00:00`);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const lunes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    grupos.set(lunes, [...(grupos.get(lunes) ?? []), p.peso_kg]);
  }
  return [...grupos.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([lunes, v]) => ({ lunes, media: v.reduce((s, x) => s + x, 0) / v.length }));
}

export interface Resumen {
  actual: number | null;
  inicial: number | null;
  objetivo: number | null;
  perdido: number;
  restante: number | null;
  porcentaje: number | null;
  mensaje: string | null;
}

export function resumen(pesos: Peso[], inicial: number | null, objetivo: number | null, quiereBajar: boolean): Resumen {
  const actual = pesos.length ? pesos[pesos.length - 1].peso_kg : inicial;
  const perdido = inicial !== null && actual !== null ? inicial - actual : 0;
  const restante = quiereBajar && objetivo !== null && actual !== null ? Math.max(0, actual - objetivo) : null;
  const total = quiereBajar && objetivo !== null && inicial !== null ? inicial - objetivo : null;
  const porcentaje = total && total > 0 ? Math.min(100, Math.max(0, (perdido / total) * 100)) : null;

  const semanas = mediasSemanales(pesos);
  let mensaje: string | null = null;
  if (pesos.length === 1) mensaje = 'Primer registro guardado. Pésate una vez por semana, a la misma hora.';
  if (semanas.length >= 2) {
    const dif = semanas[semanas.length - 1].media - semanas[semanas.length - 2].media;
    if (!quiereBajar) mensaje = Math.abs(dif) < 0.3 ? 'Tu peso se mantiene estable.' : 'Pequeñas variaciones de peso son normales.';
    else if (dif < -0.05) mensaje = `Tu media semanal baja ${Math.abs(dif).toLocaleString('es-ES', { maximumFractionDigits: 1 })} kg. ¡Sigue así!`;
    else if (dif <= 0.2) mensaje = 'Semana estable. La constancia también es progreso.';
    else mensaje = 'Una semana no marca el camino: lo importante es la tendencia.';
  } else if (pesos.length >= 2) {
    const dif = pesos[pesos.length - 1].peso_kg - pesos[pesos.length - 2].peso_kg;
    if (quiereBajar && dif > 0) mensaje = 'Las subidas de un día son normales: cuenta la tendencia semanal.';
  }
  return { actual, inicial, objetivo, perdido, restante, porcentaje, mensaje };
}

export const kg = (n: number | null | undefined, decimales = 1) =>
  n === null || n === undefined ? '–' : n.toLocaleString('es-ES', { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
