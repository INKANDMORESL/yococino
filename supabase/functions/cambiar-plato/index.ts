// cambiar-plato: cambia una comida del menú (de hoy en adelante) por otra receta apta.
// Primero busca en el catálogo compartido (sin gastar IA); si no hay nada nuevo o la persona
// pide "algo distinto", crea una receta nueva con la IA, con límite diario.
// Mismas reglas de seguridad que preparar-menu: perfil válido, alergias y gustos siempre excluidos.
import { recetasDenunciadas } from '../_shared/denuncias.ts';
import { restriccionesDe } from '../_shared/alergenos.ts';
import { crearClientes, fallo, hoyEspana, responder, servir, sumarDias } from '../_shared/http.ts';
import { comidasDelDia, factorRacion, KCAL_RACION_ESTANDAR, type TipoComida } from '../_shared/nutricion.ts';
import { apuntarRecetaNueva, energiaDe, perfilSeguro, permitirExtra } from '../_shared/perfil.ts';
import { planDe, respuestaSuscripcion } from '../_shared/plan.ts';
import { cargarCatalogo, crearReceta, type Nivel, type RecetaGuardada } from '../_shared/recetas.ts';
import { mesDe } from '../_shared/temporada.ts';

const MAX_NUEVAS_DIA = 15;

async function cambiar(req: Request): Promise<Response> {
  const { usuario, admin } = crearClientes(req);
  const { data: auth } = await usuario.auth.getUser();
  const user = auth?.user;
  if (!user) return fallo(401, 'no_autenticado', 'Vuelve a entrar en tu cuenta.');

  const cuerpo = (await req.json().catch(() => ({}))) as { comida_id?: number; nueva?: boolean };
  const comidaId = Number(cuerpo.comida_id);
  if (!Number.isInteger(comidaId) || comidaId <= 0) return fallo(400, 'datos', 'Falta la comida que quieres cambiar.');
  const hoy = hoyEspana();

  const { data: comida, error: errorComida } = await admin
    .from('comidas')
    .select('id, fecha, tipo_comida, receta_id')
    .eq('id', comidaId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (errorComida) throw errorComida;
  if (!comida) return fallo(404, 'no_encontrada', 'No encontramos esa comida en tu menú.');
  if (comida.fecha < hoy) return fallo(400, 'pasado', 'Solo puedes cambiar comidas de hoy en adelante.');
  const tipo = comida.tipo_comida as TipoComida;
  if ((await planDe(admin, user.id)).estado === 'caducada') return respuestaSuscripcion();

  const seguro = await perfilSeguro(admin, user.id, hoy);
  if ('respuesta' in seguro) return seguro.respuesta;
  const perfil = seguro.perfil;
  const energia = await energiaDe(admin, perfil, hoy);
  const parte = comidasDelDia(perfil.comidas_dia ?? 5).find((c) => c.tipo === tipo)?.parte ?? 0.3;
  const nivel: Nivel = perfil.nivel_cocina ?? 'facil';
  const restr = restriccionesDe(perfil.alergias ?? [], perfil.no_me_gusta ?? [], perfil.aparatos);

  // Platos de los días cercanos: no se proponen otra vez.
  const { data: cercanas } = await admin
    .from('comidas')
    .select('receta_id, receta:recetas(nombre)')
    .eq('user_id', user.id)
    .gte('fecha', sumarDias(comida.fecha, -10))
    .lte('fecha', sumarDias(comida.fecha, 10));
  const filas = (cercanas ?? []) as unknown as { receta_id: number | null; receta: { nombre: string } | null }[];
  const usadas = new Set(filas.map((f) => f.receta_id).filter((x): x is number => x !== null));
  if (comida.receta_id) usadas.add(comida.receta_id);
  const nombresUsados = [...new Set(filas.map((f) => f.receta?.nombre).filter(Boolean))].slice(0, 40) as string[];

  let receta: RecetaGuardada | null = null;
  if (!cuerpo.nueva) {
    const candidatas = (await cargarCatalogo(admin, [tipo], nivel, restr, mesDe(comida.fecha), 30, await recetasDenunciadas(admin, user.id))).filter((r) => !usadas.has(r.id));
    if (candidatas.length) receta = candidatas[Math.floor(Math.random() * Math.min(candidatas.length, 15))];
  }
  if (!receta) {
    const bloqueo = await permitirExtra(admin, user.id, 'cambiar', MAX_NUEVAS_DIA, { creaReceta: true });
    if (bloqueo) return bloqueo;
    receta = await crearReceta(
      admin,
      'Un plato nuevo a tu elección, casero y de temporada',
      'Algo distinto y apetecible',
      tipo,
      nivel,
      restr,
      nombresUsados.length ? `No repitas ninguno de estos platos: ${nombresUsados.join(', ')}.` : '',
      mesDe(comida.fecha),
    );
    if (receta) await apuntarRecetaNueva(admin, user.id);
  }
  if (!receta) return fallo(502, 'ia', 'No hemos encontrado un plato que encaje contigo. Prueba otra vez en un momento.', 'sin receta apta');

  const kcalReceta = receta.kcal ?? KCAL_RACION_ESTANDAR[tipo];
  const factor = factorRacion(energia.kcal * parte, kcalReceta);
  const { error } = await admin
    .from('comidas')
    .update({ receta_id: receta.id, factor, kcal: Math.round(kcalReceta * factor), hecha: false, hecha_at: null })
    .eq('id', comida.id)
    .eq('user_id', user.id);
  if (error) throw error;
  return responder({ ok: true, receta_id: receta.id, nombre: receta.nombre });
}

servir('cambiar-plato', cambiar, 'No hemos podido cambiar el plato. Vuelve a intentarlo en un momento.');
