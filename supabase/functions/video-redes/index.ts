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

// ---------- Voz en off (Gemini TTS) ----------
// Devuelve el audio en WAV. El modelo exacto cambia con las versiones: se usa MODELO_VOZ o el TTS «flash» más nuevo.
async function modeloVoz(): Promise<string> {
  const fijo = Deno.env.get('MODELO_VOZ');
  if (fijo) return fijo;
  const r = await fetch(`${BASE}/models?pageSize=1000`, { headers: { 'x-goog-api-key': claveGemini() } });
  const datos = (await r.json().catch(() => ({}))) as { models?: { name: string }[] };
  const nombres = (datos.models ?? []).map((m) => m.name.replace(/^models\//, '')).filter((n) => /tts/i.test(n));
  const flash = nombres.filter((n) => /flash/.test(n)).sort().reverse();
  return flash[0] ?? nombres.sort().reverse()[0] ?? 'gemini-2.5-flash-preview-tts';
}

function wavDe(pcm: Uint8Array, hz: number): Uint8Array {
  const cab = new DataView(new ArrayBuffer(44));
  const txt = (o: number, t: string) => [...t].forEach((c, i) => cab.setUint8(o + i, c.charCodeAt(0)));
  txt(0, 'RIFF'); cab.setUint32(4, 36 + pcm.length, true); txt(8, 'WAVE'); txt(12, 'fmt ');
  cab.setUint32(16, 16, true); cab.setUint16(20, 1, true); cab.setUint16(22, 1, true); cab.setUint32(24, hz, true);
  cab.setUint32(28, hz * 2, true); cab.setUint16(32, 2, true); cab.setUint16(34, 16, true); txt(36, 'data'); cab.setUint32(40, pcm.length, true);
  const out = new Uint8Array(44 + pcm.length);
  out.set(new Uint8Array(cab.buffer), 0);
  out.set(pcm, 44);
  return out;
}

async function voz(admin: Cliente, texto: string, nombre: string, voz: string, estilo: string) {
  const modelo = await modeloVoz();
  const r = await fetch(`${BASE}/models/${modelo}:generateContent`, {
    method: 'POST',
    headers: cabeceras(),
    body: JSON.stringify({
      // Solo la frase: este modelo lee en voz alta cualquier indicación que vaya delante y no admite instrucciones aparte.
      // El acento va por el idioma (es-ES) y el tono, por la voz elegida.
      contents: [{ parts: [{ text: estilo ? `${estilo}: ${texto}` : texto }] }],
      generationConfig: { responseModalities: ['AUDIO'], speechConfig: { languageCode: 'es-ES', voiceConfig: { prebuiltVoiceConfig: { voiceName: voz } } } },
    }),
  });
  const d = (await r.json().catch(() => ({}))) as Record<string, any>;
  const parte = d.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData?.data);
  if (!r.ok || !parte) throw new Error(`Google no hizo la voz (${modelo}): ${r.status} ${d.error?.message ?? JSON.stringify(d).slice(0, 300)}`);
  const hz = Number(String(parte.inlineData.mimeType ?? '').match(/rate=(\d+)/)?.[1]) || 24000;
  const bin = atob(parte.inlineData.data);
  const pcm = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) pcm[i] = bin.charCodeAt(i);
  const { error } = await admin.storage.from('redes').upload(`${nombre}.wav`, wavDe(pcm, hz), { contentType: 'audio/wav', upsert: true });
  if (error) throw error;
  return { listo: true, modelo, url: admin.storage.from('redes').getPublicUrl(`${nombre}.wav`).data.publicUrl };
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
  const cuerpo = (await req.json().catch(() => ({}))) as { accion?: string; prompt?: string; operacion?: string; nombre?: string; texto?: string; voz?: string; estilo?: string };
  const nombre = String(cuerpo.nombre ?? '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 60) || `clip-${Date.now()}`;
  if (cuerpo.accion === 'crear') {
    const prompt = String(cuerpo.prompt ?? '').trim().slice(0, 2000);
    if (prompt.length < 20) return fallo(400, 'prompt', 'Falta la descripción del vídeo.');
    return responder({ ok: true, ...(await crear(admin, prompt, nombre)) });
  }
  if (cuerpo.accion === 'voz') {
    const texto = String(cuerpo.texto ?? '').trim().slice(0, 1000);
    if (!texto) return fallo(400, 'texto', 'Falta el texto de la voz.');
    const estilo = String(cuerpo.estilo ?? '').slice(0, 500);
    return responder({ ok: true, ...(await voz(admin, texto, nombre, String(cuerpo.voz ?? 'Kore').replace(/[^A-Za-z]/g, '') || 'Kore', estilo)) });
  }
  if (cuerpo.accion === 'recoger') {
    if (!/^(interactions\/[\w.-]+|espera\/[a-z0-9-]+)$/.test(String(cuerpo.operacion ?? ''))) return fallo(400, 'operacion', 'Operación no válida.');
    return responder({ ok: true, ...(await recoger(admin, String(cuerpo.operacion), nombre)) });
  }
  return fallo(400, 'accion', 'Acción no válida.');
}

servir('video-redes', video, 'No se ha podido hacer el vídeo.');
