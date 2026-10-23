// Perfil de la persona, comprobaciones de seguridad y energía diaria (comunes a todas las funciones).
// Seguridad (no negociable, ver CLAUDE.md): solo mayores de 18, con consentimiento de datos de salud
// y sin situaciones que requieran un profesional.
import { cobrarA, gastoEur, motivoSinExtras } from './costes.ts';
import { planDe, presupuestoPruebaEur, recetasPrueba, respuestaSuscripcion } from './plan.ts';
import { fallo, type Cliente } from './http.ts';
import { AJUSTES_POR_DEFECTO, edadEn, energiaDiaria, type Actividad, type Ajustes, type Energia, type Objetivo, type Sexo } from './nutricion.ts';
import type { Nivel } from './recetas.ts';

export interface Perfil {
  id: string;
  fecha_nacimiento: string | null;
  sexo: Sexo | null;
  altura_cm: number | null;
  peso_inicial_kg: number | null;
  objetivo: Objetivo | null;
  peso_objetivo_kg: number | null;
  actividad: Actividad | null;
  nivel_cocina: Nivel | null;
  comidas_dia: number | null;
  alergias: string[] | null;
  condiciones: string[] | null;
  no_me_gusta: string[] | null;
  consentimiento_salud_at: string | null;
  num_peques: number | null;
  franjas_peques: string[] | null;
  encuesta_completada_at: string | null;
}

export type PerfilValido = Perfil & { sexo: Sexo; altura_cm: number; peso_inicial_kg: number; objetivo: Objetivo; actividad: Actividad; fecha_nacimiento: string };

// Devuelve el perfil si se puede preparar comida para esta persona, o la respuesta de error.
export async function perfilSeguro(admin: Cliente, userId: string, hoy: string): Promise<{ perfil: PerfilValido } | { respuesta: Response }> {
  const { data, error } = await admin.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) throw error;
  const perfil = data as Perfil | null;
  if (!perfil?.encuesta_completada_at || !perfil.sexo || !perfil.altura_cm || !perfil.peso_inicial_kg || !perfil.objetivo || !perfil.actividad) {
    return { respuesta: fallo(409, 'sin_encuesta', 'Completa la encuesta para que podamos preparar tu menú.') };
  }
  if (!perfil.consentimiento_salud_at) {
    return { respuesta: fallo(403, 'sin_consentimiento', 'Necesitamos tu permiso para usar tus datos de salud antes de preparar tu menú.') };
  }
  if (!perfil.fecha_nacimiento || edadEn(perfil.fecha_nacimiento, hoy) < 18) {
    return { respuesta: fallo(403, 'menor', 'Yococino es solo para mayores de 18 años.') };
  }
  if ((perfil.condiciones ?? []).length > 0) {
    return { respuesta: fallo(403, 'profesional', 'En tu caso, lo mejor es que un dietista-nutricionista o tu médico preparen tu pauta.') };
  }
  return { perfil: perfil as PerfilValido };
}

// Energía diaria con el peso más reciente de la persona de la cuenta y los límites de ajustes_nutricion.
export async function energiaDe(admin: Cliente, perfil: PerfilValido, hoy: string): Promise<Energia> {
  const { data: ultimoPeso } = await admin
    .from('pesos')
    .select('peso_kg')
    .eq('user_id', perfil.id)
    .is('miembro_id', null)
    .order('fecha', { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: fila } = await admin.from('ajustes_nutricion').select('*').maybeSingle();
  const ajustes: Ajustes = {
    kcal_minimo_mujer: Number(fila?.kcal_minimo_mujer) || AJUSTES_POR_DEFECTO.kcal_minimo_mujer,
    kcal_minimo_hombre: Number(fila?.kcal_minimo_hombre) || AJUSTES_POR_DEFECTO.kcal_minimo_hombre,
    deficit_pct: Number(fila?.deficit_pct) || AJUSTES_POR_DEFECTO.deficit_pct,
    deficit_max_kcal: Number(fila?.deficit_max_kcal) || AJUSTES_POR_DEFECTO.deficit_max_kcal,
    superavit_pct: Number(fila?.superavit_pct) || AJUSTES_POR_DEFECTO.superavit_pct,
  };
  return energiaDiaria(
    {
      sexo: perfil.sexo,
      edad: edadEn(perfil.fecha_nacimiento, hoy),
      alturaCm: Number(perfil.altura_cm),
      pesoKg: Number(ultimoPeso?.peso_kg ?? perfil.peso_inicial_kg),
      pesoObjetivoKg: perfil.peso_objetivo_kg === null ? null : Number(perfil.peso_objetivo_kg),
      objetivo: perfil.objetivo,
      actividad: perfil.actividad,
    },
    ajustes,
  );
}

// ¿Puede usar ahora una función extra con IA? Comprueba el plan (prueba o suscripción), el límite diario
// de usos y el presupuesto (ver costes.ts). Deja apuntado que lo que se gaste en esta petición es de esta persona.
// Devuelve null si puede, o la respuesta de error para la persona si no.
// `enPrueba: false` = esa función no está incluida en la prueba gratis (por ejemplo, fotos nuevas).
export async function permitirExtra(
  admin: Cliente,
  userId: string,
  tipo: string,
  maximoDia: number,
  opciones: { enPrueba?: boolean; creaReceta?: boolean } = {},
): Promise<Response | null> {
  cobrarA(userId, tipo);
  const plan = await planDe(admin, userId);
  if (plan.estado === 'caducada') return respuestaSuscripcion();
  if (plan.estado === 'prueba') {
    if (opciones.enPrueba === false) return fallo(402, 'suscripcion', 'Esta función está incluida en la suscripción.');
    if ((await gastoEur(admin, userId, 3650)) >= (await presupuestoPruebaEur(admin))) {
      return fallo(402, 'suscripcion', 'Durante la prueba gratis ya has usado todas las funciones con IA. Suscríbete para seguir disfrutándolas.');
    }
    // En la prueba se usan las recetas que ya existen; platos nuevos, solo unos pocos (ajustes_planes.recetas_prueba).
    if (opciones.creaReceta) {
      const [{ data: p }, maximo] = await Promise.all([
        admin.from('pruebas').select('recetas_nuevas').eq('user_id', userId).maybeSingle(),
        recetasPrueba(admin),
      ]);
      if ((Number(p?.recetas_nuevas) || 0) >= maximo) {
        return fallo(
          402,
          'suscripcion',
          `Durante la prueba gratis puedes crear hasta ${maximo} platos nuevos y ya los has usado. Suscríbete para seguir creando platos a tu gusto.`,
        );
      }
    }
  }
  const desde = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await admin.from('usos_ia').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('tipo', tipo).gte('created_at', desde);
  if ((count ?? 0) >= maximoDia) return fallo(429, 'limite', 'Hoy ya has usado mucho esta función. Mañana podrás volver a usarla.');
  const motivo = await motivoSinExtras(admin, userId);
  return motivo ? fallo(429, 'limite', motivo) : null;
}

// Apunta un plato nuevo creado durante la prueba gratis (para el máximo de la prueba).
export async function apuntarRecetaNueva(admin: Cliente, userId: string): Promise<void> {
  if ((await planDe(admin, userId)).estado !== 'prueba') return;
  await admin.from('pruebas').upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true });
  const { error } = await admin.rpc('sumar_receta_prueba', { p_user: userId });
  if (error) console.error('no se apuntó la receta de la prueba:', error.message);
}
