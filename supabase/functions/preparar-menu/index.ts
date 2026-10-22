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
import { energiaDe, perfilSeguro } from '../_shared/perfil.ts';
import {
  cargarCatalogo,
  COLUMNAS_RECETA,
  crearReceta,
  enParalelo,
  esApta,
  MINUTOS_NIVEL,
  texto,
  type Nivel,
  type RecetaGuardada,
} from '../_shared/recetas.ts';
import { normalizar } from '../_shared/texto.ts';

const MODELO_MENU = Deno.env.get('MODELO_MENU') || 'claude-sonnet-5-5';
const DIAS_VENTANA = 30;
const MAX_DIAS_POR_LLAMADA = 3;
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

  const comidas = comidasDelDia(perfil.comidas_dia ?? 5);
  const tipos = comidas.map((c) => c.tipo);
  const nivel: Nivel = perfil.nivel_cocina ?? 'facil';
  const restr = restriccionesDe(perfil.alergias ?? [], perfil.no_me_gusta ?? []);

  // 3. Qué días faltan para tener 30 por delante.
  const fin = sumarDias(hoy, DIAS_VENTANA - 1);
  const { data: existentes, error: errorExist } = await admin
    .from('comidas')
    .select('fecha, receta:recetas(nombre)')
    .eq('user_id', user.id)
    .gte('fecha', sumarDias(hoy, -10))
    .lte('fecha', fin);
  if (errorExist) throw errorExist;
  const filasExistentes = (existentes ?? []) as unknown as { fecha: string; receta: { nombre: string } | null }[];
  const conMenu = new Set(filasExistentes.filter((e) => e.fecha >= hoy).map((e) => e.fecha));
  const faltan: string[] = [];
  for (let i = 0; i < DIAS_VENTANA; i++) {
    const f = sumarDias(hoy, i);
    if (!conMenu.has(f)) faltan.push(f);
  }
  if (faltan.length === 0) return responder({ ok: true, creados: [], pendientes: 0, kcal_dia: energia.kcal });
  const aPreparar = faltan.slice(0, diasPedidos);
  const yaPuestos = [...new Set(filasExistentes.map((e) => e.receta?.nombre).filter(Boolean))].slice(-60);

  // 4. Pedir a la IA los platos de esos días.
  const catalogo = await cargarCatalogo(admin, tipos, nivel, restr);
  const porId = new Map(catalogo.map((r) => [r.id, r]));
  const mes = MESES[Number(hoy.slice(5, 7)) - 1];

  const sistemaMenu = `Eres dietista-nutricionista y cocinero de cocina mediterránea española. Planificas menús caseros, equilibrados, variados y apetecibles para una persona adulta sana.

Reglas obligatorias:
- Nunca propongas platos con: ${describirRestricciones(restr)}. Si un plato suele llevarlo, propón la versión apta y dilo en el nombre (por ejemplo, "Pasta sin gluten con tomate").
- Variedad: no repitas un mismo almuerzo o cena en 7 días. Desayunos y tomas pequeñas pueden repetirse como mucho 2 veces por semana.
- Equilibrio semanal: legumbres 2 a 4 veces, pescado al menos 3 (si se puede tomar), carne roja como mucho 2, verdura u hortaliza en almuerzo y cena, fruta a diario, cereales integrales cuando se pueda y pocos ultraprocesados.
- Recetas de nivel ${nivel}: como máximo ${MINUTOS_NIVEL[nivel]} minutos.
- Productos de temporada de ${mes} en España.
- Reutiliza recetas del catálogo con su receta_id cuando encajen. Si no, propón un plato nuevo con "plato" (nombre corto y apetecible, sin cantidades) y "descripcion" (una línea).
- Devuelve exactamente las comidas pedidas para cada día. Sin consejos médicos.`;

  const lineasCatalogo = catalogo.length
    ? catalogo.map((r) => `${r.id} · ${r.tipo_comida} · ${r.nombre}`).join('\n')
    : '(vacío: propón platos nuevos)';
  const mensajeMenu = `Días a planificar:
${aPreparar.map((f) => `- ${f} (${diaSemana(f)})`).join('\n')}

Comidas de cada día, con su energía orientativa (las cantidades se ajustan después):
${comidas.map((c) => `- ${c.tipo}: unas ${Math.round((energia.kcal * c.parte) / 10) * 10} kcal`).join('\n')}

Objetivo de la persona: ${NOMBRE_OBJETIVO[energia.objetivoAplicado]}.

Platos de los últimos y próximos días (no los repitas en almuerzos y cenas):
${yaPuestos.length ? yaPuestos.join(', ') : '(ninguno todavía)'}

Catálogo reutilizable (id · tipo · nombre):
${lineasCatalogo}`;

  const menu = await pedirJSON<MenuIA>({
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
    const { data } = await admin.from('recetas').select(`${COLUMNAS_RECETA}, nombre_norm`).in('nombre_norm', nombres);
    for (const r of (data ?? []) as (RecetaGuardada & { nombre_norm: string })[]) {
      const clave = `${r.tipo_comida}|${r.nombre_norm}`;
      if (nuevas.has(clave) && esApta(r, restr)) resueltas.set(clave, r);
    }
  }
  const porCrear = [...nuevas.entries()].filter(([clave]) => !resueltas.has(clave));
  const errores: string[] = [];
  const creadas = await enParalelo(porCrear, RECETAS_EN_PARALELO, async ([clave, p]) => {
    try {
      return [clave, await crearReceta(admin, p.plato, p.descripcion, p.tipo, nivel, restr)] as const;
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
    const porTipo = plan.get(fecha);
    if (!porTipo) continue;
    const filasDia: Record<string, unknown>[] = [];
    for (const [orden, { tipo, parte }] of comidas.entries()) {
      const eleccion = porTipo.get(tipo);
      const receta = eleccion?.recetaId ? porId.get(eleccion.recetaId) : eleccion?.clave ? resueltas.get(eleccion.clave) : null;
      if (!receta) break;
      const kcalReceta = receta.kcal ?? KCAL_RACION_ESTANDAR[tipo];
      const factor = factorRacion(energia.kcal * parte, kcalReceta);
      filasDia.push({ user_id: user.id, fecha, orden, tipo_comida: tipo, receta_id: receta.id, factor, kcal: Math.round(kcalReceta * factor) });
    }
    if (filasDia.length === comidas.length) {
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
  return responder({ ok: true, creados, pendientes: faltan.length - creados.length, kcal_dia: energia.kcal });
}

servir('preparar-menu', preparar, 'No hemos podido preparar estos días. Vuelve a intentarlo en un momento.');
