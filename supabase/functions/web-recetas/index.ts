// web-recetas: datos públicos para la web yococino.app (la llama GitHub cada día al generar la web).
// - publicar: al principio, de golpe hasta tener 20; después, si hoy aún no hay ninguna, elige una receta
//   (mejor con foto) y escribe su artículo (IA barata) pensado para Google. Como mucho una al día.
// - listar: artículos publicados y recetas destacadas con foto para la portada.
// Solo devuelve datos de recetas (nunca de clientes). El artículo no da la receta al 100 %:
// ingredientes sin cantidades y los primeros pasos; el resto, en la app.
import { pedirJSON } from '../_shared/claude.ts';
import { crearClientes, hoyEspana, responder, servir, type Cliente } from '../_shared/http.ts';
import { normalizar } from '../_shared/texto.ts';
import { enParalelo } from '../_shared/recetas.ts';

const MODELO_WEB = Deno.env.get('MODELO_WEB') || 'claude-haiku-5-5';
const PASOS_VISIBLES = 3;
// Arranque: mientras haya menos de 20 publicadas, se publican de golpe hasta llegar a 20; después, una al día.
const ARRANQUE = 20;
const TIPOS: Record<string, string> = { desayuno: 'desayuno', media_manana: 'media mañana', almuerzo: 'comida', merienda: 'merienda', cena: 'cena' };

interface Articulo {
  titulo: string;
  meta: string;
  intro: string[];
  beneficios: string[];
  consejos: string[];
  preguntas: { pregunta: string; respuesta: string }[];
  palabras_clave: string[];
}

const ESQUEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['titulo', 'meta', 'intro', 'beneficios', 'consejos', 'preguntas', 'palabras_clave'],
  properties: {
    titulo: { type: 'string', description: 'Título SEO de 50-65 caracteres que empiece por "Receta de" o similar, con la búsqueda principal.' },
    meta: { type: 'string', description: 'Meta descripción de 140-155 caracteres, con la búsqueda principal y una invitación.' },
    intro: { type: 'array', items: { type: 'string' }, description: '2 párrafos cortos que presenten el plato y cuándo tomarlo.' },
    beneficios: { type: 'array', items: { type: 'string' }, description: '3 frases sobre por qué es una opción saludable y equilibrada, sin afirmaciones médicas.' },
    consejos: { type: 'array', items: { type: 'string' }, description: '2 consejos de cocina útiles.' },
    preguntas: {
      type: 'array',
      items: { type: 'object', additionalProperties: false, required: ['pregunta', 'respuesta'], properties: { pregunta: { type: 'string' }, respuesta: { type: 'string' } } },
      description: '3 preguntas frecuentes que la gente busca sobre este plato, con respuestas breves.',
    },
    palabras_clave: { type: 'array', items: { type: 'string' }, description: '5 búsquedas relacionadas.' },
  },
};

const slugDe = (nombre: string, id: number) =>
  `${normalizar(nombre).replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 70).replace(/-$/, '')}-${id}`;

const COLUMNAS = 'id, nombre, descripcion, tipo_comida, nivel, minutos, kcal, imagen, imagen_mini, alergenos, etiquetas, pasos, ingredientes(nombre, orden, unidad)';

type Receta = {
  id: number;
  nombre: string;
  descripcion: string | null;
  tipo_comida: string;
  nivel: string;
  minutos: number | null;
  kcal: number | null;
  imagen: string | null;
  imagen_mini: string | null;
  alergenos: string[] | null;
  etiquetas: string[] | null;
  pasos: string[] | null;
  ingredientes: { nombre: string; orden: number; unidad: string | null }[];
};

// Lo que se puede enseñar en la web: ingredientes sin cantidades y solo los primeros pasos.
const publica = (r: Receta) => ({
  id: r.id,
  nombre: r.nombre,
  descripcion: r.descripcion,
  tipo: TIPOS[r.tipo_comida] ?? r.tipo_comida,
  nivel: r.nivel,
  minutos: r.minutos,
  kcal: r.kcal,
  imagen: r.imagen,
  imagen_mini: r.imagen_mini ?? r.imagen,
  alergenos: r.alergenos ?? [],
  etiquetas: r.etiquetas ?? [],
  ingredientes: [...(r.ingredientes ?? [])].sort((a, b) => a.orden - b.orden).map((i) => i.nombre),
  pasos_visibles: (r.pasos ?? []).slice(0, PASOS_VISIBLES),
  pasos_total: (r.pasos ?? []).length,
});

// En la web (y en Instagram) solo salen comidas y cenas.
const PRINCIPALES = ['almuerzo', 'cena'];

