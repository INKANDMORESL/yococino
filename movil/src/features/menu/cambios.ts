// Aplica a una receta los ingredientes cambiados desde la lista de la compra ({ merluza: 'rosada' }):
// cambia el nombre del ingrediente (misma cantidad) y también dónde se nombra en los pasos.
import { normalizar } from '../../lib/texto';
import type { Receta } from './tipos';

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function conCambios(receta: Receta, cambios: Record<string, string>): Receta {
  const pares: [string, string][] = [];
  const ingredientes = receta.ingredientes.map((i) => {
    const nuevo = cambios[normalizar(i.nombre)];
    if (!nuevo) return i;
    pares.push([i.nombre, nuevo]);
    return { ...i, nombre: nuevo.charAt(0).toUpperCase() + nuevo.slice(1) };
  });
  const cambiar = (t: string) =>
    pares.reduce((acc, [viejo, nuevo]) => {
      // El nombre completo y, si no aparece, su primera palabra («la merluza» en «Sazona la merluza»).
      const completo = new RegExp(escapar(viejo), 'gi');
      if (completo.test(acc)) return acc.replace(completo, nuevo.toLowerCase());
      const primera = viejo.split(/\s+/)[0];
      return primera.length > 3 ? acc.replace(new RegExp(`\\b${escapar(primera)}\\b`, 'gi'), nuevo.toLowerCase()) : acc;
    }, t);
  return { ...receta, ingredientes, pasos: receta.pasos.map(cambiar), nombre: cambiar(receta.nombre) };
}
