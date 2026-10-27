// preferencias: «Cuéntanos cómo te gusta comer». Guarda lo que la persona escribe y lo convierte en preferencias
// (por toma y en general) y en alimentos a evitar, siempre dentro de las reglas de la app.
// Para que no cueste: primero se entiende con reglas (gratis); la IA barata solo si no se entiende nada.
// Después quita del menú (desde hoy y sin tocar lo hecho) solo los platos afectados; preparar-menu rellena
// esos huecos sobre todo con recetas que ya existen.
import { ErrorIA, pedirJSON } from '../_shared/claude.ts';
import { crearClientes, fallo, hoyEspana, responder, servir } from '../_shared/http.ts';
import { perfilSeguro, permitirExtra } from '../_shared/perfil.ts';
import {
  encajaPreferencia,
  esNoSaludable,
  interpretarPreferencias,
  NOMBRE_TOMA,
  resumenPreferencias,
  TIPOS_PREF,
  type Preferencias,
  type TipoPref,
} from '../_shared/preferencias.ts';
import { MODELO_RECETA_SENCILLA, texto } from '../_shared/recetas.ts';
import { contieneAlimento } from '../_shared/texto.ts';

const MAX_IA_DIA = 5;
// Para cambiar los platos de una toma ya puestos, tiene que haber suficientes recetas que encajen
// (si no, se aplica a partir de los días nuevos, sin crear platos de golpe).
const MIN_RECETAS_QUE_ENCAJAN = 3;

const lista = { type: 'array', items: { type: 'string' } };
const ESQUEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['salud', 'desayuno', 'media_manana', 'almuerzo', 'merienda', 'cena', 'todas', 'evitar', 'ignorado'],
  properties: {
    salud: { type: 'boolean', description: 'true si habla de una enfermedad, embarazo, medicación o un trastorno alimentario.' },
    desayuno: lista,
    media_manana: lista,
    almuerzo: lista,
    merienda: lista,
    cena: lista,
    todas: { ...lista, description: 'Alimentos que quiere más en general.' },
    evitar: { ...lista, description: 'Alimentos que no quiere.' },
    ignorado: { ...lista, description: 'Lo que pide y no se puede hacer (contar calorías, saltarse comidas, alcohol, ultraprocesados…), en frases muy cortas.' },
  },
};

