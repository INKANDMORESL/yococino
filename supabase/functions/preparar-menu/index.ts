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
import { createClient } from 'npm:@supabase/supabase-js@2';
import { ALERGENOS_UE, describirRestricciones, motivosNoApta, restriccionesDe, type Restricciones } from '../_shared/alergenos.ts';
import { ErrorIA, pedirJSON } from '../_shared/claude.ts';
import {
  AJUSTES_POR_DEFECTO,
  comidasDelDia,
  edadEn,
  energiaDiaria,
  factorRacion,
  KCAL_RACION_ESTANDAR,
  type Actividad,
  type Ajustes,
  type Objetivo,
  type Sexo,
  type TipoComida,
} from '../_shared/nutricion.ts';
import { normalizar } from '../_shared/texto.ts';

const MODELO_MENU = Deno.env.get('MODELO_MENU') || 'claude-sonnet-5-5';
const MODELO_RECETA = Deno.env.get('MODELO_RECETA') || 'claude-sonnet-5-5';
const DIAS_VENTANA = 30;
const MAX_DIAS_POR_LLAMADA = 3;
const RECETAS_EN_PARALELO = 6;

type Nivel = 'facil' | 'medio' | 'elaborado';
const MINUTOS_NIVEL: Record<Nivel, number> = { facil: 20, medio: 40, elaborado: 75 };
const NIVELES_PERMITIDOS: Record<Nivel, Nivel[]> = { facil: ['facil'], medio: ['facil', 'medio'], elaborado: ['facil', 'medio', 'elaborado'] };
const NOMBRE_TIPO: Record<TipoComida, string> = {
  desayuno: 'desayuno',
  media_manana: 'media mañana',
  almuerzo: 'almuerzo (comida principal del mediodía)',
  merienda: 'merienda',
  cena: 'cena',
};
const NOMBRE_OBJETIVO: Record<Objetivo, string> = {
  perder: 'perder peso de forma prudente y sostenible',
  mantener: 'mantener su peso comiendo equilibrado',
  musculo: 'ganar músculo (más proteína, acompaña a su entrenamiento)',
};
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const SECCIONES = ['carne_pescado', 'fruta_verdura', 'lacteos', 'cereales', 'despensa', 'congelados'] as const;
const UNIDADES = ['g', 'ml', 'ud', 'cda', 'cdta', 'pizca', 'al gusto'] as const;

// ---------- Respuestas HTTP ----------

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const responder = (cuerpo: unknown, estado = 200) =>
  new Response(JSON.stringify(cuerpo), { status: estado, headers: { ...CORS, 'Content-Type': 'application/json' } });

// `detalle` es técnico y nunca incluye datos de la persona: sirve para diagnosticar.
const fallo = (estado: number, error: string, mensaje: string, detalle?: string) =>
  responder({ error, mensaje, ...(detalle ? { detalle: detalle.slice(0, 300) } : {}) }, estado);

const mensajeTecnico = (e: unknown) =>
  e instanceof Error ? e.message : (e as { message?: string })?.message ?? String(e);

// ---------- Fechas (zona horaria de España) ----------

const hoyEspana = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid' }).format(new Date());

