// Fotos de los platos con Google Gemini: generación, versiones ligeras y lotes a mitad de precio.
// A Google solo se envía el nombre del plato y sus ingredientes.
import { Image } from 'https://deno.land/x/imagescript@1.3.0/mod.ts';
import type { Cliente } from './http.ts';
import { FOTO_USD, sumarCoste } from './costes.ts';

export const MODELO_FOTO = Deno.env.get('MODELO_FOTO') || 'gemini-nano-banana-2.1';
export const BASE = 'https://generativelanguage.googleapis.com/v1beta';

export class ErrorFoto extends Error {
  constructor(mensaje: string, readonly noConfigurada = false) {
    super(mensaje);
  }
}

// Busca la imagen en la respuesta, venga con el formato que venga (generateContent o Interactions).
export function buscarImagen(v: unknown): { datos: string; tipo: string } | null {
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

export async function pedir(url: string, cuerpo: unknown, clave: string) {
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

export async function generar(prompt: string): Promise<{ bytes: Uint8Array; tipo: string }> {
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
  return { bytes: bytesDe(imagen.datos), tipo: imagen.tipo.startsWith('image/') ? imagen.tipo : 'image/png' };
}

// Versión grande (1024 px, JPEG) y miniatura (360 px) para que la app cargue rápido.
// Si algo falla al convertir, se guarda la original y la miniatura es la misma.
export async function guardarVersiones(admin: Cliente, recetaId: number, original: Uint8Array, tipo: string) {
  let grande = original;
  let mini = original;
  let tipoGuardado = tipo;
  try {
    const img = await Image.decode(original);
    if (img.width > 1024) img.resize(1024, Image.RESIZE_AUTO);
    grande = await img.encodeJPEG(82);
    if (img.width > 360) img.resize(360, Image.RESIZE_AUTO);
    mini = await img.encodeJPEG(78);
    tipoGuardado = 'image/jpeg';
  } catch (e) {
    console.error('foto-receta: no se pudo convertir la foto:', e instanceof Error ? e.message : e);
  }
  const ext = tipoGuardado.includes('jpeg') ? 'jpg' : tipoGuardado.includes('webp') ? 'webp' : 'png';
  const subir = async (ruta: string, datos: Uint8Array) => {
    const { error } = await admin.storage.from('fotos').upload(ruta, datos, { contentType: tipoGuardado, upsert: true });
    if (error) throw error;
    return admin.storage.from('fotos').getPublicUrl(ruta).data.publicUrl;
  };
  const imagen = await subir(`recetas/${recetaId}.${ext}`, grande);
  const imagenMini = mini === grande ? imagen : await subir(`recetas/${recetaId}_mini.${ext}`, mini);
  return { imagen, imagenMini };
}

export const promptDe = (nombre: string, ingredientes: string[]) => `Fotografía realista de comida casera: "${nombre}", una ración servida en un plato, recién hecha en una cocina de casa en España.
Ingredientes visibles: ${ingredientes.slice(0, 12).join(', ')}.
Estilo: parece cocinado de verdad en casa, pero bonito y apetecible. Luz natural de ventana, suave y cálida. Textura real: dorados, salsa brillante, migas, algo de vapor si está caliente. Emplatado cuidado pero sencillo, sin aspecto de estudio ni de anuncio. Vajilla de cerámica sencilla sobre una mesa de madera o un mantel de lino, con algún detalle de fondo desenfocado. Ángulo de tres cuartos, poca profundidad de campo.
Sin texto, sin letras, sin logotipos, sin marcas de agua, sin personas ni manos. Solo lo que lleva la receta.`;


export function bytesDe(base64: string): Uint8Array {
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

export const claveGemini = () => {
  const clave = Deno.env.get('GEMINI_API_KEY');
  if (!clave) throw new ErrorFoto('Falta el secreto GEMINI_API_KEY', true);
  return clave;
};

const peticionFoto = (prompt: string) => ({
  contents: [{ role: 'user', parts: [{ text: prompt }] }],
  generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '4:3', imageSize: '1K' } },
});

// ---------- Lotes de fotos (mitad de precio, hasta 24 h). Solo los lanza el administrador. ----------

export async function crearLoteFotos(fotos: { clave: string; prompt: string }[]): Promise<string> {
  const respuesta = (await pedir(
    `${BASE}/models/${MODELO_FOTO}:batchGenerateContent`,
    {
      batch: {
        display_name: `yococino-fotos-${Date.now()}`,
        input_config: { requests: { requests: fotos.map((f) => ({ request: peticionFoto(f.prompt), metadata: { key: f.clave } })) } },
      },
    },
    claveGemini(),
  )) as Record<string, unknown>;
  const nombre = (respuesta.name ?? (respuesta.metadata as Record<string, unknown> | undefined)?.name) as string | undefined;
  if (!nombre) throw new ErrorFoto('Google no devolvió el nombre del lote');
  return nombre;
}

// Busca una clave en cualquier nivel de un JSON.
function buscar(v: unknown, clave: string): unknown {
  if (!v || typeof v !== 'object') return undefined;
  const o = v as Record<string, unknown>;
  if (clave in o) return o[clave];
  for (const hijo of Object.values(o)) {
    const r = buscar(hijo, clave);
    if (r !== undefined) return r;
  }
  return undefined;
}

export async function estadoLoteFotos(nombre: string): Promise<{ estado: 'pendiente' | 'terminado' | 'fallido'; fotos: Map<string, { bytes: Uint8Array; tipo: string } | null> }> {
  const r = await fetch(`${BASE}/${nombre}`, { headers: { 'x-goog-api-key': claveGemini() } });
  const datos = await r.json().catch(() => null);
  if (!r.ok) throw new ErrorFoto(`Google ${r.status}: ${JSON.stringify(datos).slice(0, 200)}`);
  const estado = String(buscar(datos, 'state') ?? '');
  const fotos = new Map<string, { bytes: Uint8Array; tipo: string } | null>();
  if (/FAILED|CANCELLED|EXPIRED/.test(estado)) return { estado: 'fallido', fotos };
  if (!/SUCCEEDED/.test(estado) && buscar(datos, 'done') !== true) return { estado: 'pendiente', fotos };
  let lista = buscar(datos, 'inlinedResponses');
  if (lista && !Array.isArray(lista)) lista = buscar(lista, 'inlinedResponses');
  for (const item of (Array.isArray(lista) ? lista : []) as Record<string, unknown>[]) {
    const clave = String((item.metadata as Record<string, unknown> | undefined)?.key ?? '');
    const imagen = item.response ? buscarImagen(item.response) : null;
    if (clave) fotos.set(clave, imagen ? { bytes: bytesDe(imagen.datos), tipo: imagen.tipo.startsWith('image/') ? imagen.tipo : 'image/png' } : null);
  }
  return { estado: 'terminado', fotos };
}

// Foto de una receta recién creada para alguien (no del administrador): se hace a la vez que la receta,
// para que el plato nuevo ya salga con foto. Si tarda demasiado o falla, la receta se guarda igual
// y la foto se podrá hacer después. Su coste se suma a la persona que pidió la receta.
const ESPERA_FOTO_MS = 45_000;
export async function fotoAlCrear(admin: Cliente, recetaId: number, nombre: string, ingredientes: string[]): Promise<void> {
  if (!Deno.env.get('GEMINI_API_KEY')) return;
  await admin.from('recetas').update({ foto_pedida_at: new Date().toISOString() }).eq('id', recetaId).is('imagen', null);
  try {
    const { bytes, tipo } = await Promise.race([
      generar(promptDe(nombre, ingredientes)),
      new Promise<never>((_, mal) => setTimeout(() => mal(new ErrorFoto('La foto ha tardado demasiado')), ESPERA_FOTO_MS)),
    ]);
    sumarCoste(FOTO_USD);
    const { imagen, imagenMini } = await guardarVersiones(admin, recetaId, bytes, tipo);
    await admin.from('recetas').update({ imagen, imagen_mini: imagenMini, foto_modelo: MODELO_FOTO }).eq('id', recetaId);
  } catch (e) {
    console.error('foto al crear la receta:', e instanceof Error ? e.message : e);
    await admin.from('recetas').update({ foto_pedida_at: null }).eq('id', recetaId).is('imagen', null);
  }
}
