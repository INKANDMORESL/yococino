// sembrar-recetas: carga del recetario compartido y fotos, por LOTES a mitad de precio. Solo para administradores.
// - enviar: pide ideas de platos (llamada barata) y manda las recetas a un lote de Claude.
// - tipicas: como enviar, con la lista de platos típicos españoles.
// - airfryer: como enviar, con la lista de platos hechos en airfryer (_shared/airfryer.ts).
// - especiales: recetas de los especiales de temporada en marcha o próximos (también automático, una vez al día).
// - notas_airfryer: a las recetas de horno ya guardadas les añade cómo hacerlas en airfryer (llamada barata, por tandas).
// - fotos: pone en marcha la cola de fotos (aligerar-fotos), que hace las que faltan de una en una.
// - estado: recoge los lotes de recetas terminados y enseña cómo van.
// Respeta el cupo global de recetas del mes, revisa alergias igual que siempre y no cobra nada a ningún cliente.
import { restriccionesDe } from '../_shared/alergenos.ts';
import { crearLote, estadoLote, leerJSON, pedirJSON, resultadosLote } from '../_shared/claude.ts';
import { costeTokens, FOTO_USD } from '../_shared/costes.ts';
import { apuntarError, crearClientes, fallo, hoyEspana, mensajeTecnico, responder, servir, type Cliente } from '../_shared/http.ts';
import { crearLoteFotos, estadoLoteFotos, guardarOriginal, leerFotosDelLote, MODELO_FOTO, promptDe, seguirAligerando } from '../_shared/fotos.ts';
import type { TipoComida } from '../_shared/nutricion.ts';
import {
  cupoRecetas,
  ESQUEMA_RECETA,
  ESQUEMA_RECETA_COMPLETA,
  guardarReceta,
  mensajeReceta,
  modeloReceta,
  NOMBRE_TIPO,
  problemaReceta,
  sistemaReceta,
  texto,
  type Nivel,
  type RecetaIA,
} from '../_shared/recetas.ts';
import { frutasDelMes, mesDe } from '../_shared/temporada.ts';
import { normalizar } from '../_shared/texto.ts';
import { TIPICAS } from '../_shared/tipicas.ts';
import { AIRFRYER } from '../_shared/airfryer.ts';
import { especialPorClave, especialesProximos, type Especial } from '../_shared/especiales.ts';
import { avisosNutricion } from '../_shared/importar_reglas.ts';

const MODELO_IDEAS = Deno.env.get('MODELO_MENU') || 'claude-haiku-5-5';
const MAX_POR_LOTE = 100;
const IDEAS_POR_LLAMADA = 40;
const TIPOS: TipoComida[] = ['desayuno', 'media_manana', 'almuerzo', 'merienda', 'cena'];
// Reparto aproximado del recetario: más comidas y cenas, que son las que más variedad necesitan.
const REPARTO: [TipoComida, number][] = [['desayuno', 0.18], ['media_manana', 0.14], ['almuerzo', 0.28], ['merienda', 0.14], ['cena', 0.26]];

interface Idea {
  plato: string;
  descripcion: string;
  tipo_comida: TipoComida;
  nivel: Nivel;
  variante: 'normal' | 'sin_gluten' | 'sin_lactosa';
  airfryer?: boolean; // el plato se cocina en airfryer
  especial?: string; // clave del especial de temporada (ver _shared/especiales.ts)
  otro?: boolean; // postre o dulce: se guarda como «otro» (no es una comida del día)
}

const ESQUEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['platos'],
  properties: {
    platos: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['plato', 'descripcion', 'tipo_comida', 'nivel', 'variante'],
        properties: {
          plato: { type: 'string' },
          descripcion: { type: 'string' },
          tipo_comida: { type: 'string', enum: TIPOS },
          nivel: { type: 'string', enum: ['facil', 'medio', 'elaborado'] },
          variante: { type: 'string', enum: ['normal', 'sin_gluten', 'sin_lactosa'] },
        },
      },
    },
  },
};