function sumarDias(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const diaSemana = (iso: string) => DIAS_SEMANA[new Date(`${iso}T12:00:00Z`).getUTCDay()];

// ---------- Conexión con Supabase ----------

function claveDeLista(variable: string): string | undefined {
  try {
    const d = JSON.parse(Deno.env.get(variable) ?? '{}') as Record<string, string>;
    return d.default ?? Object.values(d)[0];
  } catch {
    return undefined;
  }
}

function crearClientes(req: Request) {
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const publica = Deno.env.get('SUPABASE_ANON_KEY') || claveDeLista('SUPABASE_PUBLISHABLE_KEYS') || '';
  const secreta = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || claveDeLista('SUPABASE_SECRET_KEYS') || '';
  const opciones = { auth: { persistSession: false, autoRefreshToken: false } };
  const usuario = createClient(url, publica, {
    ...opciones,
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const admin = createClient(url, secreta, opciones);
  return { usuario, admin };
}

// ---------- Tipos ----------

type Cliente = ReturnType<typeof crearClientes>['admin'];

interface Perfil {
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
  encuesta_completada_at: string | null;
}

interface RecetaGuardada {
  id: number;
  nombre: string;
  tipo_comida: TipoComida;
  kcal: number | null;
  alergenos: string[];
  ingredientes: { nombre: string; nota: string | null }[];
}

interface RecetaIA {
  nombre: string;
  descripcion: string;
  minutos: number;
  nivel: Nivel;
  ingredientes: { nombre: string; cantidad: number | null; unidad: string; nota?: string; seccion: string }[];
  pasos: string[];
  consejos?: string[];
  sustituciones?: string[];
  nutricion: { kcal: number; proteinas: number; hidratos: number; grasas: number; fibra: number };
  alergenos: string[];
  etiquetas?: string[];
}

interface MenuIA {
  dias: { fecha: string; comidas: { tipo_comida: string; receta_id?: number | null; plato?: string | null; descripcion?: string | null }[] }[];
}

const COLUMNAS_RECETA = 'id, nombre, tipo_comida, kcal, alergenos, ingredientes(nombre, nota)';

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

const ESQUEMA_RECETA = {
  type: 'object',
  additionalProperties: false,
  required: ['nombre', 'descripcion', 'minutos', 'nivel', 'ingredientes', 'pasos', 'consejos', 'sustituciones', 'nutricion', 'alergenos', 'etiquetas'],
  properties: {
    nombre: { type: 'string', description: 'Nombre apetecible del plato, sin cantidades.' },
    descripcion: { type: 'string', description: 'Una frase que invite a cocinarlo.' },
    minutos: { type: 'integer', description: 'Tiempo total de preparación.' },
    nivel: { type: 'string', enum: ['facil', 'medio', 'elaborado'] },
    ingredientes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['nombre', 'cantidad', 'unidad', 'nota', 'seccion'],
        properties: {
          nombre: { type: 'string' },
          cantidad: { type: ['number', 'null'], description: 'null solo con la unidad "al gusto".' },
          unidad: { type: 'string', enum: UNIDADES },
          nota: { type: 'string', description: 'Por ejemplo: en crudo, picado fino. Vacío si no hace falta.' },
          seccion: { type: 'string', enum: SECCIONES, description: 'Sección del supermercado. El huevo va en carne_pescado.' },
        },
      },
    },
    pasos: { type: 'array', items: { type: 'string' } },
    consejos: { type: 'array', items: { type: 'string' } },
    sustituciones: { type: 'array', items: { type: 'string' } },
    nutricion: {
      type: 'object',
      additionalProperties: false,
      required: ['kcal', 'proteinas', 'hidratos', 'grasas', 'fibra'],
      properties: {
        kcal: { type: 'number' },
        proteinas: { type: 'number', description: 'gramos' },
        hidratos: { type: 'number', description: 'gramos' },
        grasas: { type: 'number', description: 'gramos' },
        fibra: { type: 'number', description: 'gramos' },
      },
    },
    alergenos: { type: 'array', items: { type: 'string', enum: ALERGENOS_UE }, description: 'Todos los alérgenos UE presentes.' },
    etiquetas: { type: 'array', items: { type: 'string' }, description: 'Por ejemplo: sin gluten, sin lactosa, vegetariana.' },
  },
};

// ---------- Utilidades ----------

async function enParalelo<T, R>(elementos: T[], limite: number, tarea: (e: T) => Promise<R>): Promise<R[]> {
  const resultados: R[] = new Array(elementos.length);
  let siguiente = 0;
  const trabajador = async () => {
    while (siguiente < elementos.length) {
      const i = siguiente++;
      resultados[i] = await tarea(elementos[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limite, elementos.length) }, trabajador));
  return resultados;
}

const esApta = (r: RecetaGuardada, restr: Restricciones) =>
  motivosNoApta({ nombre: r.nombre, alergenos: r.alergenos ?? [], ingredientes: r.ingredientes ?? [] }, restr).length === 0;

const texto = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const listaTextos = (v: unknown, maxItems: number, maxLargo: number) =>
  Array.isArray(v) ? v.map((x) => texto(x, maxLargo)).filter(Boolean).slice(0, maxItems) : [];
const numeroPositivo = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(v * 10) / 10 : null);

// ---------- Recetas ----------

async function cargarCatalogo(admin: Cliente, tipos: TipoComida[], nivel: Nivel, restr: Restricciones) {
  const { data, error } = await admin
    .from('recetas')
    .select(COLUMNAS_RECETA)
    .in('tipo_comida', tipos)
    .in('nivel', NIVELES_PERMITIDOS[nivel])
    .order('created_at', { ascending: false })
    .limit(400);
  if (error) throw error;
  const porTipo = new Map<TipoComida, RecetaGuardada[]>();
  for (const r of (data ?? []) as RecetaGuardada[]) {
    if (!esApta(r, restr)) continue;
    const lista = porTipo.get(r.tipo_comida) ?? [];
    if (lista.length < 30) lista.push(r);
    porTipo.set(r.tipo_comida, lista);
  }
  return [...porTipo.values()].flat();
}

