// sembrar-recetas: carga del recetario compartido y fotos, por LOTES a mitad de precio. Solo para administradores.
// - enviar: pide ideas de platos (llamada barata) y manda las recetas a un lote de Claude.
// - tipicas: como enviar, con la lista de platos típicos españoles.
// - fotos: pone en marcha la cola de fotos (aligerar-fotos), que hace las que faltan de una en una.
// - estado: recoge los lotes de recetas terminados y enseña cómo van.
// Respeta el cupo global de recetas del mes, revisa alergias igual que siempre y no cobra nada a ningún cliente.
import { restriccionesDe } from '../_shared/alergenos.ts';
import { crearLote, estadoLote, leerJSON, pedirJSON, resultadosLote } from '../_shared/claude.ts';
import { costeTokens } from '../_shared/costes.ts';
import { crearClientes, fallo, hoyEspana, mensajeTecnico, responder, servir, type Cliente } from '../_shared/http.ts';
import { seguirAligerando } from '../_shared/fotos.ts';
import type { TipoComida } from '../_shared/nutricion.ts';
import {
  cupoRecetas,
  ESQUEMA_RECETA,
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

const MODELO_IDEAS = Deno.env.get('MODELO_MENU') || 'claude-haiku-5-5';
const MAX_POR_LOTE = 200;
const IDEAS_POR_LLAMADA = 50;
const TIPOS: TipoComida[] = ['desayuno', 'media_manana', 'almuerzo', 'merienda', 'cena'];
// Reparto aproximado del recetario: más comidas y cenas, que son las que más variedad necesitan.
const REPARTO: [TipoComida, number][] = [['desayuno', 0.18], ['media_manana', 0.14], ['almuerzo', 0.28], ['merienda', 0.14], ['cena', 0.26]];

interface Idea {
  plato: string;
  descripcion: string;
  tipo_comida: TipoComida;
  nivel: Nivel;
  variante: 'normal' | 'sin_gluten' | 'sin_lactosa';
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
      maxTokens: 6000,
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

const restriccionDe = (variante: Idea['variante']) => restriccionesDe(variante === 'sin_gluten' ? ['gluten'] : variante === 'sin_lactosa' ? ['lactosa'] : [], []);

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

async function enviarRecetas(admin: Cliente, pedidas: number, tipicas = false) {
  const cupo = await cupoRecetas(admin);
  // Lo que ya está en lotes sin recoger también cuenta para el cupo del mes.
  const { data: abiertos } = await admin.from('lotes_ia').select('datos').eq('tipo', 'recetas').eq('estado', 'enviado');
  const enCola = (abiertos ?? []).reduce((s, l) => s + Object.keys((l.datos as { ideas?: object })?.ideas ?? {}).length, 0);
  const cantidad = Math.min(MAX_POR_LOTE, Math.max(1, Math.round(pedidas) || MAX_POR_LOTE), cupo.quedan - enCola);
  if (cantidad <= 0) return { enviadas: 0, aviso: `Este mes ya no quedan recetas nuevas en el cupo (${cupo.tope}).` };
  const mes = mesDe(hoyEspana());
  const ideas = tipicas ? (await ideasTipicas(admin)).slice(0, cantidad) : await ideasNuevas(admin, cantidad, mes);
  if (tipicas && !ideas.length) return { enviadas: 0, aviso: 'Ya están todas las recetas típicas en el recetario.' };
  if (!ideas.length) return { enviadas: 0, aviso: 'No se han podido preparar ideas de platos. Prueba otra vez.' };
  const porClave: Record<string, Idea> = {};
  const peticiones = ideas.map((i, n) => {
    const id = `r${n}`;
    porClave[id] = i;
    return {
      id,
      peticion: {
        modelo: modeloReceta(i.tipo_comida),
        sistema: sistemaReceta(i.tipo_comida, i.nivel, restriccionDe(i.variante), mes),
        mensaje: mensajeReceta(i.plato, i.descripcion, i.tipo_comida),
        esquema: ESQUEMA_RECETA,
        maxTokens: 4000,
      },
    };
  });
  const loteId = await crearLote(peticiones);
  await admin.from('lotes_ia').insert({ tipo: 'recetas', proveedor_id: loteId, datos: { ideas: porClave } });
  return { enviadas: ideas.length };
}

// Fotos que faltan: se hacen en segundo plano, de una en una, con la cola de aligerar-fotos (3 a la vez).
// Antes iban por lotes de Google, pero recoger un lote con decenas de fotos se pasaba de memoria.
async function enviarFotos(admin: Cliente, _pedidas: number) {
  const { count } = await admin
    .from('recetas')
    .select('id', { count: 'exact', head: true })
    .is('imagen', null)
    .is('privada_de', null)
    .or('oculta.eq.false,espera_foto.eq.true');
  if (!count) return { enviadas: 0, aviso: 'Todas las recetas tienen ya su foto.' };
  for (let i = 0; i < 3; i++) seguirAligerando(0);
  return { enviadas: count, aviso: `Haciendo ${count} fotos en segundo plano (unas 3 por minuto). Las recetas nuevas aparecen al tener su foto.` };
}

// Recoge un lote de recetas terminado: revisa cada receta (alergias) y la guarda.
async function recogerRecetas(admin: Cliente, lote: { id: number; proveedor_id: string; datos: { ideas?: Record<string, Idea> } }) {
  const estado = await estadoLote(lote.proveedor_id);
  if (!estado.terminado || !estado.urlResultados) return null;
  const resultados = await resultadosLote(estado.urlResultados);
  const ideas = lote.datos.ideas ?? {};
  let creadas = 0;
  let descartadas = 0;
  let costeUsd = 0;
  let quedan = (await cupoRecetas(admin)).quedan;
  for (const [clave, mensaje] of resultados) {
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
    const restr = restriccionDe(idea.variante);
    if (problemaReceta(receta, restr)) {
      descartadas++;
      continue;
    }
    try {
      await guardarReceta(admin, receta as RecetaIA, idea.tipo_comida, restr, String(mensaje.model ?? modeloReceta(idea.tipo_comida)), { esperaFoto: true });
      creadas++;
      quedan--;
    } catch (e) {
      console.error('sembrar-recetas: no se guardó una receta:', mensajeTecnico(e));
      descartadas++;
    }
  }
  return { creadas, descartadas, coste_usd: Math.round(costeUsd * 10000) / 10000 };
}

async function estado(admin: Cliente) {
  // Se mira un lote de recetas cada vez (el que lleva más tiempo sin mirarse). GitHub lo pregunta cada 30 minutos.
  const { data: abiertos } = await admin
    .from('lotes_ia')
    .select('id, tipo, proveedor_id, datos, revisado_at')
    .eq('estado', 'enviado')
    .eq('tipo', 'recetas')
    .order('revisado_at', { ascending: true, nullsFirst: true })
    .order('created_at')
    .limit(1);
  const errores: string[] = [];
  let fotosNuevas = false;
  for (const lote of abiertos ?? []) {
    try {
      await admin.from('lotes_ia').update({ revisado_at: new Date().toISOString() }).eq('id', lote.id);
      const r = await recogerRecetas(admin, lote as never);
      if (r && r.creadas > 0) fotosNuevas = true;
      if (r) {
        await admin
          .from('lotes_ia')
          .update({ estado: 'terminado', resultado: r, terminado_at: new Date().toISOString() })
          .eq('id', lote.id);
      }
    } catch (e) {
      errores.push(mensajeTecnico(e));
    }
  }
  // Cola de fotos: si falta alguna foto (o su versión ligera) y la cola no está en marcha, se pone en marcha.
  try {
    const hace = new Date(Date.now() - 3 * 60 * 1000).toISOString();
    const [{ count: sinFoto }, { count: sinMini }, { count: enMarcha }] = await Promise.all([
      admin.from('recetas').select('id', { count: 'exact', head: true }).is('imagen', null).is('privada_de', null).or('oculta.eq.false,espera_foto.eq.true'),
      admin.from('recetas').select('id', { count: 'exact', head: true }).not('imagen', 'is', null).is('imagen_mini', null),
      admin.from('recetas').select('id', { count: 'exact', head: true }).gt('foto_pedida_at', hace),
    ]);
    if (fotosNuevas || (((sinFoto ?? 0) > 0 || (sinMini ?? 0) > 0) && !(enMarcha ?? 0))) for (let i = 0; i < 3; i++) seguirAligerando(0);
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
  if (cuerpo.accion === 'enviar') return responder({ ok: true, ...(await enviarRecetas(admin, Number(cuerpo.cantidad))), ...(await estado(admin)) });
  if (cuerpo.accion === 'tipicas') return responder({ ok: true, ...(await enviarRecetas(admin, MAX_POR_LOTE, true)), ...(await estado(admin)) });
  if (cuerpo.accion === 'fotos') return responder({ ok: true, ...(await enviarFotos(admin, Number(cuerpo.cantidad))), ...(await estado(admin)) });
  return responder({ ok: true, ...(await estado(admin)) });
}

servir('sembrar-recetas', sembrar, 'No se ha podido completar. Vuelve a intentarlo en un momento.');