// Ideas de platos nuevos, repartidas por tipo y sin repetir lo que ya existe (llamada barata, por tandas de 50).
async function ideasNuevas(admin: Cliente, cantidad: number, mes: number): Promise<Idea[]> {
  const { data: existentes } = await admin.from('recetas').select('nombre, tipo_comida').order('created_at', { ascending: false }).limit(3000);
  const filas = (existentes ?? []) as { nombre: string; tipo_comida: string }[];
  const vistos = new Set(filas.map((f) => normalizar(f.nombre)));
  const ideas: Idea[] = [];
  for (let intento = 0; ideas.length < cantidad && intento < Math.ceil(cantidad / IDEAS_POR_LLAMADA) + 2; intento++) {
    const pedir = Math.min(IDEAS_POR_LLAMADA, cantidad - ideas.length);
    const total = filas.length + ideas.length + pedir;
    const faltan = REPARTO.map(([t, p]) => [t, Math.max(0, Math.round(total * p) - filas.filter((f) => f.tipo_comida === t).length - ideas.filter((i) => i.tipo_comida === t).length)] as const);
    const suma = faltan.reduce((s, [, n]) => s + n, 0) || 1;
    const reparto = faltan.map(([t, n]) => `${NOMBRE_TIPO[t]}: ${Math.round((n / suma) * pedir)}`).join(', ');
    const r = await pedirJSON<{ platos: Idea[] }>({
      modelo: MODELO_IDEAS,
      sistema: `Eres dietista-nutricionista y cocinero de cocina casera española y mediterránea. Propones platos para un recetario de una app de menús saludables para adultos.
Reglas: platos caseros, equilibrados y apetecibles, con productos de temporada en España (fruta de temporada: ${frutasDelMes(mes).join(', ')}); variedad de legumbres, pescado, verdura, huevo, carne blanca y cereales integrales; pocos ultraprocesados.
Mezcla niveles (sobre todo fácil). Alrededor de 1 de cada 6 platos debe ser en versión sin gluten y 1 de cada 6 sin lactosa (variante), y en ese caso el nombre lo dice.
No repitas ninguno de los platos que ya existen. Nombres cortos, sin cantidades.`,
      mensaje: `Propón exactamente ${pedir} platos nuevos. Reparto por tipo de comida: ${reparto}.

Platos que ya existen (no los repitas):
${[...ideas.map((i) => i.plato), ...filas.slice(0, 400).map((f) => f.nombre)].join(', ') || '(ninguno)'}`,
      esquema: ESQUEMA,
      maxTokens: 16000,
    });
    for (const i of r.platos ?? []) {
      const clave = normalizar(texto(i.plato, 80));
      if (!clave || !TIPOS.includes(i.tipo_comida) || vistos.has(clave)) continue;
      vistos.add(clave);
      ideas.push({ ...i, plato: texto(i.plato, 80), descripcion: texto(i.descripcion, 200), nivel: (['facil', 'medio', 'elaborado'] as const).includes(i.nivel) ? i.nivel : 'facil' });
    }
  }
  return ideas.slice(0, cantidad);
}

const restriccionDe = (idea: Pick<Idea, 'variante' | 'airfryer'>) =>
  restriccionesDe(
    idea.variante === 'sin_gluten' ? ['gluten'] : idea.variante === 'sin_lactosa' ? ['lactosa'] : [],
    [],
    idea.airfryer ? ['horno', 'microondas', 'airfryer'] : undefined,
  );

// Platos de airfryer que aún no están en el recetario (por su nombre).
async function ideasAirfryer(admin: Cliente): Promise<Idea[]> {
  const { data } = await admin.from('recetas').select('nombre_norm').is('privada_de', null).limit(10000);
  const existentes = (data ?? []).map((r) => String(r.nombre_norm));
  return AIRFRYER.filter(([plato]) => {
    const n = normalizar(plato);
    return !existentes.some((e) => e === n || e.startsWith(`${n} `));
  }).map(([plato, tipo_comida, nivel]) => ({
    plato,
    descripcion: 'Plato casero hecho en airfryer (freidora de aire): crujiente y con muy poco aceite.',
    tipo_comida,
    nivel,
    variante: 'normal' as const,
    airfryer: true,
  }));
}

