// aligerar-fotos: convierte en segundo plano las fotos que llegaron de los lotes (grandes, tal cual las da Google)
// a su versión ligera: JPEG de 1024 px y miniatura de 360 px. Hace UNA foto por llamada (para no pasarse del
// límite de CPU) y se vuelve a llamar a sí misma hasta que no quede ninguna. Así el recetario va rápido
// sin esperar a que alguien abra cada receta. Solo la llaman el propio servidor (clave interna) o un administrador.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { CORS, fallo, responder } from '../_shared/http.ts';
import { claveSecreta, guardarVersiones, seguirAligerando } from '../_shared/fotos.ts';

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
  if (!receta) return responder({ ok: true, fin: 'no quedan' });
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
