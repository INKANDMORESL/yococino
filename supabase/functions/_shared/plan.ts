// Plan de cada persona: premium, prueba (7 días) o prueba caducada. Ver migración "prueba".
// Durante la prueba: menú solo de 7 días hecho con recetas existentes, sin fotos nuevas, y las funciones
// con IA (cocina con lo que tienes, cambiar ingrediente, plato nuevo, Peques) con un tope pequeño de gasto.
import { fallo, type Cliente } from './http.ts';

export type EstadoPlan = 'premium' | 'prueba' | 'caducada';

export async function planDe(admin: Cliente, userId: string): Promise<{ estado: EstadoPlan; finPrueba: string | null }> {
  const { data, error } = await admin.rpc('estado_plan', { p_user: userId });
  if (error) throw error;
  const fila = (Array.isArray(data) ? data[0] : data) as { estado: EstadoPlan; fin_prueba: string | null } | null;
  return { estado: fila?.estado ?? 'prueba', finPrueba: fila?.fin_prueba ?? null };
}

// Apunta el comienzo de la prueba (solo la primera vez) y devuelve su último día.
export async function empezarPrueba(admin: Cliente, userId: string): Promise<string | null> {
  await admin.from('pruebas').upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true });
  return (await planDe(admin, userId)).finPrueba;
}

export const respuestaSuscripcion = () =>
  fallo(402, 'suscripcion', 'Tu prueba gratis ha terminado. Suscríbete para seguir usando Yococino.');

export async function presupuestoPruebaEur(admin: Cliente): Promise<number> {
  const { data } = await admin.from('ajustes_planes').select('presupuesto_prueba_eur').eq('id', 1).maybeSingle();
  return Number(data?.presupuesto_prueba_eur) || 0.5;
}