// Platos típicos españoles que aún no están en el recetario (por su nombre).
async function ideasTipicas(admin: Cliente): Promise<Idea[]> {
  const { data } = await admin.from('recetas').select('nombre_norm').is('privada_de', null).limit(10000);
  const existentes = (data ?? []).map((r) => String(r.nombre_norm));
  return TIPICAS.filter(([plato]) => {
    const n = normalizar(plato);
    return !existentes.some((e) => e === n || e.startsWith(`${n} `));
  }).map(([plato, tipo_comida, nivel]) => ({
    plato,
    descripcion:
      'Plato tradicional de la cocina española. Respeta la receta clásica y su nombre, en versión casera, con la ración y la grasa justas sin que pierda su esencia.',
    tipo_comida,
    nivel,
    variante: 'normal' as const,
  }));
}

// Especiales de temporada: los platos que ya existen se enlazan (sin gastar nada); los que faltan, a un lote.
// Se preparan los especiales en marcha o que empiezan en los próximos 21 días.
async function ideasEspeciales(admin: Cliente, especiales: Especial[]): Promise<{ ideas: Idea[]; enlazadas: number }> {
  const { data } = await admin.from('recetas').select('id, nombre_norm').is('privada_de', null).limit(10000);
  const existentes = (data ?? []) as { id: number; nombre_norm: string }[];
  // Lo que ya está pedido en un lote sin recoger no se vuelve a pedir.
  const { data: abiertos } = await admin.from('lotes_ia').select('datos').eq('tipo', 'recetas').eq('estado', 'enviado');
  const enCola = new Set(
    (abiertos ?? []).flatMap((l) => Object.values((l.datos as { ideas?: Record<string, Idea> })?.ideas ?? {}).map((i) => normalizar(i.plato))),
  );
  const ideas: Idea[] = [];
  const enlaces: { especial: string; receta_id: number }[] = [];
  for (const e of especiales) {
    for (const [plato, tipo, nivel] of e.platos) {
      const n = normalizar(plato);
      const ya = existentes.find((r) => r.nombre_norm === n || r.nombre_norm.startsWith(`${n} `));
      if (ya) enlaces.push({ especial: e.clave, receta_id: ya.id });
      else if (!enCola.has(n)) {
        enCola.add(n);
        ideas.push({
          plato,
          descripcion: `Receta del «${e.titulo}». ${e.descripcion}`,
          tipo_comida: tipo === 'otro' ? 'merienda' : tipo,
          nivel,
          variante: 'normal',
          especial: e.clave,
          otro: tipo === 'otro',
        });
      }
    }
  }
  if (enlaces.length) await admin.from('especial_recetas').upsert(enlaces, { onConflict: 'especial,receta_id', ignoreDuplicates: true });
  return { ideas, enlazadas: enlaces.length };
}

const extraEspecial = (clave: string) => {
  const e = especialPorClave(clave);
  return e
    ? `\n- RECETA ESPECIAL del «${e.titulo}»: plato de fiesta o de temporada. Respeta la receta tradicional y su nombre. Si es un dulce o algo contundente, puede serlo: hazlo casero y, si se puede, un poco más ligero sin que pierda su esencia, con una ración normal (no hace falta que ronde las kcal indicadas). Estima con cuidado azúcares, grasas saturadas y sal por ración.`
    : '';
};

