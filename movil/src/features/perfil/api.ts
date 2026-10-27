// Preferencias del perfil, favoritas y borrado de cuenta.
import { supabase } from '../../lib/supabase';
import { contieneAlimento } from '../../lib/texto';
import { encuestaVacia, numero, type Encuesta } from '../encuesta/modelo';
import { hoyISO, sumarDias } from '../menu/fechas';

export interface PerfilCompleto {
  nombre: string | null;
  fecha_nacimiento: string | null;
  sexo: Encuesta['sexo'];
  altura_cm: number | null;
  peso_inicial_kg: number | null;
  objetivo: Encuesta['objetivo'];
  peso_objetivo_kg: number | null;
  actividad: Encuesta['actividad'];
  nivel_cocina: Encuesta['nivel'];
  aparatos: Encuesta['aparatos'] | null;
  comidas_dia: number | null;
  alergias: string[] | null;
  condiciones: string[] | null;
  no_me_gusta: string[] | null;
  num_peques: number | null;
  franjas_peques: Encuesta['franjasPeques'] | null;
  kcal_dia: number | null;
}

export async function cargarPerfil(): Promise<{ perfil: PerfilCompleto | null; pesoActual: number | null }> {
  const [p, peso] = await Promise.all([
    supabase.from('profiles').select('*').maybeSingle(),
    supabase.from('pesos').select('peso_kg').is('miembro_id', null).order('fecha', { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (p.error) throw new Error('No hemos podido cargar tu perfil.');
  return { perfil: p.data as PerfilCompleto | null, pesoActual: peso.data ? Number(peso.data.peso_kg) : null };
}

const texto = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n).replace('.', ','));

// Convierte el perfil guardado al formato de la encuesta, para reutilizar sus pantallas.
export function aEncuesta(p: PerfilCompleto, pesoActual: number | null): Encuesta {
  const [ano = '', mes = '', dia = ''] = (p.fecha_nacimiento ?? '').split('-');
  const comidas = p.comidas_dia === 3 || p.comidas_dia === 4 ? p.comidas_dia : 5;
  return {
    ...encuestaVacia,
    nombre: p.nombre ?? '',
    nacimiento: { dia, mes, ano },
    sexo: p.sexo,
    altura: texto(p.altura_cm),
    peso: texto(pesoActual ?? p.peso_inicial_kg),
    objetivo: p.objetivo,
    pesoObjetivo: texto(p.peso_objetivo_kg),
    actividad: p.actividad,
    alergias: p.alergias ?? [],
    condiciones: p.condiciones ?? [],
    noMeGusta: p.no_me_gusta ?? [],
    nivel: p.nivel_cocina,
    aparatos: p.aparatos ?? encuestaVacia.aparatos,
    comidas,
    hayPeques: (p.num_peques ?? 0) > 0,
    numPeques: Math.max(1, p.num_peques ?? 1),
    franjasPeques: p.franjas_peques ?? [],
  };
}

// Borra los días de menú aún no hechos desde una fecha, para que se vuelvan a preparar con los cambios.
async function rehacerMenuDesde(fecha: string) {
  const { error } = await supabase.from('comidas').delete().eq('hecha', false).gte('fecha', fecha);
  if (error) throw new Error('Se guardaron tus cambios, pero no pudimos rehacer el menú.');
}

export type CambioMenu = 'todo_hoy' | 'todo_manana' | 'solo_afectadas';

// Qué hay que rehacer del menú al cambiar las preferencias:
// - alergias o salud: por seguridad, todo desde hoy;
// - objetivo, actividad o número de comidas: cambian las cantidades, todo desde mañana;
// - gustos o aparatos de cocina: solo los platos afectados (lo demás se queda, por si ya se ha hecho la compra).
export function cambioMenu(e: Encuesta, antes: Encuesta): CambioMenu {
  const igual = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  const orden = (l: string[]) => [...l].sort();
  if (!igual(orden(e.alergias), orden(antes.alergias)) || !igual(orden(e.condiciones), orden(antes.condiciones))) return 'todo_hoy';
  if (e.objetivo !== antes.objetivo || e.actividad !== antes.actividad || e.comidas !== antes.comidas || (e.objetivo === 'perder' && e.pesoObjetivo !== antes.pesoObjetivo)) {
    return 'todo_manana';
  }
  return 'solo_afectadas';
}

// Devuelve cuántas comidas se han quitado para rehacerlas (o null si se rehace todo).
export async function guardarPreferencias(userId: string, e: Encuesta, antes: Encuesta): Promise<{ cambio: CambioMenu; quitadas: number | null }> {
  const { error } = await supabase
    .from('profiles')
    .update({
      nombre: e.nombre.trim().slice(0, 40) || null,
      objetivo: e.objetivo,
      peso_objetivo_kg: e.objetivo === 'perder' ? numero(e.pesoObjetivo) : null,
      actividad: e.actividad,
      nivel_cocina: e.nivel,
      aparatos: e.aparatos,
      comidas_dia: e.comidas,
      alergias: e.alergias,
      condiciones: e.condiciones,
      no_me_gusta: e.noMeGusta,
      num_peques: e.hayPeques ? e.numPeques : 0,
      franjas_peques: e.hayPeques ? e.franjasPeques : [],
    })
    .eq('id', userId);
  if (error) throw new Error('No hemos podido guardar los cambios.');
  const cambio = cambioMenu(e, antes);
  const hoy = hoyISO();
  if (cambio === 'todo_hoy') {
    await rehacerMenuDesde(hoy);
    return { cambio, quitadas: null };
  }
  if (cambio === 'todo_manana') {
    await rehacerMenuDesde(sumarDias(hoy, 1));
    return { cambio, quitadas: null };
  }
  const nuevosNoGusta = e.noMeGusta.filter((x) => !antes.noMeGusta.some((y) => y.toLowerCase() === x.toLowerCase()));
  const sinAparatos = (antes.aparatos ?? []).filter((a) => !(e.aparatos ?? []).includes(a));
  if (!nuevosNoGusta.length && !sinAparatos.length) return { cambio, quitadas: 0 };
  return { cambio, quitadas: await quitarAfectadas(nuevosNoGusta, e.aparatos ?? []) };
}

// Quita del menú (desde hoy y sin tocar lo ya hecho) solo los platos que llevan algo que no le gusta
// o que necesitan un aparato que no tiene. Al volver a Inicio, el servidor rellena solo esos huecos.
async function quitarAfectadas(noGusta: string[], aparatos: string[]): Promise<number> {
  const { data } = await supabase
    .from('comidas')
    .select('id, receta:recetas(nombre, aparatos, nota_airfryer, ingredientes(nombre))')
    .eq('hecha', false)
    .gte('fecha', hoyISO());
  type Fila = { id: number; receta: { nombre: string; aparatos: string[] | null; nota_airfryer: string | null; ingredientes: { nombre: string }[] } | null };
  const faltaAparato = (r: NonNullable<Fila['receta']>) =>
    (r.aparatos ?? []).some((a) => !aparatos.includes(a) && !(a === 'horno' && aparatos.includes('airfryer') && (r.nota_airfryer ?? '').trim()));
  const afectadas = ((data ?? []) as unknown as Fila[])
    .filter(
      (c) =>
        c.receta &&
        (noGusta.some((al) => [c.receta!.nombre, ...c.receta!.ingredientes.map((i) => i.nombre)].some((t) => contieneAlimento(t, al))) || faltaAparato(c.receta)),
    )
    .map((c) => c.id);
  if (afectadas.length) {
    const { error } = await supabase.from('comidas').delete().in('id', afectadas);
    if (error) throw new Error('Se guardaron tus cambios, pero no pudimos cambiar los platos afectados.');
  }
  return afectadas.length;
}

// "No me gusta" desde una receta: se guarda y se quitan los próximos días que lo llevan.
export async function anadirNoMeGusta(userId: string, alimento: string): Promise<number> {
  const { data: p } = await supabase.from('profiles').select('no_me_gusta, aparatos').eq('id', userId).maybeSingle();
  const lista: string[] = p?.no_me_gusta ?? [];
  if (!lista.some((x) => x.toLowerCase() === alimento.toLowerCase())) {
    const { error } = await supabase.from('profiles').update({ no_me_gusta: [...lista, alimento] }).eq('id', userId);
    if (error) throw new Error('No hemos podido guardarlo.');
  }
  // Solo se cambian los platos que lo llevan; para no tocar nada por los aparatos, se pasan todos.
  return quitarAfectadas([alimento], ['horno', 'airfryer', 'microondas', 'robot']);
}

// Peques en casa (solo si la persona lo dijo en la encuesta) y sus franjas de edad.
export async function pequesEnCasa(): Promise<{ hay: boolean; franjas: string[] }> {
  const { data } = await supabase.from('profiles').select('num_peques, franjas_peques').maybeSingle();
  const franjas = ((data?.franjas_peques as string[] | null) ?? []).filter(Boolean);
  return { hay: (Number(data?.num_peques) || 0) > 0 || franjas.length > 0, franjas };
}

export async function esFavorita(recetaId: number): Promise<boolean> {
  const { data } = await supabase.from('favoritas').select('receta_id').eq('receta_id', recetaId).maybeSingle();
  return !!data;
}

export async function cambiarFavorita(userId: string, recetaId: number, favorita: boolean) {
  const { error } = favorita
    ? await supabase.from('favoritas').upsert({ user_id: userId, receta_id: recetaId })
    : await supabase.from('favoritas').delete().eq('receta_id', recetaId);
  if (error) throw new Error('No se ha podido guardar.');
}

// Las favoritas se ven siempre, también las de un especial de temporada que ya ha pasado.
export interface Favorita {
  id: number;
  nombre: string;
  tipo_comida: string;
  descripcion: string | null;
  nivel: string;
  minutos: number | null;
  kcal: number | null;
  imagen: string | null;
  imagen_mini: string | null;
}

export async function cargarFavoritas(): Promise<Favorita[]> {
  const { data } = await supabase
    .from('favoritas')
    .select('receta:recetas(id, nombre, tipo_comida, descripcion, nivel, minutos, kcal, imagen, imagen_mini)')
    .order('created_at', { ascending: false });
  return ((data ?? []) as unknown as { receta: Favorita | null }[]).map((f) => f.receta).filter((r): r is Favorita => !!r);
}

export async function borrarCuenta() {
  const { error } = await supabase.functions.invoke('borrar-cuenta', { body: {} });
  if (error) throw new Error('No hemos podido borrar tu cuenta. Inténtalo de nuevo o escríbenos.');
  await supabase.auth.signOut();
}
