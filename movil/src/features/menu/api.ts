// Lectura y escritura del menú en Supabase.
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import type { Comida, Receta } from './tipos';

export class ErrorMenu extends Error {
  readonly codigo: string;
  readonly detalle?: string;
  constructor(mensaje: string, codigo: string, detalle?: string) {
    super(mensaje);
    this.codigo = codigo;
    this.detalle = detalle;
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

// Llama a una función del servidor y convierte sus errores en mensajes para la persona.
async function llamar<T>(nombre: string, body: Record<string, unknown>, porDefecto: string): Promise<T> {
  const { data, error } = await supabase.functions.invoke(nombre, { body });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const cuerpo = await error.context.json().catch(() => null);
      throw new ErrorMenu(cuerpo?.mensaje ?? porDefecto, cuerpo?.error ?? 'servidor', cuerpo?.detalle);
    }
    throw new ErrorMenu('No hay conexión con el servidor. Revisa tu Internet.', 'red');
  }
  return data as T;
}

// Pide al servidor que prepare los siguientes días del menú.
export const prepararMenu = (dias: number) => llamar<ResultadoPreparar>('preparar-menu', { dias }, 'No hemos podido preparar tu menú.');

// Cambia una comida por otra receta apta. `nueva` pide un plato recién creado en vez de uno del catálogo.
export const cambiarPlato = (comidaId: number, nueva = false) =>
  llamar<{ receta_id: number; nombre: string }>('cambiar-plato', { comida_id: comidaId, nueva }, 'No hemos podido cambiar el plato.');

// Rehace la receta cambiando un ingrediente. Con comidaId, esa comida del menú pasa a usar la receta nueva.
export const cambiarIngrediente = (recetaId: number, ingrediente: string, por: string, comidaId: number | null) =>
  llamar<{ receta_id: number; nombre: string }>(
    'cambiar-ingrediente',
    { receta_id: recetaId, ingrediente, por, comida_id: comidaId },
    'No hemos podido adaptar la receta.',
  );

// Crea una receta con lo que hay en casa.
export const cocinarCon = (ingredientes: string[], tipo: string) =>
  llamar<{ receta_id: number; nombre: string; descartados: string[] }>('cocinar-con', { ingredientes, tipo }, 'No hemos podido crear la receta.');

export interface VersionPeques {
  resumen: string;
  cambios: string[];
  por_edad: { franja: '1-3' | '4-8' | '9-13' | '14-17'; consejo: string }[];
  presentacion: string[];
  alternativas: { nombre: string; descripcion: string; ingredientes: string[] }[];
  seguridad: string[];
}

export const versionPeques = (recetaId: number) =>
  llamar<{ peques: VersionPeques }>('version-peques', { receta_id: recetaId }, 'No hemos podido preparar la versión Peques.').then((r) => r.peques);

export async function perfilBasico(userId: string) {
  const { data } = await supabase.from('profiles').select('encuesta_completada_at, kcal_dia, nombre').eq('id', userId).maybeSingle();
  return data as { encuesta_completada_at: string | null; kcal_dia: number | null; nombre: string | null } | null;
}
