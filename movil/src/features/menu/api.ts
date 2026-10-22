// Lectura y escritura del menú en Supabase.
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import type { Comida, Receta } from './tipos';

export class ErrorMenu extends Error {
  readonly codigo: string;
  constructor(mensaje: string, codigo: string) {
    super(mensaje);
    this.codigo = codigo;
  }
}

export async function cargarComidas(desde: string, hasta: string): Promise<Comida[]> {
  const { data, error } = await supabase
    .from('comidas')
    .select('id, fecha, orden, tipo_comida, receta_id, factor, kcal, hecha, receta:recetas(id, nombre, minutos, descripcion)')
    .gte('fecha', desde)
    .lte('fecha', hasta)
    .order('fecha')
    .order('orden');
  if (error) throw new ErrorMenu('No hemos podido cargar tu menú.', 'carga');
  return (data ?? []) as unknown as Comida[];
}

export async function cargarReceta(id: number): Promise<Receta> {
  const { data, error } = await supabase.from('recetas').select('*, ingredientes(*)').eq('id', id).single();
  if (error || !data) throw new ErrorMenu('No hemos podido cargar la receta.', 'carga');
  const r = data as unknown as Receta;
  r.ingredientes = [...(r.ingredientes ?? [])].sort((a, b) => a.orden - b.orden);
  return r;
}

export async function marcarHecha(id: number, hecha: boolean): Promise<void> {
  const { error } = await supabase
    .from('comidas')
    .update({ hecha, hecha_at: hecha ? new Date().toISOString() : null })
    .eq('id', id);
  if (error) throw new ErrorMenu('No se ha podido guardar. Revisa tu conexión.', 'guardar');
}

export interface ResultadoPreparar {
  creados: string[];
  pendientes: number;
  kcal_dia?: number;
}

// Pide al servidor que prepare los siguientes días del menú.
export async function prepararMenu(dias: number): Promise<ResultadoPreparar> {
  const { data, error } = await supabase.functions.invoke('preparar-menu', { body: { dias } });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const cuerpo = await error.context.json().catch(() => null);
      throw new ErrorMenu(cuerpo?.mensaje ?? 'No hemos podido preparar tu menú.', cuerpo?.error ?? 'servidor');
    }
    throw new ErrorMenu('No hay conexión con el servidor. Revisa tu Internet.', 'red');
  }
  return data as ResultadoPreparar;
}

export async function perfilBasico(userId: string) {
  const { data } = await supabase.from('profiles').select('encuesta_completada_at, kcal_dia').eq('id', userId).maybeSingle();
  return data as { encuesta_completada_at: string | null; kcal_dia: number | null } | null;
}
