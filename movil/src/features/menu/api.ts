// Lectura y escritura del menú en Supabase.
import { FunctionsHttpError } from '@supabase/supabase-js';
import { router } from 'expo-router';
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
  plan?: 'premium' | 'prueba' | 'caducada';
  fin_prueba?: string | null;
}

// Llama a una función del servidor y convierte sus errores en mensajes para la persona.
async function llamar<T>(nombre: string, body: Record<string, unknown>, porDefecto: string): Promise<T> {
  const { data, error } = await supabase.functions.invoke(nombre, { body });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const cuerpo = await error.context.json().catch(() => null);
      // Fuera de la prueba gratis: salta la pantalla de suscripción.
      if (cuerpo?.error === 'suscripcion') router.push('/suscripcion');
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
  especial?: string | null; // «🎄 Especial Navidad»
  aviso?: string | null; // «Tiene alto contenido en azúcar.»
}

// Recetario: solo devuelve recetas aptas para la persona.
export const buscarRecetas = (texto: string, tipo: string | null, categoria: string | null = null, sub: string | null = null) =>
  llamar<{ recetas: RecetaResumen[] }>('buscar-recetas', { texto, tipo, categoria, sub }, 'No hemos podido buscar recetas.').then((r) => r.recetas);

// Pone una receta en un día y una comida del menú.
export const asignarReceta = (recetaId: number, fecha: string, tipoComida: string) =>
  llamar<{ comida_id: number }>('asignar-receta', { receta_id: recetaId, fecha, tipo_comida: tipoComida }, 'No hemos podido añadirla a tu menú.');

// Administración: ¿es el dueño? y carga inicial del recetario por tandas.
export async function esAdmin(): Promise<boolean> {
  const { data } = await supabase.from('admins').select('user_id').maybeSingle();
  return !!data;
}
export interface LoteIA {
  id: number;
  tipo: 'recetas' | 'fotos';
  estado: 'enviado' | 'terminado' | 'fallido';
  cantidad: number;
  resultado: { creadas?: number; descartadas?: number; guardadas?: number; fallidas?: number; coste_usd?: number; cancelado?: boolean } | null;
  created_at: string;
  terminado_at: string | null;
}
export interface EstadoLotes {
  lotes: LoteIA[];
  cupo: { tope: number; usadas: number; quedan: number };
  enviadas?: number;
  aviso?: string;
  errores?: string[];
}
// Carga del recetario y fotos por lotes a mitad de precio (solo administradores).
export const sembrarRecetas = (accion: 'estado' | 'enviar' | 'fotos' | 'tipicas' | 'airfryer' | 'notas_airfryer', cantidad?: number) =>
  llamar<EstadoLotes>('sembrar-recetas', { accion, cantidad }, 'No se ha podido completar.');

// Crea una receta con lo que hay en casa.
export interface SugerenciaCocinar {
  id: number;
  nombre: string;
  minutos: number | null;
  kcal: number | null;
  imagen: string | null;
  coinciden: string[];
  faltan: string[];
}
// Primero devuelve recetas que ya existen con esos ingredientes (sugerencias); con `nueva`, crea una receta nueva.
export const cocinarCon = (ingredientes: string[], tipo: string, nueva = false) =>
  llamar<{ receta_id?: number; nombre?: string; descartados: string[]; sugerencias?: SugerenciaCocinar[] }>(
    'cocinar-con',
    { ingredientes, tipo, nueva },
    'No hemos podido crear la receta.',
  );

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

// ---------- Mis recetas: guardadas desde redes sociales ----------
export interface ResultadoImportar {
  receta_id: number;
  nombre: string;
  publica: boolean;
  aviso: string | null;
  no_apta: string | null;
}
export const importarReceta = (url: string, descripcion?: string) =>
  llamar<ResultadoImportar>('importar-receta', { url, descripcion }, 'No hemos podido guardar esa receta. Vuelve a intentarlo en un momento.');

export interface MiReceta extends RecetaResumen {
  origen_url: string | null;
  avisos: string[];
  guardada_el: string;
}
export async function cargarMisRecetas(): Promise<MiReceta[]> {
  const { data, error } = await supabase
    .from('mis_recetas')
    .select('origen_url, avisos, created_at, receta:recetas(id, nombre, descripcion, tipo_comida, nivel, minutos, kcal, imagen, imagen_mini)')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw new ErrorMenu('No hemos podido cargar tus recetas.', 'servidor');
  return ((data ?? []) as unknown as { origen_url: string | null; avisos: string[] | null; created_at: string; receta: RecetaResumen | null }[])
    .filter((f) => f.receta)
    .map((f) => ({ ...(f.receta as RecetaResumen), origen_url: f.origen_url, avisos: f.avisos ?? [], guardada_el: f.created_at }));
}
export async function quitarMiReceta(recetaId: number) {
  const { error } = await supabase.from('mis_recetas').delete().eq('receta_id', recetaId);
  if (error) throw new ErrorMenu('No hemos podido quitarla. Inténtalo de nuevo.', 'servidor');
}
// Avisos de una receta guardada por la persona (para enseñarlos al abrirla).
export async function avisosDeMiReceta(recetaId: number): Promise<{ avisos: string[]; origen_url: string | null } | null> {
  const { data } = await supabase.from('mis_recetas').select('avisos, origen_url').eq('receta_id', recetaId).maybeSingle();
  return data ? { avisos: (data.avisos as string[] | null) ?? [], origen_url: (data.origen_url as string | null) ?? null } : null;
}

// "Tiene alto contenido en grasas y azúcar." (igual que en el servidor).
export function textoAvisos(avisos: string[]): string | null {
  if (!avisos.length) return null;
  const calorias = avisos.includes('muchas calorías');
  const resto = avisos.filter((a) => a !== 'muchas calorías');
  const lista = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`);
  if (calorias && resto.length) return `Tiene muchas calorías y alto contenido en ${lista(resto)}.`;
  if (calorias) return 'Tiene muchas calorías.';
  return `Tiene alto contenido en ${lista(resto)}.`;
}

// «Cuéntanos cómo te gusta comer»: guarda lo escrito y cambia solo los platos afectados.
export interface ResultadoPreferencias {
  entendido: string[];
  ignorado: string[];
  quitadas: number;
  cambiadas?: string[];
}
export const guardarComoComes = (texto: string) =>
  llamar<ResultadoPreferencias>('preferencias', { texto }, 'No hemos podido guardar tus preferencias.');

// Especial de temporada (Halloween, Navidad, verano…): no entra en el menú; sale en Inicio y en el recetario.
export interface Especial {
  clave: string;
  titulo: string;
  emoji: string;
  descripcion: string;
  desde?: string;
  hasta?: string;
}
export interface RecetaEspecial {
  id: number;
  nombre: string;
  descripcion: string | null;
  tipo_comida: string;
  minutos: number | null;
  kcal: number | null;
  imagen: string | null;
  imagen_mini: string | null;
  aviso: string | null;
}
export const cargarEspecial = (clave?: string, limite?: number) =>
  llamar<{ especial: Especial | null; recetas: RecetaEspecial[] }>('especiales', { clave, limite }, 'No hemos podido cargar las recetas especiales.');
