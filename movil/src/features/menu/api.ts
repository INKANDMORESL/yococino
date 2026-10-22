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
    .select('id, fecha, orden, tipo_comida, receta_id, factor, kcal, hecha, receta:recetas(id, nombre, minutos, descripcion, imagen, imagen_mini)')
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

// Foto del plato (la genera o aligera el servidor la primera vez). Ver fotos.ts para la cola y la caché.
export interface FotoReceta {
  imagen: string | null;
  imagen_mini: string | null;
  desactivadas?: boolean;
}
export async function fotoReceta(recetaId: number): Promise<FotoReceta> {
  const { data, error } = await supabase.functions.invoke('foto-receta', { body: { receta_id: recetaId } });
  if (error) {
    const cuerpo = error instanceof FunctionsHttpError ? await error.context.json().catch(() => null) : null;
    return { imagen: null, imagen_mini: null, desactivadas: cuerpo?.error === 'foto_no_configurada' };
  }
  const d = (data ?? {}) as { imagen?: string | null; imagen_mini?: string | null };
  return { imagen: d.imagen ?? null, imagen_mini: d.imagen_mini ?? d.imagen ?? null };
}

export interface RecetaResumen {
  id: number;
  nombre: string;
  descripcion: string | null;
  tipo_comida: string;
  nivel: 'facil' | 'medio' | 'elaborado';
  minutos: number | null;
  kcal: number | null;
  imagen: string | null;
  imagen_mini?: string | null;
}

// Recetario: solo devuelve recetas aptas para la persona.
export const buscarRecetas = (texto: string, tipo: string | null) =>
  llamar<{ recetas: RecetaResumen[] }>('buscar-recetas', { texto, tipo }, 'No hemos podido buscar recetas.').then((r) => r.recetas);

// Pone una receta en un día y una comida del menú.
export const asignarReceta = (recetaId: number, fecha: string, tipoComida: string) =>
  llamar<{ comida_id: number }>('asignar-receta', { receta_id: recetaId, fecha, tipo_comida: tipoComida }, 'No hemos podido añadirla a tu menú.');

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