async function enviarRecetas(admin: Cliente, pedidas: number, lista: 'ideas' | 'tipicas' | 'airfryer' | 'especiales' = 'ideas', especiales: Especial[] = []) {
  const cupo = await cupoRecetas(admin);
  // Lo que ya está en lotes sin recoger también cuenta para el cupo del mes.
  const { data: abiertos } = await admin.from('lotes_ia').select('datos').eq('tipo', 'recetas').eq('estado', 'enviado');
  const enCola = (abiertos ?? []).reduce((s, l) => s + Object.keys((l.datos as { ideas?: object })?.ideas ?? {}).length, 0);
  const cantidad = Math.min(MAX_POR_LOTE, Math.max(1, Math.round(pedidas) || MAX_POR_LOTE), cupo.quedan - enCola);
  if (cantidad <= 0) return { enviadas: 0, aviso: `Este mes ya no quedan recetas nuevas en el cupo (${cupo.tope}).` };
  const mes = mesDe(hoyEspana());
  const ideas =
    lista === 'tipicas'
      ? (await ideasTipicas(admin)).slice(0, cantidad)
      : lista === 'airfryer'
        ? (await ideasAirfryer(admin)).slice(0, cantidad)
        : lista === 'especiales'
          ? (await ideasEspeciales(admin, especiales)).ideas.slice(0, cantidad)
          : await ideasNuevas(admin, cantidad, mes);
  if (lista === 'tipicas' && !ideas.length) return { enviadas: 0, aviso: 'Ya están todas las recetas típicas en el recetario.' };
  if (lista === 'airfryer' && !ideas.length) return { enviadas: 0, aviso: 'Ya están todas las recetas de airfryer en el recetario.' };
  if (lista === 'especiales' && !ideas.length) return { enviadas: 0, aviso: 'Los próximos especiales ya tienen todas sus recetas.' };
  if (!ideas.length) return { enviadas: 0, aviso: 'No se han podido preparar ideas de platos. Prueba otra vez.' };
  const porClave: Record<string, Idea> = {};
  const peticiones = ideas.map((i, n) => {
    const id = `r${n}`;
    porClave[id] = i;
    return {
      id,
      peticion: {
        modelo: modeloReceta(i.tipo_comida),
        sistema: sistemaReceta(i.tipo_comida, i.nivel, restriccionDe(i), mes, i.airfryer === true) + (i.especial ? extraEspecial(i.especial) : ''),
        mensaje: mensajeReceta(i.plato, i.descripcion, i.tipo_comida),
        esquema: i.especial ? ESQUEMA_RECETA_COMPLETA : ESQUEMA_RECETA,
        maxTokens: 6000,
      },
    };
  });
  const loteId = await crearLote(peticiones);
  await admin.from('lotes_ia').insert({ tipo: 'recetas', proveedor_id: loteId, datos: { ideas: porClave } });
  return { enviadas: ideas.length };
}

// Fotos que faltan: van a lotes de Google (mitad de precio). Si Google no acepta el lote, se hacen de una en una
// con la cola de aligerar-fotos (más caro, pero nunca se quedan sin hacer).
const FOTOS_POR_LOTE = 40;
const MAX_LOTES_FOTOS = 25;
async function enviarFotos(admin: Cliente, _pedidas: number) {
  const { data } = await admin
    .from('recetas')
    .select('id, nombre, ingredientes(nombre, orden, unidad)')
    .is('imagen', null)
    .is('privada_de', null)
    .eq('foto_en_lote', false)
    .or('oculta.eq.false,espera_foto.eq.true')
    .order('created_at', { ascending: false })
    .limit(FOTOS_POR_LOTE * MAX_LOTES_FOTOS);
  const recetas = (data ?? []) as { id: number; nombre: string; ingredientes: { nombre: string; orden: number; unidad: string | null }[] }[];
  if (!recetas.length) return { enviadas: 0, aviso: 'Todas las recetas tienen ya su foto (o están en un lote).' };
  let enviadas = 0;
  for (let i = 0; i < recetas.length; i += FOTOS_POR_LOTE) {
    const grupo = recetas.slice(i, i + FOTOS_POR_LOTE);
    try {
      const nombre = await crearLoteFotos(
        grupo.map((r) => ({
          clave: `f${r.id}`,
          prompt: promptDe(r.nombre, [...(r.ingredientes ?? [])].filter((x) => x.unidad !== 'al gusto').sort((a, b) => a.orden - b.orden).map((x) => x.nombre)),
        })),
      );
      await admin.from('recetas').update({ foto_en_lote: true }).in('id', grupo.map((r) => r.id));
      await admin.from('lotes_ia').insert({ tipo: 'fotos', proveedor_id: nombre, datos: { recetas: grupo.map((r) => r.id) } });
      enviadas += grupo.length;
    } catch (e) {
      console.error('sembrar-recetas: lote de fotos no aceptado, se hacen de una en una:', mensajeTecnico(e));
      await apuntarError('sembrar-recetas', 'fotos', `Lote de fotos no aceptado: ${mensajeTecnico(e)}`);
      for (let k = 0; k < 3; k++) seguirAligerando(0);
      return { enviadas, aviso: `Google no ha aceptado el lote: ${recetas.length - enviadas} fotos se harán de una en una (algo más caro).`, errores: [mensajeTecnico(e)] };
    }
  }
  return { enviadas, aviso: `${enviadas} fotos enviadas a Google a mitad de precio. Suelen tardar unas horas; las recetas aparecen cuando tienen su foto.` };
}

