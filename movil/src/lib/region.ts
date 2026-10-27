// Idioma y país del móvil, para cuando la app esté en otros países. De momento solo se guardan:
// la app sigue en español y con recetas de España para todo el mundo.
import { supabase } from './supabase';

export function regionDelMovil(): { idioma: string; pais: string | null } {
  try {
    const local = Intl.DateTimeFormat().resolvedOptions().locale || 'es-ES'; // p. ej. «es-ES», «en-US»
    const [idioma, pais] = local.replace('_', '-').split('-');
    return { idioma: (idioma || 'es').toLowerCase(), pais: pais && /^[A-Za-z]{2}$/.test(pais) ? pais.toUpperCase() : null };
  } catch {
    return { idioma: 'es', pais: null };
  }
}

let guardado = false;
// Una vez por sesión de la app; si falla (sin conexión, columna aún no creada), no pasa nada.
export async function guardarRegion(userId: string) {
  if (guardado) return;
  guardado = true;
  const { idioma, pais } = regionDelMovil();
  try {
    await supabase.from('profiles').update({ idioma, ...(pais ? { pais } : {}) }).eq('id', userId);
  } catch {
    guardado = false;
  }
}
