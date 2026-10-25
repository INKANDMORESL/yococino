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
// Guarda la foto tal como llega, sin convertirla (casi no gasta CPU). La versión ligera se hace después,
// la primera vez que alguien abre la receta (foto-receta ve que falta la miniatura y la prepara).
export async function guardarOriginal(admin: Cliente, recetaId: number, bytes: Uint8Array, tipo: string): Promise<string> {
  const ext = tipo.includes('jpeg') || tipo.includes('jpg') ? 'jpg' : tipo.includes('webp') ? 'webp' : 'png';
  const ruta = `recetas/${recetaId}.${ext}`;
  const { error } = await admin.storage.from('fotos').upload(ruta, bytes, { contentType: tipo, upsert: true });
  if (error) throw error;
  return admin.storage.from('fotos').getPublicUrl(ruta).data.publicUrl;
}

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

// ---------- Lotes de fotos (mitad de precio, hasta 24 h). Solo para el recetario. ----------
// Las peticiones van en un archivo JSONL y Google devuelve otro archivo con una foto por línea.
// Ese archivo se lee poco a poco (línea a línea), así nunca se carga entero en memoria.
const UPLOAD = 'https://generativelanguage.googleapis.com/upload/v1beta/files';
const DESCARGA = 'https://generativelanguage.googleapis.com/download/v1beta';

async function subirArchivo(contenido: string, nombre: string): Promise<string> {
  const clave = claveGemini();
  const bytes = new TextEncoder().encode(contenido);
  const inicio = await fetch(UPLOAD, {
    method: 'POST',
    headers: {
      'x-goog-api-key': clave,
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(bytes.length),
      'X-Goog-Upload-Header-Content-Type': 'application/jsonl',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ file: { display_name: nombre } }),
  });
  const destino = inicio.headers.get('x-goog-upload-url');
  if (!inicio.ok || !destino) throw new ErrorFoto(`Google no aceptó el archivo del lote (${inicio.status}): ${(await inicio.text()).slice(0, 200)}`);
  const subida = await fetch(destino, {
    method: 'POST',
    headers: { 'Content-Length': String(bytes.length), 'X-Goog-Upload-Offset': '0', 'X-Goog-Upload-Command': 'upload, finalize' },
    body: bytes,
  });
  const datos = await subida.json().catch(() => null);
  const archivo = (datos?.file?.name ?? datos?.name) as string | undefined;
  if (!subida.ok || !archivo) throw new ErrorFoto(`No se pudo subir el archivo del lote (${subida.status})`);
  return archivo;
}

