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

// Máximo de platos nuevos que se pueden crear durante la prueba gratis (por defecto 10).
export async function recetasPrueba(admin: Cliente): Promise<number> {
  const { data } = await admin.from('ajustes_planes').select('recetas_prueba').eq('id', 1).maybeSingle();
  const n = Number(data?.recetas_prueba);
  return Number.isFinite(n) && n >= 0 ? n : 10;
}

// Los administradores (el dueño) no tienen límites de uso ni de presupuesto en su cuenta.
export async function esAdministrador(admin: Cliente, userId: string): Promise<boolean> {
  const { data } = await admin.from('admins').select('user_id').eq('user_id', userId).maybeSingle();
  return !!data;
}

// Peques es un complemento de pago (plan «Premium + Peques»). Lo tienen: los administradores, todos si los planes
// están desactivados, quien está en la prueba gratis (para probarlo) y quien paga un plan con Peques.
export async function tienePeques(admin: Cliente, userId: string, estado: EstadoPlan): Promise<boolean> {
  if (estado === 'prueba') return true;
  if (await esAdministrador(admin, userId)) return true;
  const { data: ajustes } = await admin.from('ajustes_planes').select('planes_activos').eq('id', 1).maybeSingle();
  if (ajustes && ajustes.planes_activos === false) return true;
  const { data } = await admin.from('suscripciones').select('peques, activa_hasta').eq('user_id', userId).maybeSingle();
  return !!data?.peques && !!data.activa_hasta && Date.parse(data.activa_hasta as string) > Date.now();
}

export const respuestaSinPeques = () =>
  fallo(402, 'sin_peques', 'La versión Peques es un complemento de tu suscripción (+0,99 € al mes o +9,99 € al año). Puedes añadirlo en Suscripción.');
