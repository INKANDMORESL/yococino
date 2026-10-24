// aligerar-fotos: cola de fotos del recetario, en segundo plano. En cada llamada hace UNA cosa y se vuelve a llamar:
// 1. Si hay alguna foto grande sin versión ligera, la convierte (JPEG de 1024 px y miniatura de 360 px).
// 2. Si no, hace la foto de una receta que aún no la tiene y no está en un lote (lo normal es que vayan por lotes,
//    a mitad de precio; esto es el plan B si un lote falla o tarda más de 26 h).
//    Las recetas que esperaban su foto (espera_foto) aparecen en el recetario en cuanto la tienen.
// Una cosa por llamada para no pasarse de CPU ni de memoria. Solo la llaman el servidor (clave interna) o un administrador.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { CORS, fallo, responder } from '../_shared/http.ts';
import { claveSecreta, generar, guardarVersiones, MODELO_FOTO, promptDe, seguirAligerando } from '../_shared/fotos.ts';

const MAX_SALTOS = 600;
const BLOQUEO_MS = 3 * 60 * 1000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return fallo(405, 'metodo', 'Usa POST.');
  const secreta = claveSecreta();
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const admin = createClient(url, secreta, { auth: { persistSession: false, autoRefreshToken: false } });

  // Permiso: el propio servidor (clave interna) o un administrador con sesión.
  let permitido = !!secreta && req.headers.get('x-clave-interna') === secreta;
  if (!permitido) {
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const { data } = token ? await admin.auth.getUser(token) : { data: { user: null } };
    if (data?.user) {
      const { data: esAdmin } = await admin.from('admins').select('user_id').eq('user_id', data.user.id).maybeSingle();
      permitido = !!esAdmin;
    }
  }
  if (!permitido) return fallo(403, 'no_permitido', 'No permitido.');

  const cuerpo = (await req.json().catch(() => ({}))) as { salto?: number };
  const salto = Math.max(0, Number(cuerpo.salto) || 0);
  if (salto >= MAX_SALTOS) return responder({ ok: true, fin: 'tope' });

  // Coge una foto pendiente de aligerar (con bloqueo, por si hay dos vueltas a la vez).
  const limite = new Date(Date.now() - BLOQUEO_MS).toISOString();
  const { data: candidatas } = await admin
    .from('recetas')
    .select('id, imagen')
    .not('imagen', 'is', null)
    .is('imagen_mini', null)
    .or(`foto_pedida_at.is.null,foto_pedida_at.lt.${limite}`)
    .limit(1);
  const receta = candidatas?.[0];
  if (!receta) return await hacerFotoNueva(admin, salto, limite);
  const { data: mia } = await admin
    .from('recetas')
    .update({ foto_pedida_at: new Date().toISOString() })
    .eq('id', receta.id)
    .is('imagen_mini', null)
    .or(`foto_pedida_at.is.null,foto_pedida_at.lt.${limite}`)
    .select('id');
  if (!mia?.length) {
    seguirAligerando(salto + 1);
    return responder({ ok: true, ocupada: receta.id });
  }

  try {
    const ruta = decodeURIComponent(String(receta.imagen).split('/fotos/')[1] ?? '');
    const descarga = ruta ? await admin.storage.from('fotos').download(ruta) : null;
    if (!descarga?.data) {
      // No se encuentra el archivo: se deja la foto como está para no repetir.
      await admin.from('recetas').update({ imagen_mini: receta.imagen, foto_pedida_at: null }).eq('id', receta.id);
    } else {
      const { imagen, imagenMini } = await guardarVersiones(admin, receta.id, new Uint8Array(await descarga.data.arrayBuffer()), descarga.data.type || 'image/png');
      await admin.from('recetas').update({ imagen, imagen_mini: imagenMini, foto_pedida_at: null }).eq('id', receta.id);
      await admin.from('recetas').update({ oculta: false, espera_foto: false }).eq('id', receta.id).eq('espera_foto', true);
      // Si la original era otro archivo (PNG), se borra para no ocupar espacio.
      if (imagen !== receta.imagen && ruta) await admin.storage.from('fotos').remove([ruta]);
    }
  } catch (e) {
    console.error('aligerar-fotos:', e instanceof Error ? e.message : e);
    // Si falla, se deja la original como miniatura para que no se quede en bucle.
    await admin.from('recetas').update({ imagen_mini: receta.imagen, foto_pedida_at: null }).eq('id', receta.id);
  }
  seguirAligerando(salto + 1);
  return responder({ ok: true, hecha: receta.id });
});

// Foto nueva para una receta del recetario que no la tiene (las privadas no: esas se hacen al guardarlas).
// deno-lint-ignore no-explicit-any
async function hacerFotoNueva(admin: any, salto: number, limite: string): Promise<Response> {
  const { data: candidatas } = await admin
    .from('recetas')
    .select('id, nombre, espera_foto, ingredientes(nombre, orden, unidad)')
    .is('imagen', null)
    .is('privada_de', null)
    .eq('foto_en_lote', false)
    .or('oculta.eq.false,espera_foto.eq.true')
    .or(`foto_pedida_at.is.null,foto_pedida_at.lt.${limite}`)
    .order('espera_foto', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1);
  const receta = candidatas?.[0] as { id: number; nombre: string; espera_foto: boolean; ingredientes: { nombre: string; orden: number; unidad: string | null }[] } | undefined;
  if (!receta) return responder({ ok: true, fin: 'no quedan' });
  const { data: mia } = await admin
    .from('recetas')
    .update({ foto_pedida_at: new Date().toISOString() })
    .eq('id', receta.id)
    .is('imagen', null)
    .or(`foto_pedida_at.is.null,foto_pedida_at.lt.${limite}`)
    .select('id');
  if (!mia?.length) {
    seguirAligerando(salto + 1);
    return responder({ ok: true, ocupada: receta.id });
  }
  try {
    const ingredientes = [...(receta.ingredientes ?? [])]
      .filter((i) => i.unidad !== 'al gusto')
      .sort((a, b) => a.orden - b.orden)
      .map((i) => i.nombre);
    const { bytes, tipo } = await generar(promptDe(receta.nombre, ingredientes));
    const { imagen, imagenMini } = await guardarVersiones(admin, receta.id, bytes, tipo);
    await admin
      .from('recetas')
      .update({ imagen, imagen_mini: imagenMini, foto_modelo: MODELO_FOTO, foto_pedida_at: null, foto_en_lote: false, ...(receta.espera_foto ? { oculta: false, espera_foto: false } : {}) })
      .eq('id', receta.id);
  } catch (e) {
    console.error('aligerar-fotos (foto nueva):', e instanceof Error ? e.message : e);
    // Se deja el bloqueo puesto unos minutos; después se reintentará. Si Google falla de verdad, la cola para.
    return responder({ ok: false, fallo: receta.id });
  }
  seguirAligerando(salto + 1);
  return responder({ ok: true, foto: receta.id });
}