export async function crearLoteFotos(fotos: { clave: string; prompt: string }[]): Promise<string> {
  const lineas = fotos.map((f) => JSON.stringify({ key: f.clave, request: peticionFoto(f.prompt) })).join('\n');
  const archivo = await subirArchivo(lineas, `yococino-fotos-${Date.now()}`);
  const respuesta = (await pedir(
    `${BASE}/models/${MODELO_FOTO}:batchGenerateContent`,
    { batch: { display_name: `yococino-fotos-${Date.now()}`, input_config: { file_name: archivo } } },
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

// Estado del lote. Con el archivo de entrada, la respuesta es pequeña: solo dice dónde está el archivo de resultados.
export async function estadoLoteFotos(nombre: string): Promise<{ estado: 'pendiente' | 'terminado' | 'fallido'; archivo: string | null; google: string }> {
  const r = await fetch(`${BASE}/${nombre}`, { headers: { 'x-goog-api-key': claveGemini() } });
  const datos = await r.json().catch(() => null);
  if (!r.ok) throw new ErrorFoto(`Google ${r.status}: ${JSON.stringify(datos).slice(0, 200)}`);
  const estado = String(buscar(datos, 'state') ?? '');
  if (/FAILED|CANCELLED|EXPIRED/.test(estado)) return { estado: 'fallido', archivo: null, google: estado };
  if (!/SUCCEEDED/.test(estado) && buscar(datos, 'done') !== true) return { estado: 'pendiente', archivo: null, google: estado };
  const archivo = (buscar(datos, 'responsesFile') ?? buscar(datos, 'fileName')) as string | undefined;
  return { estado: archivo ? 'terminado' : 'fallido', archivo: archivo ?? null, google: estado };
}

// Lee el archivo de resultados línea a línea y entrega como mucho `maximo` fotos que no estén en `saltar`.
// Devuelve también si ha llegado al final (para saber si el lote está terminado del todo).
export async function leerFotosDelLote(
  archivo: string,
  saltar: Set<string>,
  maximo: number,
  usar: (clave: string, foto: { bytes: Uint8Array; tipo: string } | null) => Promise<void>,
): Promise<{ hechas: string[]; alFinal: boolean }> {
  const r = await fetch(`${DESCARGA}/${archivo}:download?alt=media`, { headers: { 'x-goog-api-key': claveGemini() } });
  if (!r.ok || !r.body) throw new ErrorFoto(`No se pudo descargar el resultado del lote (${r.status})`);
  const lector = r.body.pipeThrough(new TextDecoderStream()).getReader();
  const hechas: string[] = [];
  let alFinal = false;
  // Cada línea es una foto en base64 (varios MB). Se lee por trozos sin volver a recorrer lo ya leído:
  // la línea en curso se guarda en partes y, si su clave ya está hecha, sus trozos se tiran sin juntarlos.
  let partes: string[] = [];
  let cabeza = ''; // primeros caracteres de la línea, para leer la clave
  let estado: 'clave' | 'guardar' | 'saltar' = 'clave';
  const procesar = async (linea: string, clave: string) => {
    let foto: { bytes: Uint8Array; tipo: string } | null = null;
    try {
      const fila = JSON.parse(linea);
      const imagen = fila.response ? buscarImagen(fila.response) : null;
      if (imagen) foto = { bytes: bytesDe(imagen.datos), tipo: imagen.tipo.startsWith('image/') ? imagen.tipo : 'image/png' };
    } catch {
      foto = null;
    }
    await usar(clave, foto);
    hechas.push(clave);
  };
  const claveDe = (t: string) => t.match(/"key"\s*:\s*"([^"]+)"/)?.[1] ?? '';
  let claveActual = '';
  const decidir = () => {
    claveActual = claveDe(cabeza);
    if (claveActual || cabeza.length >= 300) estado = !claveActual || saltar.has(claveActual) ? 'saltar' : 'guardar';
  };
  const finLinea = async () => {
    if (estado === 'clave') decidir();
    if (estado === 'guardar' && claveActual) await procesar(partes.join(''), claveActual);
    partes = [];
    cabeza = '';
    claveActual = '';
    estado = 'clave';
  };
  const anadir = (trozo: string) => {
    if (!trozo) return;
    if (estado === 'clave') {
      cabeza += trozo;
      partes.push(trozo);
      decidir();
      if (estado === 'saltar') partes = [];
    } else if (estado === 'guardar') partes.push(trozo);
  };
  while (hechas.length < maximo) {
    const { done, value } = await lector.read();
    if (done) {
      if (partes.length || cabeza) await finLinea();
      alFinal = true;
      break;
    }
    let desde = 0;
    let i: number;
    while ((i = value.indexOf('\n', desde)) >= 0) {
      anadir(value.slice(desde, i));
      await finLinea();
      desde = i + 1;
      if (hechas.length >= maximo) break;
    }
    if (hechas.length >= maximo) break;
    anadir(value.slice(desde));
  }
  lector.cancel().catch(() => {});
  return { hechas, alFinal };
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

// ---------- Aligerar en segundo plano (función aligerar-fotos) ----------

export function claveSecreta(): string {
  const directa = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (directa) return directa;
  try {
    const d = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}') as Record<string, string>;
    return d.default ?? Object.values(d)[0] ?? '';
  } catch {
    return '';
  }
}

// Lanza la siguiente vuelta de aligerar-fotos sin esperar a que termine.
export function seguirAligerando(salto = 0) {
  const url = `${Deno.env.get('SUPABASE_URL')}/functions/v1/aligerar-fotos`;
  const tarea = fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-clave-interna': claveSecreta() },
    body: JSON.stringify({ salto }),
  }).catch((e) => console.error('aligerar-fotos: no se pudo seguir:', e instanceof Error ? e.message : e));
  // deno-lint-ignore no-explicit-any
  const er = (globalThis as any).EdgeRuntime;
  if (er?.waitUntil) er.waitUntil(tarea);
}
