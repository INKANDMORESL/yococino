// video-redes: clips de vídeo con IA (Google Gemini Omni Flash) para las publicaciones de Instagram. Solo para el equipo:
// administrador con sesión o la clave interna de tareas (GitHub, cabecera x-tarea).
// - crear: empieza un clip (tarda 1-3 minutos) y devuelve la operación.
// - recoger: mira si ya está; si lo está, lo guarda en el bucket público «redes» y devuelve su dirección.
// No usa datos de clientes. El coste se apunta en lotes_ia (tipo «video») para verlo en el panel.
import { BASE, claveGemini } from '../_shared/fotos.ts';
import { crearClientes, fallo, responder, servir, type Cliente } from '../_shared/http.ts';

// Precio aproximado por segundo (Gemini Omni Flash, ~0,11 $/s). Ajustable con el secreto VIDEO_USD_SEGUNDO.
const USD_SEGUNDO = Number(Deno.env.get('VIDEO_USD_SEGUNDO')) || 0.112;
const SEGUNDOS = 8;
// Google ha sustituido Veo por Gemini Omni Flash (API «Interactions»). Ajustable con el secreto MODELO_VIDEO.
const MODELO = Deno.env.get('MODELO_VIDEO') || 'gemini-omni-1.1-flash';
const cabeceras = () => ({ 'x-goog-api-key': claveGemini(), 'Content-Type': 'application/json' });

// Busca el vídeo en la respuesta de la interacción (en base64 o como enlace a un archivo).
function videoDe(inter: Record<string, any>): { data?: string; uri?: string } | null {
  for (const paso of inter.steps ?? inter.outputs ?? []) {
    for (const c of paso.content ?? [paso]) {
      if (c?.type === 'video' && (c.data || c.uri)) return { data: c.data, uri: c.uri };
    }
  }
  return null;
}

async function guardar(admin: Cliente, nombre: string, v: { data?: string; uri?: string }, id: string) {
  let bytes: Uint8Array;
  if (v.data) {
    const bin = atob(v.data);
    bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  } else {
    const r = await fetch(v.uri as string, { headers: { 'x-goog-api-key': claveGemini() }, redirect: 'follow' });
    if (!r.ok) throw new Error(`No se pudo descargar el vídeo: ${r.status}`);
    bytes = new Uint8Array(await r.arrayBuffer());
  }
  const ruta = `${nombre}.mp4`;
  const { error } = await admin.storage.from('redes').upload(ruta, bytes, { contentType: 'video/mp4', upsert: true });
  if (error) throw error;
  const coste_usd = Math.round(SEGUNDOS * USD_SEGUNDO * 100) / 100;
  await admin.from('lotes_ia').insert({ tipo: 'video', proveedor_id: id || nombre, estado: 'terminado', datos: { nombre }, resultado: { coste_usd }, terminado_at: new Date().toISOString() });
  return { listo: true, url: admin.storage.from('redes').getPublicUrl(ruta).data.publicUrl, coste_usd };
}

// Empieza el vídeo. Se pide en segundo plano (background) y se recoge después; si la API no lo admite,
// la función espera la respuesta en segundo plano y la deja guardada en el bucket.
async function crear(admin: Cliente, prompt: string, nombre: string) {
  await admin.storage.from('redes').remove([`${nombre}.mp4`, `${nombre}.error.txt`]);
  const cuerpo = { model: MODELO, input: prompt, response_format: { type: 'video', aspect_ratio: '9:16', resolution: '1080p' } };
  const r = await fetch(`${BASE}/interactions`, { method: 'POST', headers: cabeceras(), body: JSON.stringify({ ...cuerpo, background: true }) });
  const datos = (await r.json().catch(() => ({}))) as Record<string, any>;
  if (r.ok) {
    const v = videoDe(datos);
    if (v) return { operacion: `espera/${nombre}`, ...(await guardar(admin, nombre, v, datos.id)) };
    if (datos.id) return { operacion: `interactions/${datos.id}`, modelo: MODELO };
  }
  if (r.ok || !/background/i.test(JSON.stringify(datos.error ?? ''))) {
    throw new Error(`Google no aceptó el vídeo (${MODELO}): ${r.status} ${datos.error?.message ?? JSON.stringify(datos).slice(0, 300)}`);
  }
  // Sin modo en segundo plano: se espera aquí, sin hacer esperar a quien llama.
  const tarea = (async () => {
    try {
      const s = await fetch(`${BASE}/interactions`, { method: 'POST', headers: cabeceras(), body: JSON.stringify(cuerpo) });
      const d = (await s.json().catch(() => ({}))) as Record<string, any>;
      const v = s.ok ? videoDe(d) : null;
      if (!v) throw new Error(`${s.status} ${d.error?.message ?? JSON.stringify(d).slice(0, 300)}`);
      await guardar(admin, nombre, v, d.id);
    } catch (e) {
      await admin.storage.from('redes').upload(`${nombre}.error.txt`, new TextEncoder().encode(String(e instanceof Error ? e.message : e)), { contentType: 'text/plain', upsert: true });
    }
  })();
  // deno-lint-ignore no-explicit-any
  (globalThis as any).EdgeRuntime?.waitUntil?.(tarea);
  return { operacion: `espera/${nombre}`, modelo: MODELO };
}

