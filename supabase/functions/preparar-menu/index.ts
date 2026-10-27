// preparar-menu: rellena el menú de la persona hasta tener siempre 30 días por delante.
// Cada llamada prepara unos pocos días (por defecto 2) para responder rápido; la app la repite
// hasta completar el mes. Las recetas son compartidas entre usuarios y se crean una sola vez.
//
// Seguridad (no negociable, ver CLAUDE.md):
// - Solo mayores de 18, con consentimiento de datos de salud y sin situaciones que requieran un profesional.
// - Energía con déficit moderado y nunca por debajo del mínimo (tabla ajustes_nutricion).
// - Alergias e intolerancias: etiqueta de la IA + revisión propia de ingredientes. Ante la duda, se descarta.
// - A la IA no se le envían datos personales: solo energía por comida, objetivo y restricciones.
// - Nunca se escriben datos de salud en los registros (logs).
import { describirRestricciones, restriccionesDe } from '../_shared/alergenos.ts';
import { ErrorIA, pedirJSON } from '../_shared/claude.ts';
import { diaSemana, fallo, hoyEspana, mensajeTecnico, responder, servir, sumarDias, crearClientes } from '../_shared/http.ts';
import { comidasDelDia, factorRacion, KCAL_RACION_ESTANDAR, type Objetivo, type TipoComida } from '../_shared/nutricion.ts';
import { cobrarA, modoMenu, type ModoMenu } from '../_shared/costes.ts';
import { energiaDe, perfilSeguro } from '../_shared/perfil.ts';
import { empezarPrueba, esAdministrador, planDe } from '../_shared/plan.ts';
import {
  cargarCatalogo,
  cupoRecetas,
  COLUMNAS_RECETA,
  crearReceta,
  enParalelo,
  esApta,
  MINUTOS_NIVEL,
  texto,
  type Nivel,
  type RecetaGuardada,
} from '../_shared/recetas.ts';
import { frutasDelMes, mesDe } from '../_shared/temporada.ts';
import { normalizar } from '../_shared/texto.ts';
import { seHaceEnAirfryer } from '../_shared/aparatos.ts';
import { encajaPreferencia, NOMBRE_TOMA, type Preferencias } from '../_shared/preferencias.ts';

// Planificar es sencillo y se hace a diario: modelo barato (ver costes.ts). Las recetas nuevas usan MODELO_RECETA.
const MODELO_MENU = Deno.env.get('MODELO_MENU') || 'claude-haiku-5-5';
const DIAS_VENTANA = 30;
const MAX_DIAS_POR_LLAMADA = 3;
// Reposición semanal: cuando solo faltan los últimos días del mes, se preparan 7 de golpe (una llamada a la semana
// en lugar de una al día). Así siempre hay al menos 30 días por delante y se gasta mucho menos.
const DIAS_REPOSICION = 7;
const VENTANA_MAX = DIAS_VENTANA + DIAS_REPOSICION - 1;
// Recetas del catálogo que se le enseñan a la IA por tipo de comida (menos texto = más barato).
const CATALOGO_POR_TIPO = 25;
const RECETAS_EN_PARALELO = 6;

const NOMBRE_OBJETIVO: Record<Objetivo, string> = {
  perder: 'perder peso de forma prudente y sostenible',
  mantener: 'mantener su peso comiendo equilibrado',
  musculo: 'ganar músculo (más proteína, acompaña a su entrenamiento)',
};
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

interface MenuIA {
  dias: { fecha: string; comidas: { tipo_comida: string; receta_id?: number | null; plato?: string | null; descripcion?: string | null }[] }[];
}

// ---------- Esquemas JSON de las respuestas de la IA ----------
// Requisitos de "structured outputs": todos los objetos con additionalProperties: false
// y, para no complicar el esquema, todos los campos obligatorios (los opcionales admiten null).

const esquemaMenu = (tipos: TipoComida[]) => ({
  type: 'object',
  additionalProperties: false,
  required: ['dias'],
  properties: {
    dias: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['fecha', 'comidas'],
        properties: {
          fecha: { type: 'string', description: 'AAAA-MM-DD' },
          comidas: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['tipo_comida', 'receta_id', 'plato', 'descripcion'],
              properties: {
                tipo_comida: { type: 'string', enum: tipos },
                receta_id: { type: ['integer', 'null'], description: 'Id de una receta del catálogo si reutilizas una; si no, null.' },
                plato: { type: ['string', 'null'], description: 'Nombre del plato nuevo; null si reutilizas una receta.' },
                descripcion: { type: ['string', 'null'], description: 'Una línea sobre el plato nuevo; null si reutilizas una receta.' },
              },
            },
          },
        },
      },
    },
  },
});

