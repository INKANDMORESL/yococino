// Recetas compartidas: catálogo, creación con la IA (con revisión de alergias) y guardado.
// Las recetas son para una ración estándar; cada persona tiene su factor en comidas.factor.
import { ALERGENOS_UE, describirRestricciones, motivosNoApta, type Restricciones } from './alergenos.ts';
import { ErrorIA, pedirJSON } from './claude.ts';
import type { Cliente } from './http.ts';
import { KCAL_RACION_ESTANDAR, type TipoComida } from './nutricion.ts';
import { frutasDelMes, frutasFueraDeTemporada } from './temporada.ts';
import { limpiarNombre, normalizar } from './texto.ts';
import { fotoAlCrear } from './fotos.ts';

// Límite global de recetas nuevas al mes (ver migración cupo_recetas): si se llega, no se crean más.
export class ErrorCupo extends Error {
  constructor() {
    super('Este mes ya hemos creado todas las recetas nuevas previstas. Mientras tanto, usamos las que ya tenemos.');
    this.name = 'ErrorCupo';
  }
}

// Cuántas recetas nuevas quedan este mes entre todos los clientes.
export async function cupoRecetas(admin: Cliente): Promise<{ tope: number; usadas: number; quedan: number }> {
  const { data, error } = await admin.rpc('cupo_recetas');
  if (error) throw error;
  const fila = (Array.isArray(data) ? data[0] : data) as { tope: number; usadas: number } | null;
  const tope = Number(fila?.tope) || 0;
  const usadas = Number(fila?.usadas) || 0;
  return { tope, usadas, quedan: Math.max(0, tope - usadas) };
}

export const MODELO_RECETA = Deno.env.get('MODELO_RECETA') || 'claude-sonnet-5-5';
// Desayunos, medias mañanas y meriendas son sencillos: modelo barato. Si su receta no pasa la revisión, se repite con el bueno.
export const MODELO_RECETA_SENCILLA = Deno.env.get('MODELO_RECETA_SENCILLA') || 'claude-haiku-5-5';
const TOMAS_SENCILLAS = ['desayuno', 'media_manana', 'merienda'];
export const modeloReceta = (tipo: string, intento = 0) => (intento === 0 && TOMAS_SENCILLAS.includes(tipo) ? MODELO_RECETA_SENCILLA : MODELO_RECETA);

export type Nivel = 'facil' | 'medio' | 'elaborado';
export const MINUTOS_NIVEL: Record<Nivel, number> = { facil: 20, medio: 40, elaborado: 75 };
export const NIVELES_PERMITIDOS: Record<Nivel, Nivel[]> = { facil: ['facil'], medio: ['facil', 'medio'], elaborado: ['facil', 'medio', 'elaborado'] };
export const NOMBRE_TIPO: Record<TipoComida, string> = {
  desayuno: 'desayuno',
  media_manana: 'media mañana',
  almuerzo: 'almuerzo (comida principal del mediodía)',
  merienda: 'merienda',
  cena: 'cena',
};
const SECCIONES = ['carne_pescado', 'fruta_verdura', 'lacteos', 'cereales', 'despensa', 'congelados'] as const;
const UNIDADES = ['g', 'ml', 'ud', 'cda', 'cdta', 'pizca', 'al gusto'] as const;

export interface RecetaGuardada {
  id: number;
  nombre: string;
  tipo_comida: TipoComida;
  kcal: number | null;
  alergenos: string[];
  ingredientes: { nombre: string; nota: string | null }[];
}