// Recoge un lote de fotos poco a poco (FOTOS_POR_TANDA cada vez, leyendo el archivo de Google línea a línea).
// Si el lote falla o tarda más de 26 h, sus fotos pasan a hacerse de una en una.
const FOTOS_POR_TANDA = 6;
const MAX_ESPERA_LOTE_MS = 26 * 3600 * 1000;
async function recogerFotos(
  admin: Cliente,
  lote: { id: number; proveedor_id: string; created_at: string; datos: { recetas?: number[]; hechas?: string[] }; resultado?: Record<string, number> | null },
) {
  const ids = lote.datos.recetas ?? [];
  const previas = Number(lote.resultado?.guardadas) || 0;
  const soltar = async () => {
    await admin.from('recetas').update({ foto_en_lote: false }).in('id', ids).is('imagen', null);
    for (let k = 0; k < 3; k++) seguirAligerando(0);
  };
  const estado = await estadoLoteFotos(lote.proveedor_id);
  if (estado.estado === 'pendiente') {
    if (Date.now() - new Date(lote.created_at).getTime() < MAX_ESPERA_LOTE_MS) return null;
    await soltar();
    return { guardadas: previas, terminado: true, caducado: true };
  }
  if (estado.estado === 'fallido' || !estado.archivo) {
    await soltar();
    return { guardadas: previas, terminado: true, fallido: true };
  }
  const hechas = new Set(lote.datos.hechas ?? []);
  let guardadas = previas;
  const leidas = await leerFotosDelLote(estado.archivo, hechas, FOTOS_POR_TANDA, async (clave, foto) => {
    const id = Number(clave.slice(1));
    if (!foto || !ids.includes(id)) return;
    try {
      const imagen = await guardarOriginal(admin, id, foto.bytes, foto.tipo);
      await admin.from('recetas').update({ imagen, imagen_mini: null, foto_modelo: MODELO_FOTO, foto_en_lote: false }).eq('id', id);
      guardadas++;
    } catch (e) {
      console.error('sembrar-recetas: no se guardó una foto:', mensajeTecnico(e));
    }
  });
  for (const c of leidas.hechas) hechas.add(c);
  const terminado = leidas.alFinal || ids.every((id) => hechas.has(`f${id}`));
  const coste_usd = Math.round(guardadas * (FOTO_USD / 2) * 10000) / 10000;
  await admin.from('lotes_ia').update({ datos: { ...lote.datos, hechas: [...hechas] }, resultado: { guardadas, coste_usd } }).eq('id', lote.id);
  // Las fotos guardadas se aligeran (y sus recetas aparecen) con la cola de aligerar-fotos.
  if (leidas.hechas.length) seguirAligerando(0);
  if (terminado) await soltar();
  return { guardadas, coste_usd, terminado };
}

