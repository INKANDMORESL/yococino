// foto-receta: genera la foto de un plato con Google Gemini, una sola vez por receta compartida,
// y la guarda en Storage (carpeta pública "fotos"). Estilo (ver CLAUDE.md): realista, como cocinado
// de verdad en casa, pero bonito. A Google solo se envía el nombre del plato y sus ingredientes.
// Secreto en Supabase: GEMINI_API_KEY. Si no está, la app sigue mostrando el dibujo del tipo de comida.
import { crearClientes, fallo, responder, servir } from '../_shared/http.ts';
import { contarUso } from '../_shared/perfil.ts';

const MODELO_FOTO = Deno.env.get('MODELO_FOTO') || 'gemini-nano-banana-2.1';
const MAX_FOTOS_DIA = 60;
const BLOQUEO_MS = 3 * 60 * 1000;
const BASE = 'https://generativelanguage.googleapis.com/v1beta';

class ErrorFoto extends Error {
  constructor(mensaje: string, readonly noConfigurada = false) {
    super(mensaje);
  }
}

// Busca la imagen en la respuesta, venga con el formato que venga (generateContent o Interactions).
function buscarImagen(v: unknown): { datos: string; tipo: string } | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const inline = (o.inlineData ?? o.inline_data) as Record<string, unknown> | undefined;
  if (inline && typeof inline.data === 'string') {
    return { datos: inline.data, tipo: String(inline.mimeType ?? inline.mime_type ?? 'image/png') };
  }
  if (typeof o.data === 'string' && o.data.length > 1000 && (o.type === 'image' || o.mime_type || o.mimeType)) {
    return { datos: o.data, tipo: String(o.mime_type ?? o.mimeType ?? 'image/png') };
  }
  for (const hijo of Object.values(o)) {
    const r = Array.isArray(hijo) ? hijo.map(buscarImagen).find(Boolean) : buscarImagen(hijo);
    if (r) return r;
  }
  return null;
}

async function pedir(url: string, cuerpo: unknown, clave: string) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'x-goog-api-key': clave, 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
    signal: AbortSignal.timeout(110_000),
  });
  const texto = await r.text();
  if (r.status === 401 || r.status === 403) throw new ErrorFoto(`Google rechaza la clave (${r.status})`, true);
  if (!r.ok) throw new ErrorFoto(`Google ${r.status}: ${texto.slice(0, 200)}`);
  return JSON.parse(texto) as unknown;
}

async function generar(prompt: string): Promise<{ bytes: Uint8Array; tipo: string }> {
  const clave = Deno.env.get('GEMINI_API_KEY');
  if (!clave) throw new ErrorFoto('Falta el secreto GEMINI_API_KEY', true);
  let respuesta: unknown;
  try {
    respuesta = await pedir(
      `${BASE}/models/${MODELO_FOTO}:generateContent`,
      {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '4:3', imageSize: '1K' } },
      },
      clave,
    );
  } catch (e) {
    if (e instanceof ErrorFoto && e.noConfigurada) throw e;
    // Algunos modelos nuevos solo funcionan con la API de Interactions.
    respuesta = await pedir(
      `${BASE}/interactions`,
      {
        model: MODELO_FOTO,
        input: [{ type: 'text', text: prompt }],
        response_format: { type: 'image', mime_type: 'image/jpeg', aspect_ratio: '4:3', image_size: '1K' },
      },
      clave,
    );
  }
  const imagen = buscarImagen(respuesta);
  if (!imagen) throw new ErrorFoto('Google no devolvió ninguna imagen');
  const binario = atob(imagen.datos);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return { bytes, tipo: imagen.tipo.startsWith('image/') ? imagen.tipo : 'image/png' };
}