export interface RecetaIA {
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

export const COLUMNAS_RECETA = 'id, nombre, tipo_comida, kcal, alergenos, ingredientes(nombre, nota)';

export const ESQUEMA_RECETA = {
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

export async function enParalelo<T, R>(elementos: T[], limite: number, tarea: (e: T) => Promise<R>): Promise<R[]> {
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

export const esApta = (r: RecetaGuardada, restr: Restricciones) =>
  motivosNoApta({ nombre: r.nombre, alergenos: r.alergenos ?? [], ingredientes: r.ingredientes ?? [] }, restr).length === 0;

export const texto = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
export const listaTextos = (v: unknown, maxItems: number, maxLargo: number) =>
  Array.isArray(v) ? v.map((x) => texto(x, maxLargo)).filter(Boolean).slice(0, maxItems) : [];
const numeroPositivo = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(v * 10) / 10 : null);

// ---------- Recetas ----------

// Con `mes`, se dejan fuera las recetas con fruta fresca fuera de temporada.
export async function cargarCatalogo(admin: Cliente, tipos: TipoComida[], nivel: Nivel, restr: Restricciones, mes: number | null = null, porTipoMax = 30) {
  const { data, error } = await admin
    .from('recetas')
    .select(COLUMNAS_RECETA)
    .in('tipo_comida', tipos)
    .in('nivel', NIVELES_PERMITIDOS[nivel])
    .eq('oculta', false)
    .order('created_at', { ascending: false })
    .limit(800);
  if (error) throw error;
  const porTipo = new Map<TipoComida, RecetaGuardada[]>();
  for (const r of (data ?? []) as RecetaGuardada[]) {
    if (!esApta(r, restr)) continue;
    if (mes && frutasFueraDeTemporada([r.nombre, ...(r.ingredientes ?? []).map((i) => i.nombre)], mes).length) continue;
    const lista = porTipo.get(r.tipo_comida) ?? [];
    if (lista.length < porTipoMax) lista.push(r);
    porTipo.set(r.tipo_comida, lista);
  }
  return [...porTipo.values()].flat();
}

export function sistemaReceta(tipo: TipoComida, nivel: Nivel, restr: Restricciones, mes: number | null = null) {
  return `Eres cocinero y dietista-nutricionista. Escribes recetas caseras de cocina mediterránea española, fáciles de seguir mientras se cocina, para UNA ración de una persona adulta.

Reglas:
- Cantidades exactas, en gramos o mililitros siempre que se pueda. Usa "ud" solo para piezas (un huevo, una manzana). Usa "al gusto" con cantidad null solo para sal, pimienta y especias.
- El aceite, medido: 1 cda son 10 ml de aceite de oliva virgen extra.
- La ración debe rondar ${KCAL_RACION_ESTANDAR[tipo]} kcal, propia de un ${NOMBRE_TIPO[tipo]}.
- Nivel ${nivel}: como máximo ${MINUTOS_NIVEL[nivel]} minutos en total.
- Pasos: entre 2 y 7, cortos, en imperativo, uno por acción. En tomas sencillas bastan 2 o 3.
- 1 o 2 consejos prácticos y 1 o 2 sustituciones saludables con la misma función. Frases cortas.
- Descripción: una sola frase corta.
- Nutrición por ración, estimada con criterio.
- Alérgenos: marca TODOS los de la lista de la UE presentes en cualquier ingrediente, incluidos pan, salsas, caldos y productos elaborados.
- Esta receta debe ser apta por completo para alguien que no puede tomar: ${describirRestricciones(restr)}. Usa sustitutos aptos (por ejemplo, pan sin gluten o yogur sin lactosa).
- Nombre: el del plato tal cual, apetecible y natural. No menciones en el nombre lo que se ha quitado ni las restricciones, y no uses paréntesis (nada de "sin pescado" o "sin gluten"): eso va en las etiquetas.
- Español de España, tono cercano. Sin consejos médicos.${
    mes ? `\n- Si lleva fruta fresca, que sea de temporada en España este mes: ${frutasDelMes(mes).join(', ')}.` : ''
  }`;
}

// opciones.privadaDe: receta que solo ve esa persona (por ejemplo, una guardada de redes con mucho azúcar):
// queda oculta del recetario y con una clave interna propia, para que nunca se reutilice para otra persona.
export async function guardarReceta(
  admin: Cliente,
  r: RecetaIA,
  tipo: TipoComida | 'otro',
  restr: Restricciones,
  modelo = MODELO_RECETA,
  opciones: { privadaDe?: string | null; origenUrl?: string | null } = {},
): Promise<RecetaGuardada> {
  const base = limpiarNombre(texto(r.nombre, 80)) || texto(r.nombre, 80);
  const privada = opciones.privadaDe ?? null;
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
    // Solo en las recetas guardadas de redes (para los avisos de alto contenido).
    ...(['azucares', 'grasas_saturadas', 'sal'] as const).reduce(
      (o, k) => {
        const v = numeroPositivo((r.nutricion as Record<string, unknown> | undefined)?.[k]);
        return v === null ? o : { ...o, [k]: v };
      },
      {} as Record<string, number>,
    ),
  };

  for (let intento = 0; intento < 4; intento++) {
    // El nombre que se ve es siempre el limpio; si ya existe otro plato igual que no es apto, solo cambia la clave interna.
    const nombre = base;
    const clave = privada
      ? normalizar(`${base} privada ${privada.slice(0, 8)} ${Date.now().toString(36)} ${intento}`)
      : normalizar(intento === 0 ? base : intento === 1 ? `${base} ${sufijo}` : `${base} ${sufijo} ${intento}`);
    const { data, error } = await admin
      .from('recetas')
      .insert({
        nombre,
        nombre_norm: clave,
        descripcion: texto(r.descripcion, 200) || null,
        tipo_comida: tipo,
        nivel: (['facil', 'medio', 'elaborado'] as const).includes(r.nivel) ? r.nivel : 'facil',
        minutos: Math.max(1, Math.min(240, Math.round(Number(r.minutos) || 15))),
        raciones: 1,
        pasos: listaTextos(r.pasos, 10, 400),
        consejos: listaTextos(r.consejos, 2, 300),
        sustituciones: listaTextos(r.sustituciones, 2, 300),
        nutricion,
        kcal: nutricion.kcal === null ? null : Math.round(nutricion.kcal),
        alergenos: (r.alergenos ?? []).filter((a) => (ALERGENOS_UE as readonly string[]).includes(a)),
        etiquetas: listaTextos(r.etiquetas, 6, 30),
        modelo,
        ...(privada ? { privada_de: privada, oculta: true } : {}),
        ...(opciones.origenUrl ? { origen_url: opciones.origenUrl.slice(0, 500) } : {}),
      })
      .select('id')
      .single();

    if (error?.code === '23505') {
      // Ya hay una receta con ese nombre: si es apta para esta persona, se usa; si no, se prueba otro nombre.
      const existente = await recetaPorNombre(admin, clave);
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
      tipo_comida: tipo as TipoComida,
      kcal: nutricion.kcal === null ? null : Math.round(nutricion.kcal),
      alergenos: r.alergenos ?? [],
      ingredientes: ingredientes.map((i) => ({ nombre: i.nombre, nota: i.nota })),
    };
  }
  throw new Error('No se encontró un nombre libre para la receta');
}

export async function recetaPorNombre(admin: Cliente, nombreNorm: string): Promise<RecetaGuardada | null> {
  const { data } = await admin.from('recetas').select(COLUMNAS_RECETA).eq('nombre_norm', nombreNorm).maybeSingle();
  return (data as RecetaGuardada | null) ?? null;
}

export const mensajeReceta = (plato: string, descripcion: string, tipo: TipoComida, extra = '') =>
  `Plato: ${plato}\nDescripción: ${descripcion || '—'}\nTipo de comida: ${NOMBRE_TIPO[tipo]}${extra ? `\n\n${extra}` : ''}`;

// Revisión de una receta de la IA (para lotes, donde no se puede repetir): null si está bien, o el motivo.
export function problemaReceta(r: RecetaIA | null, restr: Restricciones): string | null {
  if (!r || !Array.isArray(r.ingredientes) || r.ingredientes.length === 0 || !Array.isArray(r.pasos) || !texto(r.nombre, 80)) return 'incompleta';
  const motivos = motivosNoApta(
    { nombre: r.nombre, alergenos: r.alergenos ?? [], ingredientes: r.ingredientes.map((i) => ({ nombre: i.nombre, nota: i.nota ?? null })) },
    restr,
  );
  return motivos.length ? motivos.join('; ') : null;
}

// Crea una receta nueva con la IA. Si no supera la revisión de alergias, se reintenta una vez
// explicando el motivo. Si vuelve a fallar, devuelve null y ese día no se guarda.
export async function crearReceta(
  admin: Cliente,
  plato: string,
  descripcion: string,
  tipo: TipoComida,
  nivel: Nivel,
  restr: Restricciones,
  extra = '',
  mes: number | null = null,
  conFoto = true,
): Promise<RecetaGuardada | null> {
  if ((await cupoRecetas(admin)).quedan <= 0) throw new ErrorCupo();
  let mensaje = mensajeReceta(plato, descripcion, tipo, extra);
  for (let intento = 0; intento < 2; intento++) {
    let r: RecetaIA;
    const modelo = modeloReceta(tipo, intento);
    try {
      r = await pedirJSON<RecetaIA>({
        modelo,
        sistema: sistemaReceta(tipo, nivel, restr, mes),
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
    // Fruta fuera de temporada: se pide otra vez una sola vez; no es motivo de seguridad, así que la segunda se acepta.
    const fueraTemporada = mes ? frutasFueraDeTemporada([r.nombre, ...r.ingredientes.map((i) => i.nombre)], mes) : [];
    if (motivos.length === 0 && fueraTemporada.length && intento === 0) {
      mensaje += `\n\nLa propuesta anterior usaba fruta fuera de temporada (${fueraTemporada.join(', ')}). Cámbiala por fruta de temporada: ${frutasDelMes(mes as number).join(', ')}.`;
      continue;
    }
    if (motivos.length === 0) {
      const guardada = await guardarReceta(admin, r, tipo, restr, modelo);
      // El plato nuevo sale ya con su foto (si ya existía una receta igual con foto, no se repite).
      if (conFoto) {
        const { data: f } = await admin.from('recetas').select('imagen').eq('id', guardada.id).maybeSingle();
        if (!f?.imagen) {
          await fotoAlCrear(admin, guardada.id, guardada.nombre, r.ingredientes.filter((i) => i.unidad !== 'al gusto').map((i) => i.nombre));
        }
      }
      return guardada;
    }
    mensaje += `\n\nLa propuesta anterior NO era apta (${motivos.join('; ')}). Crea una versión que lo evite por completo.`;
  }
  return null;
}