function sistemaReceta(tipo: TipoComida, nivel: Nivel, restr: Restricciones) {
  return `Eres cocinero y dietista-nutricionista. Escribes recetas caseras de cocina mediterránea española, fáciles de seguir mientras se cocina, para UNA ración de una persona adulta.

Reglas:
- Cantidades exactas, en gramos o mililitros siempre que se pueda. Usa "ud" solo para piezas (un huevo, una manzana). Usa "al gusto" con cantidad null solo para sal, pimienta y especias.
- El aceite, medido: 1 cda son 10 ml de aceite de oliva virgen extra.
- La ración debe rondar ${KCAL_RACION_ESTANDAR[tipo]} kcal, propia de un ${NOMBRE_TIPO[tipo]}.
- Nivel ${nivel}: como máximo ${MINUTOS_NIVEL[nivel]} minutos en total.
- Pasos: entre 2 y 8, cortos, en imperativo, uno por acción. En tomas sencillas bastan 2 o 3.
- Entre 1 y 3 consejos prácticos y entre 1 y 3 sustituciones saludables con la misma función.
- Nutrición por ración, estimada con criterio.
- Alérgenos: marca TODOS los de la lista de la UE presentes en cualquier ingrediente, incluidos pan, salsas, caldos y productos elaborados.
- Esta receta debe ser apta por completo para alguien que no puede tomar: ${describirRestricciones(restr)}. Usa sustitutos aptos (por ejemplo, pan sin gluten o yogur sin lactosa) y, si el plato cambia, dilo en el nombre ("sin gluten").
- Español de España, tono cercano. Sin consejos médicos.`;
}

async function guardarReceta(admin: Cliente, r: RecetaIA, tipo: TipoComida, restr: Restricciones): Promise<RecetaGuardada> {
  const base = texto(r.nombre, 80);
  const sufijo = (r.etiquetas ?? []).map((e) => texto(e, 30)).find((e) => normalizar(e).startsWith('sin ')) ?? 'variante';
  const ingredientes = r.ingredientes
    .map((i, orden) => ({
      orden,
      nombre: texto(i.nombre, 80),
      cantidad: numeroPositivo(i.cantidad),
      unidad: (UNIDADES as readonly string[]).includes(i.unidad) ? i.unidad : 'g',
      nota: texto(i.nota, 80) || null,
      seccion: (SECCIONES as readonly string[]).includes(i.seccion) ? i.seccion : 'despensa',
    }))
    .filter((i) => i.nombre);
  const nutricion = {
    kcal: numeroPositivo(r.nutricion?.kcal),
    proteinas: numeroPositivo(r.nutricion?.proteinas),
    hidratos: numeroPositivo(r.nutricion?.hidratos),
    grasas: numeroPositivo(r.nutricion?.grasas),
    fibra: numeroPositivo(r.nutricion?.fibra),
  };

  for (let intento = 0; intento < 4; intento++) {
    const nombre = intento === 0 ? base : intento === 1 ? `${base} (${sufijo})` : `${base} (${sufijo} ${intento})`;
    const { data, error } = await admin
      .from('recetas')
      .insert({
        nombre,
        nombre_norm: normalizar(nombre),
        descripcion: texto(r.descripcion, 200) || null,
        tipo_comida: tipo,
        nivel: (['facil', 'medio', 'elaborado'] as const).includes(r.nivel) ? r.nivel : 'facil',
        minutos: Math.max(1, Math.min(240, Math.round(Number(r.minutos) || 15))),
        raciones: 1,
        pasos: listaTextos(r.pasos, 10, 400),
        consejos: listaTextos(r.consejos, 3, 300),
        sustituciones: listaTextos(r.sustituciones, 3, 300),
        nutricion,
        kcal: nutricion.kcal === null ? null : Math.round(nutricion.kcal),
        alergenos: (r.alergenos ?? []).filter((a) => (ALERGENOS_UE as readonly string[]).includes(a)),
        etiquetas: listaTextos(r.etiquetas, 6, 30),
        modelo: MODELO_RECETA,
      })
      .select('id')
      .single();

    if (error?.code === '23505') {
      // Ya hay una receta con ese nombre: si es apta para esta persona, se usa; si no, se prueba otro nombre.
      const existente = await recetaPorNombre(admin, normalizar(nombre));
      if (existente && existente.tipo_comida === tipo && esApta(existente, restr)) return existente;
      continue;
    }
    if (error || !data) throw error ?? new Error('Receta sin id');

    const { error: errorIng } = await admin.from('ingredientes').insert(ingredientes.map((i) => ({ ...i, receta_id: data.id })));
    if (errorIng) {
      await admin.from('recetas').delete().eq('id', data.id);
      throw errorIng;
    }
    return {
      id: data.id,
      nombre,
      tipo_comida: tipo,
      kcal: nutricion.kcal === null ? null : Math.round(nutricion.kcal),
      alergenos: r.alergenos ?? [],
      ingredientes: ingredientes.map((i) => ({ nombre: i.nombre, nota: i.nota })),
    };
  }
  throw new Error('No se encontró un nombre libre para la receta');
}