const promptDe = (nombre: string, ingredientes: string[]) => `Fotografía realista de comida casera: "${nombre}", una ración servida en un plato, recién hecha en una cocina de casa en España.
Ingredientes visibles: ${ingredientes.slice(0, 12).join(', ')}.
Estilo: parece cocinado de verdad en casa, pero bonito y apetecible. Luz natural de ventana, suave y cálida. Textura real: dorados, salsa brillante, migas, algo de vapor si está caliente. Emplatado cuidado pero sencillo, sin aspecto de estudio ni de anuncio. Vajilla de cerámica sencilla sobre una mesa de madera o un mantel de lino, con algún detalle de fondo desenfocado. Ángulo de tres cuartos, poca profundidad de campo.
Sin texto, sin letras, sin logotipos, sin marcas de agua, sin personas ni manos. Solo lo que lleva la receta.`;

async function foto(req: Request): Promise<Response> {
  const { usuario, admin } = crearClientes(req);
  const { data: auth } = await usuario.auth.getUser();
  const user = auth?.user;
  if (!user) return fallo(401, 'no_autenticado', 'Vuelve a entrar en tu cuenta.');

  const cuerpo = (await req.json().catch(() => ({}))) as { receta_id?: number };
  const recetaId = Number(cuerpo.receta_id);
  if (!Number.isInteger(recetaId) || recetaId <= 0) return fallo(400, 'datos', 'Falta la receta.');

  const { data: receta, error } = await admin
    .from('recetas')
    .select('id, nombre, imagen, foto_pedida_at, ingredientes(nombre, orden, unidad)')
    .eq('id', recetaId)
    .maybeSingle();
  if (error) throw error;
  if (!receta) return fallo(404, 'no_encontrada', 'No encontramos esa receta.');
  if (receta.imagen) return responder({ ok: true, imagen: receta.imagen });

  // Si otra persona la está generando ahora mismo, no se pide otra vez.
  const limite = new Date(Date.now() - BLOQUEO_MS).toISOString();
  const { data: bloqueo } = await admin
    .from('recetas')
    .update({ foto_pedida_at: new Date().toISOString() })
    .eq('id', receta.id)
    .is('imagen', null)
    .or(`foto_pedida_at.is.null,foto_pedida_at.lt.${limite}`)
    .select('id');
  if (!bloqueo?.length) return responder({ ok: true, imagen: null, pendiente: true });

  if (!(await contarUso(admin, user.id, 'foto', MAX_FOTOS_DIA))) {
    await admin.from('recetas').update({ foto_pedida_at: null }).eq('id', receta.id);
    return responder({ ok: true, imagen: null, limite: true });
  }

  try {
    const ingredientes = ((receta.ingredientes ?? []) as { nombre: string; orden: number; unidad: string | null }[])
      .filter((i) => i.unidad !== 'al gusto')
      .sort((a, b) => a.orden - b.orden)
      .map((i) => i.nombre);
    const { bytes, tipo } = await generar(promptDe(receta.nombre, ingredientes));
    const extension = tipo.includes('jpeg') ? 'jpg' : tipo.includes('webp') ? 'webp' : 'png';
    const ruta = `recetas/${receta.id}.${extension}`;
    const { error: errorSubida } = await admin.storage.from('fotos').upload(ruta, bytes, { contentType: tipo, upsert: true });
    if (errorSubida) throw errorSubida;
    const imagen = admin.storage.from('fotos').getPublicUrl(ruta).data.publicUrl;
    await admin.from('recetas').update({ imagen, foto_modelo: MODELO_FOTO }).eq('id', receta.id);
    return responder({ ok: true, imagen });
  } catch (e) {
    await admin.from('recetas').update({ foto_pedida_at: null }).eq('id', receta.id);
    if (e instanceof ErrorFoto && e.noConfigurada) {
      console.error('foto-receta: sin configurar:', e.message);
      return fallo(503, 'foto_no_configurada', 'Las fotos aún no están activadas.', e.message);
    }
    throw e;
  }
}

servir('foto-receta', foto, 'No hemos podido preparar la foto del plato.');
