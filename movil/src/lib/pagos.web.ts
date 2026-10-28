// En la versión web no hay pagos de tienda.
import type { Periodo } from '../features/plan/productos';

export const pagosDisponibles = false;
export type ResultadoCompra = 'ok' | 'cancelada' | 'no_disponible' | 'error';
export async function iniciarPagos(_userId: string) {}
export async function cerrarPagos() {}
export async function comprar(_periodo: Periodo, _conPeques: boolean, _planActual?: string | null): Promise<ResultadoCompra> {
  return 'no_disponible';
}
export async function restaurarCompras(): Promise<boolean> {
  return false;
}
export async function gestionarSuscripcion() {}