// Recoge un lote de recetas terminado: revisa cada receta (alergias) y la guarda. Por tandas de POR_TANDA,
// para no pasarse del límite de CPU de la función; lo que falta se sigue en la siguiente llamada (se llama sola).
const POR_TANDA = 12;
async function recogerRecetas(
  admin: Cliente,
  lote: { id: number; proveedor_id: string; datos: { ideas?: Record<string, Idea>; hechas?: string[] }; resultado?: Record<string, number> | null },
) {
  const estado = await estadoLote(lote.proveedor_id);
  if (!estado.terminado || !estado.urlResultados) return null;
  const resultados = await resultadosLote(estado.urlResultados);
  const ideas = lote.datos.ideas ?? {};
  const hechas = new Set(lote.datos.hechas ?? []);
  const previo = lote.resultado ?? {};
  let creadas = Number(previo.creadas) || 0;
  let descartadas = Number(previo.descartadas) || 0;
  let costeUsd = Number(previo.coste_usd) || 0;
  let quedan = (await cupoRecetas(admin)).quedan;
  let enEsta = 0;
  for (const [clave, mensaje] of resultados) {
    if (hechas.has(clave)) continue;
    if (enEsta >= POR_TANDA) break;
    enEsta++;
    hechas.add(clave);
    const idea = ideas[clave];
    if (!idea || !mensaje) {
      descartadas++;
      continue;
    }
    // Los lotes cuestan la mitad.
    costeUsd += costeTokens(String(mensaje.model ?? modeloReceta(idea.tipo_comida)), mensaje.usage ?? {}) / 2;
    if (quedan <= 0) {
      descartadas++;
      continue;
    }
    let receta: RecetaIA | null = null;
    try {
      receta = leerJSON<RecetaIA>(mensaje);
    } catch {
      receta = null;
    }
    const restr = restriccionDe(idea);
    // Los platos de airfryer siempre quedan marcados como tales.
    if (receta && idea.airfryer && !(receta.aparatos ?? []).includes('airfryer')) receta.aparatos = [...(receta.aparatos ?? []).filter((a) => a !== 'horno'), 'airfryer'];
    if (problemaReceta(receta, restr)) {
      descartadas++;
      continue;
    }
    try {
      const r = receta as RecetaIA;
      const guardada = await guardarReceta(admin, r, idea.otro ? 'otro' : idea.tipo_comida, restr, String(mensaje.model ?? modeloReceta(idea.tipo_comida)), {
        esperaFoto: true,
        ...(idea.especial ? { soloEspecial: true, avisos: avisosNutricion(r.nutricion as never) } : {}),
      });
      if (idea.especial) {
        await admin.from('especial_recetas').upsert({ especial: idea.especial, receta_id: guardada.id }, { onConflict: 'especial,receta_id', ignoreDuplicates: true });
      }
      creadas++;
      quedan--;
    } catch (e) {
      console.error('sembrar-recetas: no se guardó una receta:', mensajeTecnico(e));
      descartadas++;
    }
  }
  const resultado = { creadas, descartadas, coste_usd: Math.round(costeUsd * 10000) / 10000 };
  const terminado = [...resultados.keys()].every((k) => hechas.has(k));
  await admin.from('lotes_ia').update({ datos: { ...lote.datos, hechas: [...hechas] }, resultado }).eq('id', lote.id);
  return { ...resultado, terminado, nuevas: enEsta };
}

// Vuelve a llamarse a sí misma para seguir recogiendo (con la clave interna de tareas).
async function seguirRecogiendo(admin: Cliente, accion = 'estado') {
  const { data } = await admin.from('ajustes_internos').select('clave_tareas').eq('id', 1).maybeSingle();
  if (!data?.clave_tareas) return;
  const tarea = fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/sembrar-recetas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-tarea': data.clave_tareas },
    body: JSON.stringify({ accion }),
  }).catch(() => {});
  // deno-lint-ignore no-explicit-any
  const er = (globalThis as any).EdgeRuntime;
  if (er?.waitUntil) er.waitUntil(tarea);
}

// Recetas de horno ya guardadas: se pregunta (modelo barato, de 25 en 25) si se pueden hacer en airfryer y cómo.
// nota_airfryer vacío ('') = revisada y no se adapta; null = sin revisar.
const NOTAS_POR_TANDA = 25;
async function notasAirfryer(admin: Cliente) {
  const { data } = await admin
    .from('recetas')
    .select('id, nombre, pasos')
    .contains('aparatos', ['horno'])
    .is('nota_airfryer', null)
    .is('privada_de', null)
    .order('id')
    .limit(NOTAS_POR_TANDA);
  const recetas = (data ?? []) as { id: number; nombre: string; pasos: string[] }[];
  if (!recetas.length) return { revisadas: 0, aviso: 'Todas las recetas de horno están revisadas para airfryer.' };
  const r = await pedirJSON<{ recetas: { id: number; nota: string }[] }>({
    modelo: MODELO_IDEAS,
    sistema: `Eres cocinero y sabes usar la airfryer (freidora de aire). Para cada receta que se hace al horno, di si se puede hacer igual de bien en una airfryer doméstica de unos 4-5 litros para una ración.
Si se puede, "nota": una sola frase práctica con temperatura en °C, minutos y si hay que darle la vuelta o agitar (por ejemplo: "En airfryer: 180 °C durante 15 minutos, dándole la vuelta a mitad."). Empieza siempre por "En airfryer:".
Si no queda bien (masas que suben mucho, bandejas grandes, líquidos, gratinados grandes), "nota" vacía.`,
    mensaje: recetas.map((x) => `${x.id} · ${x.nombre}\n${(x.pasos ?? []).join(' ')}`).join('\n\n'),
    esquema: {
      type: 'object',
      additionalProperties: false,
      required: ['recetas'],
      properties: {
        recetas: {
          type: 'array',
          items: { type: 'object', additionalProperties: false, required: ['id', 'nota'], properties: { id: { type: 'integer' }, nota: { type: 'string' } } },
        },
      },
    },
    maxTokens: 6000,
  });
  const notas = new Map((r.recetas ?? []).map((x) => [Number(x.id), texto(x.nota, 300)]));
  let adaptadas = 0;
  for (const x of recetas) {
    const nota = notas.get(x.id) ?? '';
    if (nota) adaptadas++;
    await admin.from('recetas').update({ nota_airfryer: nota }).eq('id', x.id);
  }
  // Quedan más: se sigue sola.
  if (recetas.length === NOTAS_POR_TANDA) seguirRecogiendo(admin, 'notas_airfryer');
  return { revisadas: recetas.length, adaptadas, aviso: `${recetas.length} recetas de horno revisadas para airfryer (${adaptadas} se pueden hacer en airfryer).` };
}

