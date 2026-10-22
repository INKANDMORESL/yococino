// foto-receta: genera la foto de un plato con Google Gemini, una sola vez por receta compartida,
// y la guarda en Storage (carpeta pública "fotos"). Estilo (ver CLAUDE.md): realista, como cocinado
// de verdad en casa, pero bonito. A Google solo se envía el nombre del plato y sus ingredientes.
// Secreto en Supabase: GEMINI_API_KEY. Si no está, la app sigue mostrando el dibujo del tipo de comida.
import { crearClientes, fallo, responder, servir } from '../_shared/http.ts';
import { ErrorFoto, generar, guardarVersiones, MODELO_FOTO, promptDe } from '../_shared/fotos.ts';
import { FOTO_USD, sumarCoste } from '../_shared/costes.ts';
import { permitirExtra } from '../_shared/perfil.ts';

const MAX_FOTOS_DIA = 60;
const BLOQUEO_MS = 3 * 60 * 1000;

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
    .select('id, nombre, imagen, imagen_mini, foto_pedida_at, foto_en_lote, ingredientes(nombre, orden, unidad)')
    .eq('id', recetaId)
    .maybeSingle();
  if (error) throw error;
  if (!receta) return fallo(404, 'no_encontrada', 'No encontramos esa receta.');
  if (receta.imagen && receta.imagen_mini) return responder({ ok: true, imagen: receta.imagen, imagen_mini: receta.imagen_mini });
  // Su foto ya está pedida en un lote del administrador: no se genera otra.
  if (!receta.imagen && receta.foto_en_lote) return responder({ ok: true, imagen: null, pendiente: true });

  // Fotos antiguas sin miniatura: se aligeran sin gastar nada (no se vuelve a generar).
  if (receta.imagen) {
    const ruta = receta.imagen.split('/fotos/')[1];
    const descarga = ruta ? await admin.storage.from('fotos').download(decodeURIComponent(ruta)) : null;
    if (!descarga?.data) return responder({ ok: true, imagen: receta.imagen, imagen_mini: receta.imagen });
    const { imagen, imagenMini } = await guardarVersiones(admin, receta.id, new Uint8Array(await descarga.data.arrayBuffer()), descarga.data.type || 'image/png');
    await admin.from('recetas').update({ imagen, imagen_mini: imagenMini }).eq('id', receta.id);
    return responder({ ok: true, imagen, imagen_mini: imagenMini });
  }

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

  // Fotos nuevas solo con suscripción (en la prueba se ven las que ya existen).
  if (await permitirExtra(admin, user.id, 'foto', MAX_FOTOS_DIA, { enPrueba: false })) {
    await admin.from('recetas').update({ foto_pedida_at: null }).eq('id', receta.id);
    return responder({ ok: true, imagen: null, limite: true });
  }

  try {
    const ingredientes = ((receta.ingredientes ?? []) as { nombre: string; orden: number; unidad: string | null }[])
      .filter((i) => i.unidad !== 'al gusto')
      .sort((a, b) => a.orden - b.orden)
      .map((i) => i.nombre);
    const { bytes, tipo } = await generar(promptDe(receta.nombre, ingredientes));
    sumarCoste(FOTO_USD);
    const { imagen, imagenMini } = await guardarVersiones(admin, receta.id, bytes, tipo);
    await admin.from('recetas').update({ imagen, imagen_mini: imagenMini, foto_modelo: MODELO_FOTO }).eq('id', receta.id);
    return responder({ ok: true, imagen, imagen_mini: imagenMini });
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