// ---------- Proceso principal ----------

async function preparar(req: Request): Promise<Response> {
  const { usuario, admin } = crearClientes(req);
  const { data: auth } = await usuario.auth.getUser();
  const user = auth?.user;
  if (!user) return fallo(401, 'no_autenticado', 'Vuelve a entrar en tu cuenta.');

  const cuerpo = (await req.json().catch(() => ({}))) as { dias?: number };
  const diasPedidos = Math.max(1, Math.min(MAX_DIAS_POR_LLAMADA, Math.round(Number(cuerpo.dias) || 2)));
  const hoy = hoyEspana();

  // 1. Perfil y comprobaciones de seguridad.
  const seguro = await perfilSeguro(admin, user.id, hoy);
  if ('respuesta' in seguro) return seguro.respuesta;
  const perfil = seguro.perfil;

  // 2. Energía diaria, con el peso más reciente si lo hay.
  const energia = await energiaDe(admin, perfil, hoy);
  await admin.from('profiles').update({ kcal_dia: energia.kcal }).eq('id', user.id);

  // Presupuesto de la persona: completo, ahorro (sin recetas nuevas) o sin IA (solo recetas existentes).
  cobrarA(user.id, 'menu');
  // La cuenta del dueño siempre tiene el menú completo, sin tope de presupuesto.
  let modo: ModoMenu = (await esAdministrador(admin, user.id)) ? 'completo' : await modoMenu(admin, user.id);

  // Plan: en la prueba gratis, menú solo de 7 días y sin platos nuevos (se usan recetas existentes).
  const planPersona = await planDe(admin, user.id);
  if (planPersona.estado === 'caducada') {
    return responder({ ok: true, creados: [], pendientes: 0, kcal_dia: energia.kcal, plan: 'caducada', fin_prueba: planPersona.finPrueba });
  }
  const finPrueba = planPersona.estado === 'prueba' ? await empezarPrueba(admin, user.id) : null;
  if (planPersona.estado === 'prueba' && modo === 'completo') modo = 'ahorro';

  const comidas = comidasDelDia(perfil.comidas_dia ?? 5);
  const tipos = comidas.map((c) => c.tipo);
  const nivel: Nivel = perfil.nivel_cocina ?? 'facil';
  const restr = restriccionesDe(perfil.alergias ?? [], perfil.no_me_gusta ?? [], perfil.aparatos);

  // 3. Qué días faltan para tener 30 por delante.
  const fin = sumarDias(hoy, VENTANA_MAX - 1);
  const { data: existentes, error: errorExist } = await admin
    .from('comidas')
    .select('fecha, orden, receta_id, receta:recetas(nombre)')
    .eq('user_id', user.id)
    .gte('fecha', sumarDias(hoy, -10))
    .lte('fecha', fin);
  if (errorExist) throw errorExist;
  const filasExistentes = (existentes ?? []) as unknown as { fecha: string; orden: number; receta_id: number | null; receta: { nombre: string } | null }[];
  // Comidas que ya tiene cada día. Un día con huecos (por ejemplo, porque se quitó un plato con un alimento
  // que no le gusta) solo se completa: lo demás no se toca, por si ya se ha hecho la compra.
  const ordenesDe = new Map<string, Set<number>>();
  for (const e of filasExistentes) {
    if (e.fecha < hoy) continue;
    const set = ordenesDe.get(e.fecha) ?? new Set<number>();
    set.add(e.orden);
    ordenesDe.set(e.fecha, set);
  }
  const huecosDe = (f: string) => comidas.map((_, orden) => orden).filter((orden) => !ordenesDe.get(f)?.has(orden));
  const faltanEn = (dias: number) => {
    const lista: string[] = [];
    for (let i = 0; i < dias; i++) {
      const f = sumarDias(hoy, i);
      if (finPrueba && f > finPrueba) break;
      if (huecosDe(f).length) lista.push(f);
    }
    return lista;
  };
  let faltan = faltanEn(DIAS_VENTANA);
  // Solo faltan los últimos días (reposición normal): se prepara una semana entera de una vez.
  const reponerSemana = !finPrueba && faltan.length > 0 && faltan.length <= 2 && faltan[0] >= sumarDias(hoy, DIAS_VENTANA - DIAS_REPOSICION);
  if (reponerSemana) faltan = faltanEn(VENTANA_MAX);
  const datosPlan = { plan: planPersona.estado, fin_prueba: finPrueba };
  if (faltan.length === 0) return responder({ ok: true, creados: [], pendientes: 0, kcal_dia: energia.kcal, ...datosPlan });
  const aPreparar = faltan.slice(0, reponerSemana ? DIAS_REPOSICION : diasPedidos);
  const yaPuestos = [...new Set(filasExistentes.map((e) => e.receta?.nombre).filter(Boolean))].slice(-60);

  // 4. Pedir a la IA los platos de esos días.
  const numMes = mesDe(aPreparar[0]);
  const catalogo = await cargarCatalogo(admin, tipos, nivel, restr, numMes, (perfil as { preferencias?: unknown }).preferencias ? 200 : 60);
  // Platos nuevos: solo si quedan en el cupo global del mes y pocos por llamada; lo normal es reutilizar.
  const quedanNuevas = modo === 'completo' ? (await cupoRecetas(admin)).quedan : 0;
  const pocasDeAlgunTipo = tipos.some((t) => catalogo.filter((r) => r.tipo_comida === t).length < 12);
  const maxNuevas = Math.min(quedanNuevas, pocasDeAlgunTipo ? 2 * aPreparar.length + 2 : 1 + Math.floor(aPreparar.length / 2));
  const porId = new Map(catalogo.map((r) => [r.id, r]));
  const mes = MESES[numMes - 1];
  const conAirfryer = (restr.aparatos ?? []).includes('airfryer');
  // Lo que la persona ha escrito que le gusta (Perfil → Cómo te gusta comer). Se respeta reutilizando recetas.
  const prefs = ((perfil as { preferencias?: Preferencias | null }).preferencias ?? null) as Preferencias | null;
  const prefTipo = (t: TipoComida) => prefs?.mas?.[t] ?? [];
  const prefGeneral = prefs?.mas?.todas ?? [];
  const encajaTipo = (r: RecetaGuardada) => encajaPreferencia(r, prefTipo(r.tipo_comida));
  const encajaGeneral = (r: RecetaGuardada) => encajaPreferencia(r, prefGeneral);
  const lineasPrefs = [
    ...tipos.filter((t) => prefTipo(t).length).map((t) => `${NOMBRE_TOMA[t]}: casi siempre con ${prefTipo(t).join(', ')} (marcados «le gusta»)`),
    ...(prefGeneral.length ? [`en general, más platos con ${prefGeneral.join(', ')}, sin dejar de variar`] : []),
  ];

  const sistemaMenu = `Eres dietista-nutricionista y cocinero de cocina mediterránea española. Planificas menús caseros, equilibrados, variados y apetecibles para una persona adulta sana.

Reglas obligatorias:
- Nunca propongas platos con: ${describirRestricciones(restr)}. Si un plato suele llevarlo, propón la versión apta y dilo en el nombre (por ejemplo, "Pasta sin gluten con tomate").
- Variedad: no repitas un mismo almuerzo o cena en 7 días. Desayunos y tomas pequeñas pueden repetirse como mucho 2 veces por semana.
- Equilibrio semanal: legumbres 2 a 4 veces, pescado al menos 3 (si se puede tomar), carne roja como mucho 2, verdura u hortaliza en almuerzo y cena, fruta a diario, cereales integrales cuando se pueda y pocos ultraprocesados.
- Recetas de nivel ${nivel}: como máximo ${MINUTOS_NIVEL[nivel]} minutos.
- Productos de temporada de ${mes} en España. La fruta fresca, siempre de temporada: ${frutasDelMes(numMes).join(', ')}. Varía la fruta a lo largo de la semana.
- Reutiliza SIEMPRE recetas del catálogo con su receta_id cuando encajen; es lo preferente. ${
    maxNuevas > 0
      ? `Solo si de verdad no hay ninguna adecuada, propón un plato nuevo con "plato" (nombre corto y apetecible, sin cantidades) y "descripcion" (una línea); como máximo ${maxNuevas} platos nuevos en total en esta respuesta.`
      : 'No propongas platos nuevos: usa solo recetas del catálogo (receta_id) y deja plato y descripcion en null.'
  }
${
    lineasPrefs.length
      ? `- Gustos de la persona (respétalos siempre que cumplan las demás reglas; elige del catálogo los marcados «le gusta»): ${lineasPrefs.join('; ')}.\n`
      : ''
  }${
    conAirfryer
      ? '- Tiene airfryer: incluye 2 o 3 almuerzos o cenas a la semana que se hagan en airfryer (marcados «airfryer» en el catálogo). No más, para que haya variedad.\n'
      : ''
  }- Devuelve exactamente las comidas pedidas para cada día. Sin consejos médicos.`;

  // Recetas ya usadas cerca: no se repiten al elegir del catálogo sin IA, y van al final de lo que se enseña a la IA.
  const usadas = new Set(filasExistentes.map((e) => e.receta_id).filter((x): x is number => x !== null));
  const catalogoIA = tipos.flatMap((t) => {
    const delTipo = catalogo.filter((r) => r.tipo_comida === t);
    const orden = [...delTipo.filter((r) => !usadas.has(r.id)), ...delTipo.filter((r) => usadas.has(r.id))];
    // Con airfryer, que siempre se vean algunas de airfryer aunque el catálogo sea grande.
    const deAirfryer = conAirfryer ? orden.filter((r) => seHaceEnAirfryer(r.aparatos, r.nota_airfryer)).slice(0, 6) : [];
    // Primero lo que encaja con sus gustos de esa toma; luego algunos de sus gustos generales.
    const gusta = [...orden.filter(encajaTipo), ...orden.filter((r) => !encajaTipo(r) && encajaGeneral(r)).slice(0, 8)];
    const primero = [...new Set([...gusta, ...deAirfryer])];
    return [...primero, ...orden.filter((r) => !primero.includes(r))].slice(0, CATALOGO_POR_TIPO);
  });
  const lineasCatalogo = catalogoIA.length
    ? catalogoIA
        .map(
          (r) =>
            `${r.id} · ${r.tipo_comida} · ${r.nombre}${encajaTipo(r) || encajaGeneral(r) ? ' · le gusta' : ''}${conAirfryer && seHaceEnAirfryer(r.aparatos, r.nota_airfryer) ? ' · airfryer' : ''}`,
        )
        .join('\n')
    : '(vacío: propón platos nuevos)';
  const mensajeMenu = `Días a planificar:
${aPreparar
  .map((f) => {
    const h = huecosDe(f);
    return `- ${f} (${diaSemana(f)})${h.length < comidas.length ? `: SOLO ${h.map((o) => comidas[o].tipo).join(', ')} (el resto del día ya está)` : ''}`;
  })
  .join('\n')}

Comidas de cada día, con su energía orientativa (las cantidades se ajustan después):
${comidas.map((c) => `- ${c.tipo}: unas ${Math.round((energia.kcal * c.parte) / 10) * 10} kcal`).join('\n')}

Objetivo de la persona: ${NOMBRE_OBJETIVO[energia.objetivoAplicado]}.

Platos de los últimos y próximos días (no los repitas en almuerzos y cenas):
${yaPuestos.length ? yaPuestos.join(', ') : '(ninguno todavía)'}

Catálogo reutilizable (id · tipo · nombre):
${lineasCatalogo}`;

  const elegirDelCatalogo = (tipo: TipoComida): RecetaGuardada | null => {
    const delTipo = catalogo.filter((r) => r.tipo_comida === tipo);
    const libres = delTipo.filter((r) => !usadas.has(r.id));
    // Sin IA: si tiene gustos para esta toma, primero las recetas que encajan.
    const libresQueGustan = libres.filter(encajaTipo);
    const lista = libresQueGustan.length ? libresQueGustan : libres.length ? libres : delTipo;
    if (!lista.length) return null;
    const r = lista[Math.floor(Math.random() * lista.length)];
    usadas.add(r.id);
    return r;
  };

  const menu: MenuIA =
    modo === 'sin_ia'
      ? { dias: aPreparar.map((fecha) => ({ fecha, comidas: [] })) }
      : await pedirJSON<MenuIA>({
          modelo: MODELO_MENU,
          sistema: sistemaMenu,
          mensaje: mensajeMenu,
          esquema: esquemaMenu(tipos),
          maxTokens: 8000,
        });

  // 5. Resolver cada comida: receta del catálogo, receta existente con el mismo nombre o receta nueva.
  type Pendiente = { plato: string; descripcion: string; tipo: TipoComida };
  const plan = new Map<string, Map<TipoComida, { recetaId?: number; clave?: string }>>();
  const nuevas = new Map<string, Pendiente>();
  for (const dia of menu.dias ?? []) {
    if (!aPreparar.includes(dia.fecha)) continue;
    const porTipo = new Map<TipoComida, { recetaId?: number; clave?: string }>();
    for (const c of dia.comidas ?? []) {
      const tipo = c.tipo_comida as TipoComida;
      if (!tipos.includes(tipo) || porTipo.has(tipo)) continue;
      // Solo los huecos del día: lo que ya está no se cambia.
      if (!huecosDe(dia.fecha).some((o) => comidas[o].tipo === tipo)) continue;
      if (c.receta_id && porId.get(c.receta_id)?.tipo_comida === tipo) {
        porTipo.set(tipo, { recetaId: c.receta_id });
      } else if (texto(c.plato, 80)) {
        const clave = `${tipo}|${normalizar(c.plato as string)}`;
        if (!nuevas.has(clave)) nuevas.set(clave, { plato: texto(c.plato, 80), descripcion: texto(c.descripcion, 200), tipo });
        porTipo.set(tipo, { clave });
      }
    }
    plan.set(dia.fecha, porTipo);
  }

  // Platos nuevos que ya existen con ese nombre y son aptos: se reutilizan sin gastar IA.
  const resueltas = new Map<string, RecetaGuardada | null>();
  const nombres = [...nuevas.values()].map((p) => normalizar(p.plato));
  if (nombres.length) {
    const { data } = await admin.from('recetas').select(`${COLUMNAS_RECETA}, nombre_norm`).in('nombre_norm', nombres).eq('oculta', false).eq('solo_especial', false);
    for (const r of (data ?? []) as (RecetaGuardada & { nombre_norm: string })[]) {
      const clave = `${r.tipo_comida}|${r.nombre_norm}`;
      if (nuevas.has(clave) && esApta(r, restr)) resueltas.set(clave, r);
    }
  }
  // Recetas nuevas solo con presupuesto completo; si no, esas comidas se cubren con el catálogo.
  const porCrear = modo === 'completo' ? [...nuevas.entries()].filter(([clave]) => !resueltas.has(clave)).slice(0, maxNuevas) : [];
  const errores: string[] = [];
  const creadas = await enParalelo(porCrear, RECETAS_EN_PARALELO, async ([clave, p]) => {
    try {
      return [clave, await crearReceta(admin, p.plato, p.descripcion, p.tipo, nivel, restr, '', numMes)] as const;
    } catch (e) {
      if (e instanceof ErrorIA && e.noConfigurada) throw e;
      errores.push(mensajeTecnico(e));
      console.error('receta no creada:', mensajeTecnico(e));
      return [clave, null] as const;
    }
  });
  for (const [clave, r] of creadas) resueltas.set(clave, r);

  // 6. Guardar los días completos. Un día con alguna comida sin receta apta no se guarda y se reintenta después.
  const filas: Record<string, unknown>[] = [];
  const creados: string[] = [];
  for (const fecha of aPreparar) {
    const porTipo = plan.get(fecha) ?? new Map<TipoComida, { recetaId?: number; clave?: string }>();
    const filasDia: Record<string, unknown>[] = [];
    const huecos = huecosDe(fecha);
    for (const [orden, { tipo, parte }] of comidas.entries()) {
      if (!huecos.includes(orden)) continue;
      const eleccion = porTipo.get(tipo);
      const receta =
        (eleccion?.recetaId ? porId.get(eleccion.recetaId) : eleccion?.clave ? resueltas.get(eleccion.clave) : null) ?? elegirDelCatalogo(tipo);
      if (!receta) break;
      usadas.add(receta.id);
      const kcalReceta = receta.kcal ?? KCAL_RACION_ESTANDAR[tipo];
      const factor = factorRacion(energia.kcal * parte, kcalReceta);
      filasDia.push({ user_id: user.id, fecha, orden, tipo_comida: tipo, receta_id: receta.id, factor, kcal: Math.round(kcalReceta * factor) });
    }
    if (filasDia.length === huecos.length) {
      filas.push(...filasDia);
      creados.push(fecha);
    }
  }

  if (filas.length) {
    const { error } = await admin.from('comidas').upsert(filas, { onConflict: 'user_id,fecha,orden', ignoreDuplicates: true });
    if (error) throw error;
  }
  if (creados.length === 0) {
    const detalle = errores[0] ?? (porCrear.length ? 'ninguna receta superó la revisión de alergias' : 'la IA no devolvió las comidas pedidas');
    return fallo(502, 'ia', 'No hemos podido preparar estos días. Vuelve a intentarlo en un momento.', detalle);
  }
  return responder({ ok: true, creados, pendientes: faltan.length - creados.length, kcal_dia: energia.kcal, ...datosPlan });
}

servir('preparar-menu', preparar, 'No hemos podido preparar estos días. Vuelve a intentarlo en un momento.');
