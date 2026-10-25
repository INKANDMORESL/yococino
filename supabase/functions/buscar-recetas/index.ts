// buscar-recetas: recetario con buscador. Devuelve solo recetas aptas para la persona
// (sin sus alergias ni lo que no le gusta). Busca por nombre del plato y por ingrediente.
import { restriccionesDe } from '../_shared/alergenos.ts';
import { crearClientes, fallo, responder, servir } from '../_shared/http.ts';
import { esApta, type RecetaGuardada } from '../_shared/recetas.ts';
import { normalizar } from '../_shared/texto.ts';
import { CATEGORIAS, categoriasDe, SUBCATEGORIAS } from '../_shared/categorias.ts';

const TIPOS = ['desayuno', 'media_manana', 'almuerzo', 'merienda', 'cena'];
const MAX_RESULTADOS = 60;
const COLUMNAS = 'id, nombre, descripcion, tipo_comida, nivel, minutos, kcal, imagen, imagen_mini, alergenos, aparatos, nota_airfryer, ingredientes(nombre, nota)';

async function buscar(req: Request): Promise<Response> {
  const { usuario, admin } = crearClientes(req);
  const { data: auth } = await usuario.auth.getUser();
  const user = auth?.user;
  if (!user) return fallo(401, 'no_autenticado', 'Vuelve a entrar en tu cuenta.');

  const cuerpo = (await req.json().catch(() => ({}))) as { texto?: string; tipo?: string | null; categoria?: string | null; sub?: string | null };
  const categoria = (CATEGORIAS as readonly string[]).includes(cuerpo.categoria ?? '') ? (cuerpo.categoria as string) : null;
  const sub = categoria && SUBCATEGORIAS[categoria]?.[cuerpo.sub ?? ''] ? (cuerpo.sub as string) : null;
  const q = normalizar(String(cuerpo.texto ?? '')).slice(0, 60);
  const tipo = TIPOS.includes(cuerpo.tipo ?? '') ? (cuerpo.tipo as string) : null;

  const { data: perfil } = await admin.from('profiles').select('alergias, no_me_gusta, aparatos').eq('id', user.id).maybeSingle();
  const restr = restriccionesDe((perfil?.alergias as string[] | null) ?? [], (perfil?.no_me_gusta as string[] | null) ?? [], perfil?.aparatos);

  // Recetas cuyo nombre coincide y recetas que llevan ese ingrediente.
  let ids: number[] | null = null;
  if (q) {
    const comodin = `%${q.replace(/[%_]/g, '')}%`;
    const [porNombre, porIngrediente] = await Promise.all([
      admin.from('recetas').select('id').ilike('nombre_norm', comodin).limit(300),
      admin.from('ingredientes').select('receta_id').ilike('nombre', `%${String(cuerpo.texto ?? '').trim().slice(0, 60).replace(/[%_]/g, '')}%`).limit(300),
    ]);
    ids = [
      ...new Set([
        ...(porNombre.data ?? []).map((r) => r.id as number),
        ...(porIngrediente.data ?? []).map((r) => r.receta_id as number),
      ]),
    ];
    if (!ids.length) return responder({ ok: true, recetas: [] });
  }

  let consulta = admin.from('recetas').select(COLUMNAS).neq('tipo_comida', 'otro').eq('oculta', false);
  if (ids) consulta = consulta.in('id', ids.slice(0, 300));
  if (tipo) consulta = consulta.eq('tipo_comida', tipo);
  // Con filtro de categoría se miran más recetas, porque la categoría se calcula aquí a partir de los ingredientes.
  const { data, error } = await consulta.order('created_at', { ascending: false }).limit(categoria ? 2000 : 300);
  if (error) throw error;

  const recetas = ((data ?? []) as unknown as (RecetaGuardada & Record<string, unknown>)[])
    .filter((r) => esApta(r, restr))
    .filter((r) => {
      if (!categoria) return true;
      const c = categoriasDe(r);
      return (c.categorias as string[]).includes(categoria) && (!sub || c.sub.includes(sub));
    })
    .slice(0, MAX_RESULTADOS)
    .map(({ id, nombre, descripcion, tipo_comida, nivel, minutos, kcal, imagen, imagen_mini }) => ({ id, nombre, descripcion, tipo_comida, nivel, minutos, kcal, imagen, imagen_mini }));
  return responder({ ok: true, recetas });
}

servir('buscar-recetas', buscar, 'No hemos podido buscar recetas. Vuelve a intentarlo en un momento.');
