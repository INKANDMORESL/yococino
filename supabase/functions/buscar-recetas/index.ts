// buscar-recetas: recetario con buscador. Devuelve solo recetas aptas para la persona
// (sin sus alergias ni lo que no le gusta). Busca por nombre del plato y por ingrediente.
import { recetasDenunciadas } from '../_shared/denuncias.ts';
import { restriccionesDe } from '../_shared/alergenos.ts';
import { crearClientes, fallo, hoyEspana, responder, servir } from '../_shared/http.ts';
import { esApta, type RecetaGuardada } from '../_shared/recetas.ts';
import { normalizar } from '../_shared/texto.ts';
import { CATEGORIAS, categoriasDe, SUBCATEGORIAS } from '../_shared/categorias.ts';
import { especialesDe, especialPorClave } from '../_shared/especiales.ts';
import { textoAvisos } from '../_shared/importar_reglas.ts';

const TIPOS = ['desayuno', 'media_manana', 'almuerzo', 'merienda', 'cena'];
const MAX_RESULTADOS = 60;
const POR_FILA = 5;
const COLUMNAS = 'id, nombre, descripcion, tipo_comida, nivel, minutos, kcal, imagen, imagen_mini, alergenos, aparatos, nota_airfryer, solo_especial, dulce, avisos, ingredientes(nombre, nota)';

async function buscar(req: Request): Promise<Response> {
  const { usuario, admin } = crearClientes(req);
  const { data: auth } = await usuario.auth.getUser();
  const user = auth?.user;
  if (!user) return fallo(401, 'no_autenticado', 'Vuelve a entrar en tu cuenta.');

  const cuerpo = (await req.json().catch(() => ({}))) as {
    texto?: string;
    tipo?: string | null;
    categoria?: string | null;
    sub?: string | null;
    desde?: number;
    cuantas?: number;
    filas?: boolean;
  };
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
    if (!ids.length) return responder({ ok: true, recetas: [], siguiente: null });
  }

  const denunciadas = await recetasDenunciadas(admin, user.id);
  const enMarcha = new Set(especialesDe(hoyEspana()).map((e) => e.clave));
  const vale = (r: Fila, etiqueta: Map<number, string>) =>
    !denunciadas.has(r.id as number) && (!r.solo_especial || etiqueta.has(r.id as number)) && esApta(r, restr);

  // Portada del recetario: unas pocas recetas de cada tipo, distintas cada día.
  if (cuerpo.filas) {
    const semilla = `${hoyEspana()}|${user.id}`;
    const filas: Record<string, ReturnType<typeof resumen>[]> = {};
    await Promise.all(
      TIPOS.map(async (t) => {
        const { data, error } = await admin
          .from('recetas')
          .select(COLUMNAS)
          .eq('tipo_comida', t)
          .eq('oculta', false)
          .not('imagen', 'is', null)
          .order('created_at', { ascending: false })
          .limit(200);
        if (error) throw error;
        const aptas = ((data ?? []) as unknown as Fila[]).filter((r) => !r.solo_especial && vale(r, new Map()));
        filas[t] = barajar(aptas, `${semilla}|${t}`).slice(0, POR_FILA).map((r) => resumen(r, new Map()));
      }),
    );
    return responder({ ok: true, filas });
  }

  // Recetario por páginas: «desde» es la posición en la tabla por la que seguir (la devuelve la llamada anterior).
  const cuantas = Math.min(Math.max(Math.floor(Number(cuerpo.cuantas) || MAX_RESULTADOS), 1), MAX_RESULTADOS);
  let desde = Math.max(0, Math.floor(Number(cuerpo.desde) || 0));
  // Con filtro de categoría se miran más recetas por tanda, porque la categoría se calcula aquí a partir de los ingredientes.
  const tanda = categoria ? 600 : 300;
  const lista: ReturnType<typeof resumen>[] = [];
  let siguiente: number | null = null;
  for (let vuelta = 0; vuelta < 6; vuelta++) {
    // Los postres de los especiales de temporada («otro») también salen en el recetario.
    let consulta = admin.from('recetas').select(COLUMNAS).or('tipo_comida.neq.otro,solo_especial.eq.true').eq('oculta', false);
    if (ids) consulta = consulta.in('id', ids.slice(0, 300));
    if (tipo) consulta = consulta.eq('tipo_comida', tipo);
    const { data, error } = await consulta
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(desde, desde + tanda - 1);
    if (error) throw error;
    const filas = (data ?? []) as unknown as Fila[];
    const etiqueta = await etiquetasEspecial(admin, filas, enMarcha);
    let lleno = false;
    for (let j = 0; j < filas.length; j++) {
      const r = filas[j];
      if (!vale(r, etiqueta)) continue;
      if (categoria) {
        const c = categoriasDe(r);
        if (!(c.categorias as string[]).includes(categoria) || (sub && !c.sub.includes(sub))) continue;
      }
      lista.push(resumen(r, etiqueta));
      if (lista.length >= cuantas) {
        siguiente = j + 1 < filas.length || filas.length === tanda ? desde + j + 1 : null;
        lleno = true;
        break;
      }
    }
    if (lleno) break;
    if (filas.length < tanda) {
      siguiente = null; // no hay más recetas
      break;
    }
    desde += tanda;
    siguiente = desde; // si se acaban las vueltas, se sigue desde aquí
  }
  return responder({ ok: true, recetas: lista, siguiente });
}

type Fila = RecetaGuardada & Record<string, unknown>;

// Recetas hechas para un especial de temporada: solo salen mientras dura su especial
// (pasada la temporada ya no aparecen en el recetario; quien la guardó la sigue teniendo en Favoritas).
// Devuelve la etiqueta del especial («🎄 Especial Navidad») de las que están en marcha.
async function etiquetasEspecial(admin: ReturnType<typeof crearClientes>['admin'], filas: Fila[], enMarcha: Set<string>) {
  const etiqueta = new Map<number, string>();
  const idsEspeciales = filas.filter((r) => r.solo_especial).map((r) => r.id as number);
  if (!idsEspeciales.length) return etiqueta;
  const { data: esp } = await admin.from('especial_recetas').select('especial, receta_id').in('receta_id', idsEspeciales.slice(0, 1000));
  for (const e of (esp ?? []) as { especial: string; receta_id: number }[]) {
    const def = especialPorClave(e.especial);
    if (def && enMarcha.has(def.clave) && !etiqueta.has(e.receta_id)) etiqueta.set(e.receta_id, `${def.emoji} ${def.titulo}`);
  }
  return etiqueta;
}

function resumen(r: Fila, etiqueta: Map<number, string>) {
  const { id, nombre, descripcion, tipo_comida, nivel, minutos, kcal, imagen, imagen_mini, avisos, dulce } = r;
  return {
    id,
    nombre,
    descripcion,
    tipo_comida,
    nivel,
    minutos,
    kcal,
    imagen,
    imagen_mini,
    // Dulces: se ven en el recetario con su etiqueta, pero nunca entran en el menú.
    especial: etiqueta.get(id as number) ?? (dulce ? '🍰 Toque dulce' : null),
    aviso: textoAvisos((avisos as string[] | null) ?? []),
  };
}

// Baraja siempre igual para la misma semilla (cambia cada día y para cada persona).
function barajar<T>(lista: T[], semilla: string): T[] {
  let h = 2166136261;
  for (const c of semilla) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const azar = () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

servir('buscar-recetas', buscar, 'No hemos podido buscar recetas. Vuelve a intentarlo en un momento.');