async function estado(admin: Cliente) {
  // Se mira un lote de recetas cada vez (el que lleva más tiempo sin mirarse). GitHub lo pregunta cada 30 minutos.
  const { data: abiertos } = await admin
    .from('lotes_ia')
    .select('id, tipo, proveedor_id, datos, resultado, revisado_at, created_at')
    .eq('estado', 'enviado')
    .order('revisado_at', { ascending: true, nullsFirst: true })
    .order('created_at')
    .limit(1);
  const errores: string[] = [];
  let fotosNuevas = false;
  for (const lote of abiertos ?? []) {
    try {
      await admin.from('lotes_ia').update({ revisado_at: new Date().toISOString() }).eq('id', lote.id);
      if (lote.tipo === 'fotos') {
        const f = await recogerFotos(admin, lote as never);
        if (f && !f.terminado) {
          seguirRecogiendo(admin);
          continue;
        }
        if (f) {
          const malo = 'fallido' in f || 'caducado' in f;
          await admin
            .from('lotes_ia')
            .update({ estado: malo ? 'fallido' : 'terminado', resultado: { guardadas: f.guardadas, ...('coste_usd' in f ? { coste_usd: f.coste_usd } : {}) }, terminado_at: new Date().toISOString() })
            .eq('id', lote.id);
        }
        continue;
      }
      const r = await recogerRecetas(admin, lote as never);
      if (r && r.nuevas > 0) fotosNuevas = true;
      if (r && !r.terminado) {
        seguirRecogiendo(admin);
        continue;
      }
      if (r) {
        await admin
          .from('lotes_ia')
          .update({ estado: 'terminado', resultado: { creadas: r.creadas, descartadas: r.descartadas, coste_usd: r.coste_usd }, terminado_at: new Date().toISOString() })
          .eq('id', lote.id);
      }
    } catch (e) {
      errores.push(mensajeTecnico(e));
    }
  }
  // Especiales de temporada: una vez al día se preparan los que empiezan pronto (si les faltan recetas).
  try {
    const { data: ultimo } = await admin.from('ajustes_internos').select('especiales_at').eq('id', 1).maybeSingle();
    const hace = Date.now() - new Date(String(ultimo?.especiales_at ?? 0)).getTime();
    if (!ultimo?.especiales_at || hace > 20 * 3600 * 1000) {
      await admin.from('ajustes_internos').update({ especiales_at: new Date().toISOString() }).eq('id', 1);
      await enviarRecetas(admin, MAX_POR_LOTE, 'especiales', especialesProximos(hoyEspana(), 21));
    }
  } catch (e) {
    errores.push(mensajeTecnico(e));
  }
  // Las recetas nuevas del recetario van a un lote de fotos (mitad de precio).
  if (fotosNuevas) {
    try {
      await enviarFotos(admin, 0);
    } catch (e) {
      errores.push(mensajeTecnico(e));
    }
  }
  // Cola de fotos: aligera las que llegaron de los lotes y, como plan B, hace las que no están en ningún lote.
  try {
    const hace = new Date(Date.now() - 3 * 60 * 1000).toISOString();
    const [{ count: sinFoto }, { count: sinMini }, { count: enMarcha }] = await Promise.all([
      admin.from('recetas').select('id', { count: 'exact', head: true }).is('imagen', null).is('privada_de', null).eq('foto_en_lote', false).or('oculta.eq.false,espera_foto.eq.true'),
      admin.from('recetas').select('id', { count: 'exact', head: true }).not('imagen', 'is', null).is('imagen_mini', null),
      admin.from('recetas').select('id', { count: 'exact', head: true }).gt('foto_pedida_at', hace),
    ]);
    if (((sinFoto ?? 0) > 0 || (sinMini ?? 0) > 0) && !(enMarcha ?? 0)) for (let i = 0; i < 3; i++) seguirAligerando(0);
  } catch (e) {
    errores.push(mensajeTecnico(e));
  }
  const [{ data: lotes }, cupo] = await Promise.all([
    admin.from('lotes_ia').select('id, tipo, estado, datos, resultado, created_at, terminado_at').order('created_at', { ascending: false }).limit(10),
    cupoRecetas(admin),
  ]);
  return {
    lotes: (lotes ?? []).map((l) => ({
      id: l.id,
      tipo: l.tipo,
      estado: l.estado,
      cantidad: l.tipo === 'recetas' ? Object.keys((l.datos as { ideas?: object })?.ideas ?? {}).length : ((l.datos as { recetas?: number[] })?.recetas ?? []).length,
      resultado: l.resultado,
      created_at: l.created_at,
      terminado_at: l.terminado_at,
    })),
    cupo,
    errores: errores.slice(0, 3),
  };
}