async function preferencias(req: Request): Promise<Response> {
  const { usuario, admin } = crearClientes(req);
  const { data: auth } = await usuario.auth.getUser();
  const user = auth?.user;
  if (!user) return fallo(401, 'no_autenticado', 'Vuelve a entrar en tu cuenta.');
  const hoy = hoyEspana();
  const seguro = await perfilSeguro(admin, user.id, hoy);
  if ('respuesta' in seguro) return seguro.respuesta;
  const perfil = seguro.perfil as typeof seguro.perfil & { preferencias?: Preferencias | null };

  const cuerpo = (await req.json().catch(() => ({}))) as { texto?: string };
  const escrito = texto(cuerpo.texto, 500);

  // Texto vacío = borrar las preferencias escritas.
  if (!escrito) {
    await admin.from('profiles').update({ preferencias_texto: null, preferencias: null }).eq('id', user.id);
    return responder({ ok: true, entendido: [], ignorado: [], quitadas: 0 });
  }

  let { prefs, ignorado, entendido } = interpretarPreferencias(escrito);
  let salud = false;
  if (!entendido) {
    // No se ha entendido con reglas: modelo barato, con límite y presupuesto como cualquier extra.
    const bloqueo = await permitirExtra(admin, user.id, 'preferencias', MAX_IA_DIA);
    if (bloqueo) return bloqueo;
    try {
      const r = await pedirJSON<Record<string, unknown>>({
        modelo: MODELO_RECETA_SENCILLA,
        sistema: `Interpretas lo que una persona adulta escribe sobre cómo le gusta comer, para una app de menús caseros y saludables de cocina mediterránea española.
Devuelve alimentos o platos concretos, cortos (1 a 3 palabras, en minúscula, sin artículos), por toma: desayuno, media_manana, almuerzo (comida del mediodía), merienda, cena, o "todas" si es en general. En "evitar", lo que no quiere.
No inventes nada que no diga. No aceptes como preferencia nada poco saludable (alcohol, refrescos, bollería, comida rápida, ultraprocesados, suplementos) ni cambios de cantidades, calorías o número de comidas: ponlo en "ignorado".
Si habla de una enfermedad, embarazo, medicación o un trastorno de la conducta alimentaria, marca salud = true.`,
        mensaje: escrito,
        esquema: ESQUEMA,
        maxTokens: 1500,
      });
      salud = r.salud === true;
      const limpia = (v: unknown) => (Array.isArray(v) ? v.map((x) => texto(x, 30).toLowerCase()).filter((x) => x.length >= 3).slice(0, 8) : []);
      prefs = { mas: {}, evitar: limpia(r.evitar) };
      for (const t of TIPOS_PREF) {
        const l = limpia(r[t]).filter((x) => !esNoSaludable(x));
        if (l.length) prefs.mas[t] = l;
      }
      ignorado = limpia(r.ignorado);
    } catch (e) {
      if (e instanceof ErrorIA && e.noConfigurada) throw e;
      return fallo(502, 'ia', 'No hemos podido entenderlo. Prueba con frases como «me gusta desayunar tostadas» o «no me gusta el pimiento».');
    }
  }
  if (salud) {
    return fallo(
      422,
      'salud',
      'Lo que nos cuentas tiene que ver con tu salud. Para eso, lo mejor es que lo consultes con un dietista-nutricionista o tu médico, y lo indiques en Perfil → Tu salud.',
    );
  }

  const entendidoTexto = resumenPreferencias(prefs);
  if (!entendidoTexto.length) {
    return responder({ ok: true, entendido: [], ignorado: ignorado.length ? ignorado : ['No hemos encontrado ningún alimento en lo que has escrito.'], quitadas: 0 });
  }

  // Lo que no quiere se suma a «no me gusta» (así lo respetan todas las funciones).
  const noGusta: string[] = perfil.no_me_gusta ?? [];
  const nuevosNoGusta = prefs.evitar.filter((x) => !noGusta.some((y) => y.toLowerCase() === x.toLowerCase()));
  const antes: Preferencias = perfil.preferencias ?? { mas: {}, evitar: [] };
  await admin
    .from('profiles')
    .update({ preferencias_texto: escrito, preferencias: prefs, no_me_gusta: [...noGusta, ...nuevosNoGusta] })
    .eq('id', user.id);

  // Platos afectados de hoy en adelante (sin tocar los hechos).
  const { data } = await admin
    .from('comidas')
    .select('id, tipo_comida, receta:recetas(nombre, ingredientes(nombre))')
    .eq('user_id', user.id)
    .eq('hecha', false)
    .gte('fecha', hoy);
  type Fila = { id: number; tipo_comida: string; receta: { nombre: string; ingredientes: { nombre: string }[] } | null };
  const filas = (data ?? []) as unknown as Fila[];
  const quitar = new Set<number>();
  // 1. Lo que lleva algo que no quiere.
  for (const c of filas) {
    if (c.receta && nuevosNoGusta.some((al) => [c.receta!.nombre, ...c.receta!.ingredientes.map((i) => i.nombre)].some((t) => contieneAlimento(t, al)))) quitar.add(c.id);
  }
  // 2. Tomas con una preferencia nueva («me gusta desayunar pan»): se cambian los que no encajan,
  //    solo si hay recetas suficientes que encajen (para reutilizarlas y no gastar en platos nuevos).
  const cambiadas: string[] = [];
  for (const t of TIPOS_PREF) {
    if (t === 'todas') continue;
    const nuevos = (prefs.mas[t] ?? []).filter((x) => !(antes.mas?.[t] ?? []).includes(x));
    if (!nuevos.length) continue;
    const { data: cat } = await admin
      .from('recetas')
      .select('nombre, ingredientes(nombre)')
      .eq('tipo_comida', t)
      .eq('oculta', false)
      .limit(800);
    const encajan = ((cat ?? []) as { nombre: string; ingredientes: { nombre: string }[] }[]).filter((r) => encajaPreferencia(r, prefs.mas[t] ?? []));
    if (encajan.length < MIN_RECETAS_QUE_ENCAJAN) continue;
    for (const c of filas) {
      if (c.tipo_comida === t && c.receta && !encajaPreferencia(c.receta, prefs.mas[t] ?? [])) quitar.add(c.id);
    }
    cambiadas.push(NOMBRE_TOMA[t as TipoPref]);
  }
  if (quitar.size) await admin.from('comidas').delete().in('id', [...quitar]).eq('user_id', user.id);
  return responder({ ok: true, entendido: entendidoTexto, ignorado, quitadas: quitar.size, cambiadas });
}

servir('preferencias', preferencias, 'No hemos podido guardar tus preferencias. Vuelve a intentarlo en un momento.');
