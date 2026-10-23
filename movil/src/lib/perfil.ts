// Guarda la encuesta en el perfil del usuario.
// Si el usuario aún no ha confirmado su email, la encuesta espera guardada en el móvil
// y se sube automáticamente la primera vez que entra.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fechaISO, numero, type Encuesta } from '../features/encuesta/modelo';
import { supabase } from './supabase';

const CLAVE = 'yococino:encuesta-pendiente';

export async function dejarEncuestaPendiente(e: Encuesta, consentimientoSalud: boolean, promociones = false) {
  await AsyncStorage.setItem(CLAVE, JSON.stringify({ e, consentimientoSalud, promociones, at: new Date().toISOString() }));
}

export function aPerfil(e: Encuesta, consentimientoAt: string | null) {
  return {
    nombre: e.nombre.trim().slice(0, 40) || null,
    fecha_nacimiento: fechaISO(e.nacimiento),
    sexo: e.sexo,
    altura_cm: numero(e.altura),
    peso_inicial_kg: numero(e.peso),
    objetivo: e.objetivo,
    peso_objetivo_kg: e.objetivo === 'perder' ? numero(e.pesoObjetivo) : null,
    actividad: e.actividad,
    nivel_cocina: e.nivel,
    comidas_dia: e.comidas,
    alergias: e.alergias,
    condiciones: e.condiciones,
    no_me_gusta: e.noMeGusta,
    num_peques: e.hayPeques ? e.numPeques : 0,
    franjas_peques: e.hayPeques ? e.franjasPeques : [],
    consentimiento_salud_at: consentimientoAt,
    encuesta_completada_at: new Date().toISOString(),
  };
}

export async function guardarEncuestaPendiente(userId: string) {
  const texto = await AsyncStorage.getItem(CLAVE);
  if (!texto) return;
  const { e, consentimientoSalud, promociones, at } = JSON.parse(texto) as { e: Encuesta; consentimientoSalud: boolean; promociones?: boolean; at: string };
  const { error } = await supabase
    .from('profiles')
    .upsert({ id: userId, ...aPerfil(e, consentimientoSalud ? at : null), ...(promociones ? { promociones: true, promociones_at: at } : {}) });
  if (error) throw error;
  await AsyncStorage.removeItem(CLAVE);
}

// Guarda la encuesta directamente (cuando la persona ya ha iniciado sesión).
export async function guardarEncuesta(userId: string, e: Encuesta) {
  const { error } = await supabase.from('profiles').upsert({ id: userId, ...aPerfil(e, new Date().toISOString()) });
  if (error) throw error;
}

// Permiso opcional para recibir novedades y promociones por email (se puede dar o retirar en Perfil).
export async function cambiarPromociones(userId: string, si: boolean) {
  const ahora = new Date().toISOString();
  const { error } = await supabase
    .from('profiles')
    .update(si ? { promociones: true, promociones_at: ahora, promociones_baja_at: null } : { promociones: false, promociones_baja_at: ahora })
    .eq('id', userId);
  if (error) throw new Error('No hemos podido guardar tu elección. Inténtalo de nuevo.');
}