async function recetaPorNombre(admin: Cliente, nombreNorm: string): Promise<RecetaGuardada | null> {
  const { data } = await admin.from('recetas').select(COLUMNAS_RECETA).eq('nombre_norm', nombreNorm).maybeSingle();
  return (data as RecetaGuardada | null) ?? null;
}

// Crea una receta nueva con la IA. Si no supera la revisión de alergias, se reintenta una vez
// explicando el motivo. Si vuelve a fallar, devuelve null y ese día no se guarda.
async function crearReceta(
  admin: Cliente,
  plato: string,
  descripcion: string,
  tipo: TipoComida,
  nivel: Nivel,
  restr: Restricciones,
): Promise<RecetaGuardada | null> {
  let mensaje = `Plato: ${plato}\nDescripción: ${descripcion || '—'}\nTipo de comida: ${NOMBRE_TIPO[tipo]}`;
  for (let intento = 0; intento < 2; intento++) {
    let r: RecetaIA;
    try {
      r = await pedirJSON<RecetaIA>({
        modelo: MODELO_RECETA,
        sistema: sistemaReceta(tipo, nivel, restr),
        mensaje,
        esquema: ESQUEMA_RECETA,
        maxTokens: 8000,
      });
    } catch (e) {
      if (e instanceof ErrorIA && e.reintentable && intento === 0) continue;
      throw e;
    }
    if (!Array.isArray(r.ingredientes) || r.ingredientes.length === 0 || !Array.isArray(r.pasos) || !texto(r.nombre, 80)) {
      mensaje += '\n\nLa ficha anterior estaba incompleta. Incluye nombre, ingredientes con cantidades y pasos.';
      continue;
    }
    const motivos = motivosNoApta(
      { nombre: r.nombre, alergenos: r.alergenos ?? [], ingredientes: r.ingredientes.map((i) => ({ nombre: i.nombre, nota: i.nota ?? null })) },
      restr,
    );
    if (motivos.length === 0) return await guardarReceta(admin, r, tipo, restr);
    mensaje += `\n\nLa propuesta anterior NO era apta (${motivos.join('; ')}). Crea una versión que lo evite por completo.`;
  }
  return null;
}

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
  const { data: perfilDatos, error: errorPerfil } = await admin.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (errorPerfil) throw errorPerfil;
  const perfil = perfilDatos as Perfil | null;
  if (!perfil?.encuesta_completada_at || !perfil.sexo || !perfil.altura_cm || !perfil.peso_inicial_kg || !perfil.objetivo || !perfil.actividad) {
    return fallo(409, 'sin_encuesta', 'Completa la encuesta para que podamos preparar tu menú.');
  }
  if (!perfil.consentimiento_salud_at) {
    return fallo(403, 'sin_consentimiento', 'Necesitamos tu permiso para usar tus datos de salud antes de preparar tu menú.');
  }
  if (!perfil.fecha_nacimiento || edadEn(perfil.fecha_nacimiento, hoy) < 18) {
    return fallo(403, 'menor', 'Yococino es solo para mayores de 18 años.');
  }
  if ((perfil.condiciones ?? []).length > 0) {
    return fallo(403, 'profesional', 'En tu caso, lo mejor es que un dietista-nutricionista o tu médico preparen tu pauta.');
  }

  // 2. Energía diaria, con el peso más reciente si lo hay.
  const { data: ultimoPeso } = await admin
    .from('pesos')
    .select('peso_kg')
    .eq('user_id', user.id)
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
  const energia = energiaDiaria(
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return fallo(405, 'metodo', 'Usa POST.');
  try {
    return await preparar(req);
  } catch (e) {
    if (e instanceof ErrorIA && e.noConfigurada) {
      console.error('preparar-menu: IA no configurada:', e.message);
      return fallo(503, 'ia_no_configurada', 'El generador de menús aún no está activado. Vuelve a intentarlo más tarde.');
    }
    if (e instanceof ErrorIA) {
      return fallo(502, 'ia', 'No hemos podido preparar estos días. Vuelve a intentarlo en un momento.', e.message);
    }
    // Solo el mensaje técnico: nunca datos de la persona.
    console.error('preparar-menu:', mensajeTecnico(e));
    return fallo(500, 'interno', 'No hemos podido preparar tu menú. Inténtalo de nuevo en un momento.', mensajeTecnico(e));
  }
});
