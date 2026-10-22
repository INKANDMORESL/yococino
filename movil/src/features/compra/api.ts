import { supabase } from '../../lib/supabase';
import type { ComidaConIngredientes } from './lista';

export async function cargarIngredientes(desde: string, hasta: string): Promise<ComidaConIngredientes[]> {
  const { data, error } = await supabase
    .from('comidas')
    .select('factor, receta:recetas(ingredientes(nombre, cantidad, unidad, seccion))')
    .gte('fecha', desde)
    .lte('fecha', hasta);
  if (error) throw new Error('No hemos podido cargar la lista de la compra.');
  return (data ?? []) as unknown as ComidaConIngredientes[];
}

export async function cargarMarcas(): Promise<Set<string>> {
  const { data } = await supabase.from('compra_marcas').select('clave').eq('marcado', true);
  return new Set((data ?? []).map((m: { clave: string }) => m.clave));
}

export async function guardarMarca(userId: string, clave: string, marcado: boolean) {
  const { error } = marcado
    ? await supabase.from('compra_marcas').upsert({ user_id: userId, clave, marcado: true, updated_at: new Date().toISOString() })
    : await supabase.from('compra_marcas').delete().eq('clave', clave);
  if (error) throw new Error('No se ha podido guardar. Revisa tu conexión.');
}

export async function borrarMarcas() {
  const { error } = await supabase.from('compra_marcas').delete().neq('clave', '');
  if (error) throw new Error('No se ha podido vaciar la lista.');
}
