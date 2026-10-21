// Guarda la encuesta en el perfil del usuario.
// Si el usuario aún no ha confirmado su email, la encuesta espera guardada en el móvil
// y se sube automáticamente la primera vez que entra.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fechaISO, numero, type Encuesta } from '../features/encuesta/modelo';
import { supabase } from './supabase';

const CLAVE = 'yococino:encuesta-pendiente';

export async function dejarEncuestaPendiente(e: Encuesta, consentimientoSalud: boolean) {
  await AsyncStorage.setItem(CLAVE, JSON.stringify({ e, consentimientoSalud, at: new Date().toISOString() }));
}

export function aPerfil(e: Encuesta, consentimientoAt: string | null) {
  return {
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
  const { e, consentimientoSalud, at } = JSON.parse(texto) as { e: Encuesta; consentimientoSalud: boolean; at: string };
  const { error } = await supabase
    .from('profiles')
    .upsert({ id: userId, ...aPerfil(e, consentimientoSalud ? at : null) });
  if (error) throw error;
  await AsyncStorage.removeItem(CLAVE);
}
