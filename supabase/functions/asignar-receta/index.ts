// asignar-receta: pone una receta en una comida concreta del menú (día y toma), con la ración de la persona.
// Solo de hoy en adelante, en días ya preparados, y solo si la receta es apta para sus alergias y gustos.
import { motivosNoApta, restriccionesDe } from '../_shared/alergenos.ts';
import { crearClientes, fallo, hoyEspana, responder, servir, sumarDias } from '../_shared/http.ts';
import { comidasDelDia, factorRacion, KCAL_RACION_ESTANDAR, type TipoComida } from '../_shared/nutricion.ts';
import { energiaDe, perfilSeguro } from '../_shared/perfil.ts';
import { planDe, respuestaSuscripcion } from '../_shared/plan.ts';

async function asignar(req: Request): Promise<Response> {
  const { usuario, admin } = crearClientes(req);
  const { data: auth } = await usuario.auth.getUser();
  const user = auth?.user;
  if (!user) return fallo(401, 'no_autenticado', 'Vuelve a entrar en tu cuenta.');

  const cuerpo = (await req.json().catch(() => ({}))) as { receta_id?: number; fecha?: string; tipo_comida?: string };
  const recetaId = Number(cuerpo.receta_id);
  const fecha = String(cuerpo.fecha ?? '');
  const tipo = String(cuerpo.tipo_comida ?? '') as TipoComida;
  const hoy = hoyEspana();
  if (!Number.isInteger(recetaId) || recetaId <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return fallo(400, 'datos', 'Faltan datos.');
  if (fecha < hoy || fecha > sumarDias(hoy, 29)) return fallo(400, 'fecha', 'Elige un día entre hoy y dentro de 30 días.');

  const plan = await planDe(admin, user.id);
  if (plan.estado === 'caducada') return respuestaSuscripcion();
  if (plan.estado === 'prueba' && plan.finPrueba && fecha > plan.finPrueba) {
    return fallo(402, 'suscripcion', 'En la prueba gratis tu menú es de 7 días. Suscríbete para planificar el mes entero.');
  }

  const seguro = await perfilSeguro(admin, user.id, hoy);
  if ('respuesta' in seguro) return seguro.respuesta;
  const perfil = seguro.perfil;
  const tomas = comidasDelDia(perfil.comidas_dia ?? 5);
  const toma = tomas.find((t) => t.tipo === tipo);
  if (!toma) return fallo(400, 'datos', 'Esa comida no está en tu plan.');

  const { data: receta, error } = await admin
    .from('recetas')
    .select('id, nombre, kcal, alergenos, privada_de, ingredientes(nombre, nota)')
    .eq('id', recetaId)
    .maybeSingle();
  if (error) throw error;
  // Las recetas privadas (guardadas de redes) solo las puede usar su dueño.
  if (!receta || (receta.privada_de && receta.privada_de !== user.id)) return fallo(404, 'no_encontrada', 'No encontramos esa receta.');
  const restr = restriccionesDe(perfil.alergias ?? [], perfil.no_me_gusta ?? []);
  const motivos = motivosNoApta(
    { nombre: receta.nombre, alergenos: (receta.alergenos as string[] | null) ?? [], ingredientes: (receta.ingredientes ?? []) as { nombre: string; nota: string | null }[] },
    restr,
  );
  if (motivos.length) return fallo(422, 'no_apta', 'Esta receta no encaja con tus alergias o con lo que no te gusta.');

  const { data: comida } = await admin
    .from('comidas')
    .select('id')
    .eq('user_id', user.id)
    .eq('fecha', fecha)
    .eq('tipo_comida', tipo)
    .maybeSingle();
  if (!comida) return fallo(409, 'sin_dia', 'Ese día todavía se está preparando. Prueba en un momento.');

  const energia = await energiaDe(admin, perfil, hoy);
  const kcalReceta = (receta.kcal as number | null) ?? KCAL_RACION_ESTANDAR[tipo];
  const factor = factorRacion(energia.kcal * toma.parte, kcalReceta);
  const { error: errorComida } = await admin
    .from('comidas')
    .update({ receta_id: receta.id, factor, kcal: Math.round(kcalReceta * factor), hecha: false, hecha_at: null })
    .eq('id', comida.id)
    .eq('user_id', user.id);
  if (errorComida) throw errorComida;
  return responder({ ok: true, comida_id: comida.id });
}

servir('asignar-receta', asignar, 'No hemos podido añadir la receta a tu menú. Vuelve a intentarlo en un momento.');
