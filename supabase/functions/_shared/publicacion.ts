// Lee lo público de una publicación (TikTok, Instagram, YouTube, Pinterest o una web de recetas):
// título o texto, autor y portada. No se descarga el vídeo ni se guarda nada del creador.
import { embedDe, plataformaDe, urlPermitida, type Plataforma } from './importar_reglas.ts';

export interface Publicacion {
  plataforma: Plataforma;
  url: string;
  titulo: string;
  texto: string;
  autor: string;
  imagen: string | null;
  // Reproductor oficial del vídeo original (TikTok, YouTube o Instagram), si lo hay.
  video: string | null;
}

const MAX_BYTES = 1_500_000;
const AGENTE = 'Mozilla/5.0 (compatible; YococinoBot/1.0; +https://yococino.app)';

async function pedir(url: string, json = false): Promise<{ final: string; cuerpo: string } | null> {
  if (!urlPermitida(url)) return null;
  try {
    const r = await fetch(url, {
      headers: { 'user-agent': AGENTE, accept: json ? 'application/json' : 'text/html,application/xhtml+xml', 'accept-language': 'es-ES,es;q=0.9' },
      redirect: 'follow',
      signal: AbortSignal.timeout(9000),
    });
    // Tras las redirecciones, también tiene que ser una dirección pública.
    if (!r.ok || !urlPermitida(r.url || url)) return null;
    const lector = r.body?.getReader();
    if (!lector) return null;
    const trozos: Uint8Array[] = [];
    let total = 0;
    while (total < MAX_BYTES) {
      const { done, value } = await lector.read();
      if (done || !value) break;
      trozos.push(value);
      total += value.length;
    }
    lector.cancel().catch(() => {});
    const todo = new Uint8Array(Math.min(total, MAX_BYTES));
    let p = 0;
    for (const t of trozos) {
      const parte = t.subarray(0, Math.min(t.length, todo.length - p));
      todo.set(parte, p);
      p += parte.length;
      if (p >= todo.length) break;
    }
    return { final: r.url || url, cuerpo: new TextDecoder().decode(todo) };
  } catch {
    return null;
  }
}

const desescapar = (s: string) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));

function meta(html: string, nombre: string): string {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${nombre}["'][^>]*content=["']([^"']*)["']|<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${nombre}["']`, 'i');
  const m = html.match(re);
  return m ? desescapar(m[1] ?? m[2] ?? '').trim() : '';
}

// Recetas escritas en la web con datos estructurados (schema.org/Recipe).
function recetaEstructurada(html: string): string {
  const bloques = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
  for (const b of bloques) {
    try {
      const datos = JSON.parse(b.trim());
      const lista = (Array.isArray(datos) ? datos : datos['@graph'] ?? [datos]) as Record<string, unknown>[];
      const r = lista.find((x) => String(x?.['@type'] ?? '').includes('Recipe'));
      if (!r) continue;
      const ing = (r.recipeIngredient as string[] | undefined) ?? [];
      const pasos = ((r.recipeInstructions as unknown[] | undefined) ?? []).map((p) => (typeof p === 'string' ? p : String((p as { text?: string })?.text ?? '')));
      return `Receta: ${r.name ?? ''}\nRaciones: ${r.recipeYield ?? ''}\nIngredientes:\n- ${ing.join('\n- ')}\nPasos:\n${pasos.map((p, i) => `${i + 1}. ${p}`).join('\n')}`.slice(0, 6000);
    } catch {
      // Bloque no válido: se sigue con el siguiente.
    }
  }
  return '';
}

async function oembed(endpoint: string): Promise<{ titulo: string; autor: string; imagen: string | null; id: string | null } | null> {
  const r = await pedir(endpoint, true);
  if (!r) return null;
  try {
    const d = JSON.parse(r.cuerpo) as { title?: string; author_name?: string; author_unique_id?: string; thumbnail_url?: string; embed_product_id?: string };
    return {
      titulo: String(d.title ?? ''),
      autor: String(d.author_unique_id ? `@${d.author_unique_id}` : d.author_name ?? ''),
      imagen: d.thumbnail_url && urlPermitida(d.thumbnail_url) ? d.thumbnail_url : null,
      id: d.embed_product_id ? String(d.embed_product_id) : null,
    };
  } catch {
    return null;
  }
}

export async function leerPublicacion(url: string): Promise<Publicacion | null> {
  if (!urlPermitida(url)) return null;
  const plataforma = plataformaDe(url);
  const base: Publicacion = { plataforma, url, titulo: '', texto: '', autor: '', imagen: null, video: null };
  let tiktokId: string | null = null;

  // TikTok y YouTube tienen un servicio público con el texto de la publicación y su portada.
  if (plataforma === 'tiktok' || plataforma === 'youtube') {
    const e = await oembed(
      plataforma === 'tiktok' ? `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}` : `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`,
    );
    if (e) {
      Object.assign(base, { titulo: e.titulo, texto: e.titulo, autor: e.autor, imagen: e.imagen });
      tiktokId = e.id;
    }
  }

  // Para el resto (y para completar), la página pública: título, descripción, portada y receta estructurada.
  const pagina = await pedir(url);
  base.video = embedDe(pagina?.final ?? url, tiktokId) ?? embedDe(url, tiktokId);
  if (pagina) {
    const html = pagina.cuerpo;
    const titulo = meta(html, 'og:title') || (html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? '');
    const descripcion = meta(html, 'og:description') || meta(html, 'description');
    const imagen = meta(html, 'og:image');
    const estructurada = recetaEstructurada(html);
    base.titulo ||= desescapar(titulo).trim();
    const textos = [base.texto, descripcion, estructurada].filter(Boolean);
    base.texto = [...new Set(textos)].join('\n\n').slice(0, 7000);
    if (!base.imagen && imagen && urlPermitida(imagen)) base.imagen = imagen;
    base.autor ||= meta(html, 'og:site_name');
  }
  if (!base.titulo && !base.texto && !base.imagen) return null;
  return base;
}
