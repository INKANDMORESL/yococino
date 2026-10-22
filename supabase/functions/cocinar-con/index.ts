// cocinar-con: crea una receta con los ingredientes que la persona tiene en casa.
// Los ingredientes que no encajan con sus alergias o gustos se quitan antes de pedir nada a la IA,
// y la receta pasa la misma revisión de alergias que las del menú. Límite diario de usos.
import { motivosNoApta, restriccionesDe } from '../_shared/alergenos.ts';
import { crearClientes, fallo, hoyEspana, responder, servir } from '../_shared/http.ts';
import type { TipoComida } from '../_shared/nutricion.ts';
import { contarUso, perfilSeguro } from '../_shared/perfil.ts';
import { crearReceta, type Nivel } from '../_shared/recetas.ts';

const MAX_USOS_DIA = 10;
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

  const cuerpo = (await req.json().catch(() => ({}))) as { ingredientes?: unknown[]; tipo?: string };
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

  if (!(await contarUso(admin, user.id, 'cocinar', MAX_USOS_DIA))) {
    return fallo(429, 'limite', 'Hoy ya has creado muchas recetas con lo que tienes. Mañana podrás crear más.');
  }

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
