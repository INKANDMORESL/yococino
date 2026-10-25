// video-redes: clips de vídeo con IA (Google Veo) para las publicaciones de Instagram. Solo para el equipo:
// administrador con sesión o la clave interna de tareas (GitHub, cabecera x-tarea).
// - crear: empieza un clip (tarda 1-3 minutos) y devuelve la operación.
// - recoger: mira si ya está; si lo está, lo guarda en el bucket público «redes» y devuelve su dirección.
// No usa datos de clientes. El coste se apunta en lotes_ia (tipo «video») para verlo en el panel.
import { BASE, claveGemini } from '../_shared/fotos.ts';
import { crearClientes, fallo, responder, servir, type Cliente } from '../_shared/http.ts';

// Precio aproximado por segundo (Veo 3.1 Fast, 1080p). Ajustable con el secreto VIDEO_USD_SEGUNDO.
const USD_SEGUNDO = Number(Deno.env.get('VIDEO_USD_SEGUNDO')) || 0.12;
const SEGUNDOS = 8;

// El nombre exacto del modelo cambia con las versiones: se elige el Veo «fast» más nuevo que haya.
async function modeloVideo(): Promise<string> {
  const fijo = Deno.env.get('MODELO_VIDEO');
  if (fijo) return fijo;
  const r = await fetch(`${BASE}/models?pageSize=1000`, { headers: { 'x-goog-api-key': claveGemini() } });
  const datos = (await r.json().catch(() => ({}))) as { models?: { name: string; supportedGenerationMethods?: string[] }[] };
  const nombres = (datos.models ?? [])
    .filter((m) => /veo/i.test(m.name) && (m.supportedGenerationMethods ?? ['predictLongRunning']).includes('predictLongRunning'))
    .map((m) => m.name.replace(/^models\//, ''));
  const orden = [/veo-3\.1-fast/, /veo-3\.1/, /veo-3.*fast/, /veo-3/];
  for (const patron of orden) {
    const n = nombres.filter((x) => patron.test(x)).sort().reverse()[0];
    if (n) return n;
  }
  return 'veo-3.1-fast-generate-preview';
}

async function crear(prompt: string) {
  const modelo = await modeloVideo();
  const r = await fetch(`${BASE}/models/${modelo}:predictLongRunning`, {
    method: 'POST',
    headers: { 'x-goog-api-key': claveGemini(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: { aspectRatio: '9:16', resolution: '1080p', durationSeconds: SEGUNDOS, personGeneration: 'allow_all' },
    }),
  });
  const datos = (await r.json().catch(() => ({}))) as { name?: string; error?: { message?: string } };
  if (!r.ok || !datos.name) throw new Error(`Veo (${modelo}) no aceptó el vídeo: ${r.status} ${datos.error?.message ?? ''}`.trim());
  return { operacion: datos.name, modelo };
}

async function recoger(admin: Cliente, operacion: string, nombre: string) {
  const r = await fetch(`${BASE}/${operacion}`, { headers: { 'x-goog-api-key': claveGemini() } });
  const op = (await r.json().catch(() => ({}))) as Record<string, any>;
  if (!r.ok) throw new Error(`No se pudo consultar el vídeo: ${r.status} ${op.error?.message ?? ''}`);
  if (!op.done) return { listo: false };
  if (op.error) throw new Error(`Veo no hizo el vídeo: ${op.error.message ?? JSON.stringify(op.error).slice(0, 300)}`);
  const muestra = op.response?.generateVideoResponse?.generatedSamples?.[0] ?? op.response?.generatedVideos?.[0];
  const uri: string | undefined = muestra?.video?.uri;
  if (!uri) throw new Error(`Veo no devolvió vídeo (quizá filtrado): ${JSON.stringify(op.response ?? {}).slice(0, 300)}`);
  const v = await fetch(uri, { headers: { 'x-goog-api-key': claveGemini() } });
  if (!v.ok) throw new Error(`No se pudo descargar el vídeo: ${v.status}`);
  const bytes = new Uint8Array(await v.arrayBuffer());
  const ruta = `${nombre}.mp4`;
  const { error } = await admin.storage.from('redes').upload(ruta, bytes, { contentType: 'video/mp4', upsert: true });
  if (error) throw error;
  const coste_usd = Math.round(SEGUNDOS * USD_SEGUNDO * 100) / 100;
  await admin.from('lotes_ia').insert({
    tipo: 'video',
    proveedor_id: operacion,
    estado: 'terminado',
    datos: { nombre },
    resultado: { coste_usd },
    terminado_at: new Date().toISOString(),
  });
  return { listo: true, url: admin.storage.from('redes').getPublicUrl(ruta).data.publicUrl, coste_usd };
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
    return responder({ ok: true, ...(await crear(prompt)) });
  }
  if (cuerpo.accion === 'recoger') {
    if (!/^(models\/[^/]+\/)?operations\/[\w.-]+$/.test(String(cuerpo.operacion ?? ''))) return fallo(400, 'operacion', 'Operación no válida.');
    return responder({ ok: true, ...(await recoger(admin, String(cuerpo.operacion), nombre)) });
  }
  return fallo(400, 'accion', 'Acción no válida.');
}

servir('video-redes', video, 'No se ha podido hacer el vídeo.');