async function publicar(admin: Cliente) {
  const hoy = hoyEspana();
  const { data: hechas } = await admin.from('blog_recetas').select('receta_id, publicada_el').limit(5000);
  const yaPublicadas = new Set((hechas ?? []).map((h) => h.receta_id as number));
  const total = yaPublicadas.size;
  const hoyHay = (hechas ?? []).some((h) => h.publicada_el === hoy);
  const cuantas = total < ARRANQUE ? ARRANQUE - total : hoyHay ? 0 : 1;
  if (!cuantas) return { publicada: false, motivo: 'ya hay una hoy' };
  const { data: candidatas } = await admin
    .from('recetas')
    .select(COLUMNAS)
    .eq('oculta', false)
    .in('tipo_comida', PRINCIPALES)
    .order('created_at', { ascending: true })
    .limit(1500);
  const libres = ((candidatas ?? []) as unknown as Receta[]).filter((r) => !yaPublicadas.has(r.id) && (r.pasos ?? []).length >= 3);
  // Primero las que tienen foto; si no hay bastantes, también sin foto (la foto se añade sola a la página cuando exista).
  const conFoto = libres.filter((r) => r.imagen);
  const lista = conFoto.length >= cuantas ? conFoto : [...conFoto, ...libres.filter((r) => !r.imagen)];
  if (!lista.length) return { publicada: false, motivo: 'no hay recetas sin publicar' };
  // Solo comidas y cenas: los desayunos, medias mañanas y meriendas no se publican en la web.
  const elegidas = lista.slice(0, cuantas);
  const hechasAhora: string[] = [];
  await enParalelo(elegidas, 5, async (r) => {
    try {
      await escribir(admin, r, hoy);
      hechasAhora.push(r.nombre);
    } catch (e) {
      console.error('web-recetas: no se publicó una receta:', e instanceof Error ? e.message : e);
    }
  });
  return { publicada: hechasAhora.length > 0, receta: hechasAhora.join(', '), cantidad: hechasAhora.length };
}

async function escribir(admin: Cliente, r: Receta, hoy: string) {
  const a = await pedirJSON<Articulo>({
    modelo: MODELO_WEB,
    sistema: `Eres redactor SEO de una web de recetas caseras y saludables en español de España. Escribes artículos útiles, naturales y sin relleno, pensados para que la gente los encuentre en Google y quiera usar la app Yococino.
Reglas: no inventes datos de la receta; nada de afirmaciones médicas ni promesas de adelgazar; tono cercano; no repitas palabras clave de forma forzada.`,
    mensaje: `Receta: ${r.nombre}
Descripción: ${r.descripcion ?? '—'}
Tipo de comida: ${TIPOS[r.tipo_comida] ?? r.tipo_comida}
Tiempo: ${r.minutos ?? '—'} minutos · Nivel: ${r.nivel} · Unas ${r.kcal ?? '—'} kcal por ración
Ingredientes: ${[...(r.ingredientes ?? [])].map((i) => i.nombre).join(', ')}
Etiquetas: ${(r.etiquetas ?? []).join(', ') || '—'}`,
    esquema: ESQUEMA,
    maxTokens: 2500,
  });
  const contenido = {
    intro: (a.intro ?? []).slice(0, 3).map((t) => String(t).slice(0, 600)),
    beneficios: (a.beneficios ?? []).slice(0, 3).map((t) => String(t).slice(0, 300)),
    consejos: (a.consejos ?? []).slice(0, 2).map((t) => String(t).slice(0, 300)),
    preguntas: (a.preguntas ?? []).slice(0, 4).map((p) => ({ pregunta: String(p.pregunta).slice(0, 160), respuesta: String(p.respuesta).slice(0, 500) })),
    palabras_clave: (a.palabras_clave ?? []).slice(0, 6).map((t) => String(t).slice(0, 60)),
  };
  const { error } = await admin.from('blog_recetas').insert({
    receta_id: r.id,
    slug: slugDe(r.nombre, r.id),
    titulo: String(a.titulo || `Receta de ${r.nombre}`).slice(0, 90),
    meta: String(a.meta || r.descripcion || r.nombre).slice(0, 170),
    contenido,
    publicada_el: hoy,
  });
  if (error) throw error;
}

async function listar(admin: Cliente) {
  const { data: posts } = await admin
    .from('blog_recetas')
    .select('slug, titulo, meta, contenido, publicada_el, receta_id')
    .order('publicada_el', { ascending: false })
    .limit(2000);
  const ids = (posts ?? []).map((p) => p.receta_id as number);
  const { data: recetasPosts } = ids.length ? await admin.from('recetas').select(COLUMNAS).in('id', ids).in('tipo_comida', PRINCIPALES) : { data: [] };
  const porId = new Map(((recetasPosts ?? []) as unknown as Receta[]).map((r) => [r.id, r]));
  const articulos = (posts ?? [])
    .filter((p) => porId.has(p.receta_id as number))
    .map((p) => ({ slug: p.slug, titulo: p.titulo, meta: p.meta, contenido: p.contenido, publicada_el: p.publicada_el, receta: publica(porId.get(p.receta_id as number) as Receta) }));

  // Destacadas para la portada: primero las publicadas; si faltan, otras recetas con foto.
  const { data: conFoto } = await admin
    .from('recetas')
    .select(COLUMNAS)
    .eq('oculta', false)
    .not('imagen', 'is', null)
    .in('tipo_comida', PRINCIPALES)
    .order('created_at', { ascending: false })
    .limit(30);
  const destacadas = [
    ...articulos.slice(0, 6).map((a) => ({ ...a.receta, slug: a.slug })),
    ...((conFoto ?? []) as unknown as Receta[]).filter((r) => !porId.has(r.id)).map((r) => ({ ...publica(r), slug: null })),
  ].slice(0, 6);
  return { articulos, destacadas };
}

async function manejar(req: Request): Promise<Response> {
  const { admin } = crearClientes(req);
  const cuerpo = (await req.json().catch(() => ({}))) as { accion?: string };
  if (cuerpo.accion === 'publicar') return responder({ ok: true, ...(await publicar(admin)) });
  return responder({ ok: true, ...(await listar(admin)) });
}

servir('web-recetas', manejar, 'No se han podido preparar las recetas de la web.');