async function recoger(admin: Cliente, operacion: string, nombre: string) {
  if (operacion.startsWith('espera/')) {
    const { data } = await admin.storage.from('redes').list('', { search: nombre });
    const nombres = (data ?? []).map((f) => f.name);
    if (nombres.includes(`${nombre}.error.txt`)) {
      const { data: t } = await admin.storage.from('redes').download(`${nombre}.error.txt`);
      throw new Error(`Google no hizo el vídeo: ${t ? await t.text() : ''}`);
    }
    if (nombres.includes(`${nombre}.mp4`)) return { listo: true, url: admin.storage.from('redes').getPublicUrl(`${nombre}.mp4`).data.publicUrl };
    return { listo: false };
  }
  const r = await fetch(`${BASE}/${operacion}`, { headers: cabeceras() });
  const inter = (await r.json().catch(() => ({}))) as Record<string, any>;
  if (!r.ok) throw new Error(`No se pudo consultar el vídeo: ${r.status} ${inter.error?.message ?? ''}`);
  const v = videoDe(inter);
  if (v) return guardar(admin, nombre, v, inter.id);
  if (['failed', 'cancelled', 'incomplete'].includes(String(inter.status))) throw new Error(`Google no hizo el vídeo: ${JSON.stringify(inter.error ?? inter.status).slice(0, 300)}`);
  if (inter.status === 'completed') throw new Error(`Google terminó sin vídeo (quizá filtrado): ${JSON.stringify(inter).slice(0, 300)}`);
  return { listo: false };
}

async function video(req: Request): Promise<Response> {
  const { usuario, admin } = crearClientes(req);
  const claveTarea = req.headers.get('x-tarea') ?? '';
  let permitido = false;
  if (claveTarea.length >= 32) {
    const { data } = await admin.from('ajustes_internos').select('clave_tareas').eq('id', 1).maybeSingle();
    permitido = !!data?.clave_tareas && data.clave_tareas === claveTarea;
  }
  if (!permitido) {
    const { data: auth } = await usuario.auth.getUser();
    if (!auth?.user) return fallo(401, 'no_autenticado', 'Vuelve a entrar en tu cuenta.');
    const { data: esAdmin } = await admin.from('admins').select('user_id').eq('user_id', auth.user.id).maybeSingle();
    if (!esAdmin) return fallo(403, 'no_admin', 'Solo el administrador puede hacer esto.');
  }
  const cuerpo = (await req.json().catch(() => ({}))) as { accion?: string; prompt?: string; operacion?: string; nombre?: string };
  const nombre = String(cuerpo.nombre ?? '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 60) || `clip-${Date.now()}`;
  if (cuerpo.accion === 'crear') {
    const prompt = String(cuerpo.prompt ?? '').trim().slice(0, 2000);
    if (prompt.length < 20) return fallo(400, 'prompt', 'Falta la descripción del vídeo.');
    return responder({ ok: true, ...(await crear(admin, prompt, nombre)) });
  }
  if (cuerpo.accion === 'recoger') {
    if (!/^(interactions\/[\w.-]+|espera\/[a-z0-9-]+)$/.test(String(cuerpo.operacion ?? ''))) return fallo(400, 'operacion', 'Operación no válida.');
    return responder({ ok: true, ...(await recoger(admin, String(cuerpo.operacion), nombre)) });
  }
  return fallo(400, 'accion', 'Acción no válida.');
}

servir('video-redes', video, 'No se ha podido hacer el vídeo.');
