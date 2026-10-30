// Recetas que la persona ha denunciado desde la app: dejan de aparecerle en menús, recetario y especiales.
import type { Cliente } from './http.ts';

export async function recetasDenunciadas(admin: Cliente, userId: string): Promise<Set<number>> {
  const { data } = await admin.from('recetas_denuncias').select('receta_id').eq('user_id', userId).limit(1000);
  return new Set((data ?? []).map((d) => Number(d.receta_id)));
}
