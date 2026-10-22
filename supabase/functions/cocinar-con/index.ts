// cocinar-con: crea una receta con los ingredientes que la persona tiene en casa.
// Los ingredientes que no encajan con sus alergias o gustos se quitan antes de pedir nada a la IA,
// y la receta pasa la misma revisión de alergias que las del menú. Límite diario de usos.
import { motivosNoApta, restriccionesDe } from '../_shared/alergenos.ts';
import { crearClientes, fallo, hoyEspana, responder, servir } from '../_shared/http.ts';
import type { TipoComida } from '../_shared/nutricion.ts';
import { perfilSeguro, permitirExtra } from '../_shared/perfil.ts';
import { crearReceta, esApta, type Nivel, type RecetaGuardada } from '../_shared/recetas.ts';
import { planDe, respuestaSuscripcion } from '../_shared/plan.ts';
import { contieneAlimento } from '../_shared/texto.ts';

const MAX_USOS_DIA = 10;
// Lo que suele haber en cualquier casa: no cuenta como "te falta".
const BASICOS = ['aceite', 'sal', 'pimienta', 'ajo', 'cebolla', 'agua', 'vinagre', 'limon', 'perejil', 'oregano', 'comino', 'pimenton', 'laurel', 'tomillo', 'romero', 'canela', 'especias', 'hierbas'];
const TIPOS: TipoComida[] = ['desayuno', 'media_manana', 'almuerzo', 'merienda', 'cena'];

// Solo nombres de alimentos: letras, espacios y poco más. Así no se cuela otra cosa en la petición a la IA.
const limpiar = (t: unknown) =>
  typeof t === 'string'
    ? t
        .replace(/[^\p{L}\p{N} ,.'-]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 40)
    : '';

async function cocinar(req: Request): Promise<Response> {
  const { usuario, admin } = crearClientes(req);
  const { data: auth } = await usuario.auth.getUser();
  const user = auth?.user;
  if (!user) return fallo(401, 'no_autenticado', 'Vuelve a entrar en tu cuenta.');

  const cuerpo = (await req.json().catch(() => ({}))) as { ingredientes?: unknown[]; tipo?: string; nueva?: boolean };
  const tipo = (TIPOS as string[]).includes(cuerpo.tipo ?? '') ? (cuerpo.tipo as TipoComida) : 'almuerzo';
  const pedidos = [...new Set((Array.isArray(cuerpo.ingredientes) ? cuerpo.ingredientes : []).map(limpiar).filter(Boolean))].slice(0, 12);
  if (pedidos.length === 0) return fallo(400, 'datos', 'Escribe al menos un ingrediente que tengas en casa.');

  const hoy = hoyEspana();
  const seguro = await perfilSeguro(admin, user.id, hoy);
  if ('respuesta' in seguro) return seguro.respuesta;
  const perfil = seguro.perfil;
  const nivel: Nivel = perfil.nivel_cocina ?? 'facil';
  const restr = restriccionesDe(perfil.alergias ?? [], perfil.no_me_gusta ?? []);

  const aptos: string[] = [];
  const descartados: string[] = [];
  for (const nombre of pedidos) {
    const motivos = motivosNoApta({ nombre: '', alergenos: [], ingredientes: [{ nombre, nota: null }] }, restr);
    (motivos.length ? descartados : aptos).push(nombre);
  }
  if (aptos.length === 0) {
    return fallo(422, 'no_aptos', 'Ninguno de esos ingredientes encaja con tus alergias o lo que no te gusta. Prueba con otros.');
  }

  if ((await planDe(admin, user.id)).estado === 'caducada') return respuestaSuscripcion();

  // Primero, recetas que ya existen y se pueden hacer con eso (sin gastar IA). Solo si no convencen, se crea una nueva.
  if (!cuerpo.nueva) {
    const tipos = tipo === 'almuerzo' || tipo === 'cena' ? ['almuerzo', 'cena'] : [tipo];
    const { data } = await admin
      .from('recetas')
      .select('id, nombre, tipo_comida, minutos, kcal, imagen, imagen_mini, alergenos, ingredientes(nombre, nota)')
      .eq('oculta', false)
      .in('tipo_comida', tipos)
      .order('created_at', { ascending: false })
      .limit(1500);
    const necesarias = aptos.length === 1 ? 1 : Math.max(2, Math.ceil(aptos.length * 0.5));
    const sugerencias = ((data ?? []) as unknown as (RecetaGuardada & { minutos: number | null; imagen: string | null; imagen_mini: string | null })[])
      .filter((r) => esApta(r, restr))
      .map((r) => {
        const nombres = (r.ingredientes ?? []).map((i) => i.nombre);
        const coinciden = aptos.filter((a) => nombres.some((n) => contieneAlimento(n, a)) || contieneAlimento(r.nombre, a));
        const faltan = nombres.filter((n) => !aptos.some((a) => contieneAlimento(n, a)) && !BASICOS.some((b) => contieneAlimento(n, b)));
        return { r, coinciden, faltan };
      })
      .filter((x) => x.coinciden.length >= necesarias)
      .sort((a, b) => b.coinciden.length - a.coinciden.length || a.faltan.length - b.faltan.length)
      .slice(0, 5)
      .map(({ r, coinciden, faltan }) => ({
        id: r.id,
        nombre: r.nombre,
        minutos: r.minutos,
        kcal: r.kcal,
        imagen: r.imagen_mini ?? r.imagen,
        coinciden,
        faltan: faltan.slice(0, 4),
      }));
    if (sugerencias.length) return responder({ ok: true, sugerencias, descartados });
  }

  const bloqueo = await permitirExtra(admin, user.id, 'cocinar', MAX_USOS_DIA);
  if (bloqueo) return bloqueo;

  const receta = await crearReceta(
    admin,
    'Una receta casera a tu elección con lo que hay en casa',
    'Aprovechar lo que hay en la nevera y la despensa',
    tipo,
    nivel,
    restr,
    `Ingredientes que la persona tiene en casa: ${aptos.join(', ')}.
Usa como base esos ingredientes (no hace falta usarlos todos). Solo puedes añadir básicos de despensa: aceite de oliva, sal, pimienta, especias, hierbas, ajo, cebolla, limón, vinagre y agua. No añadas nada más.`,
  );
  if (!receta) return fallo(502, 'ia', 'No hemos podido crear una receta apta con esos ingredientes. Prueba con otros.', 'sin receta apta');
  return responder({ ok: true, receta_id: receta.id, nombre: receta.nombre, descartados });
}

servir('cocinar-con', cocinar, 'No hemos podido crear la receta. Vuelve a intentarlo en un momento.');
