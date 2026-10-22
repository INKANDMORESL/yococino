// Mensajes con el equipo de Yococino (se responden desde el panel de gestión).
import { supabase } from '../../lib/supabase';

export interface Mensaje {
  id: number;
  de: 'cliente' | 'equipo';
  texto: string;
  created_at: string;
  leido_at: string | null;
}

export async function cargarMensajes(): Promise<Mensaje[]> {
  const { data, error } = await supabase.from('mensajes').select('id, de, texto, created_at, leido_at').order('created_at').limit(200);
  if (error) throw new Error('No hemos podido cargar tus mensajes.');
  return (data ?? []) as Mensaje[];
}

export async function enviarMensaje(userId: string, texto: string) {
  const { error } = await supabase.from('mensajes').insert({ user_id: userId, de: 'cliente', texto: texto.trim().slice(0, 2000) });
  if (error) throw new Error(/muchos mensajes/i.test(error.message) ? 'Has enviado muchos mensajes hoy. Te responderemos pronto.' : 'No se ha podido enviar. Revisa tu conexión.');
}

export async function marcarLeidos() {
  await supabase.from('mensajes').update({ leido_at: new Date().toISOString() }).eq('de', 'equipo').is('leido_at', null);
}

export async function respuestasSinLeer(): Promise<number> {
  const { count } = await supabase.from('mensajes').select('id', { count: 'exact', head: true }).eq('de', 'equipo').is('leido_at', null);
  return count ?? 0;
}
