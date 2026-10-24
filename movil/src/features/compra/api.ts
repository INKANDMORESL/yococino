import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../lib/supabase';
import type { ComidaConIngredientes, Comensales } from './lista';

export async function cargarIngredientes(desde: string, hasta: string): Promise<ComidaConIngredientes[]> {
  const { data, error } = await supabase
    .from('comidas')
    .select('id, fecha, tipo_comida, factor, receta:recetas(id, nombre, ingredientes(nombre, cantidad, unidad, seccion))')
    .gte('fecha', desde)
    .lte('fecha', hasta)
    .order('fecha');
  if (error) throw new Error('No hemos podido cargar la lista de la compra.');
  return (data ?? []) as unknown as ComidaConIngredientes[];
}

export async function cargarComensales(): Promise<Comensales> {
  const { data } = await supabase.from('profiles').select('compra_adultos, compra_peques, num_peques').maybeSingle();
  return {
    adultos: Number(data?.compra_adultos) || 1,
    peques: data?.compra_peques ?? (Number(data?.num_peques) || 0),
  };
}

export async function guardarComensales(userId: string, c: Comensales) {
  const { error } = await supabase.from('profiles').update({ compra_adultos: c.adultos, compra_peques: c.peques }).eq('id', userId);
  if (error) throw new Error('No se ha podido guardar. Revisa tu conexión.');
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

// Comidas que la persona ha quitado de la lista de la compra (se guardan en el móvil).
const CLAVE_FUERA = 'yococino:compra-fuera';
export async function cargarFuera(): Promise<Set<number>> {
  try {
    const t = await AsyncStorage.getItem(CLAVE_FUERA);
    return new Set(t ? (JSON.parse(t) as number[]) : []);
  } catch {
    return new Set();
  }
}
export async function guardarFuera(ids: Set<number>) {
  try {
    await AsyncStorage.setItem(CLAVE_FUERA, JSON.stringify([...ids].slice(-500)));
  } catch {
    // Si no se puede guardar, el filtro vale solo mientras la app está abierta.
  }
}