async function sembrar(req: Request): Promise<Response> {
  const { usuario, admin } = crearClientes(req);
  // Tareas lanzadas desde GitHub (con la clave interna guardada en la base de datos) o por un administrador con sesión.
  const claveTarea = req.headers.get('x-tarea') ?? '';
  let permitido = false;
  if (claveTarea.length >= 32) {
    const { data } = await admin.from('ajustes_internos').select('clave_tareas').eq('id', 1).maybeSingle();
    permitido = !!data?.clave_tareas && data.clave_tareas === claveTarea;
  }
  if (!permitido) {
    const { data: auth } = await usuario.auth.getUser();
    const user = auth?.user;
    if (!user) return fallo(401, 'no_autenticado', 'Vuelve a entrar en tu cuenta.');
    const { data: esAdmin } = await admin.from('admins').select('user_id').eq('user_id', user.id).maybeSingle();
    if (!esAdmin) return fallo(403, 'no_admin', 'Solo el administrador puede hacer esto.');
  }

  const cuerpo = (await req.json().catch(() => ({}))) as { accion?: string; cantidad?: number };
  if (cuerpo.accion === 'enviar') return responder({ ok: true, ...(await enviarRecetas(admin, Number(cuerpo.cantidad))), lotes: [], cupo: await cupoRecetas(admin) });
  if (cuerpo.accion === 'tipicas') return responder({ ok: true, ...(await enviarRecetas(admin, MAX_POR_LOTE, 'tipicas')), lotes: [], cupo: await cupoRecetas(admin) });
  if (cuerpo.accion === 'especiales') {
    return responder({ ok: true, ...(await enviarRecetas(admin, MAX_POR_LOTE, 'especiales', especialesProximos(hoyEspana(), 21))), lotes: [], cupo: await cupoRecetas(admin) });
  }
  if (cuerpo.accion === 'airfryer') return responder({ ok: true, ...(await enviarRecetas(admin, MAX_POR_LOTE, 'airfryer')), lotes: [], cupo: await cupoRecetas(admin) });
  if (cuerpo.accion === 'notas_airfryer') return responder({ ok: true, ...(await notasAirfryer(admin)), lotes: [], cupo: await cupoRecetas(admin) });
  if (cuerpo.accion === 'fotos') return responder({ ok: true, ...(await enviarFotos(admin, Number(cuerpo.cantidad))), ...(await estado(admin)) });
  return responder({ ok: true, ...(await estado(admin)) });
}

servir('sembrar-recetas', sembrar, 'No se ha podido completar. Vuelve a intentarlo en un momento.');
