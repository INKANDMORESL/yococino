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

export async function guardarPreferencias(userId: string, e: Encuesta, cambiaronAlergias: boolean) {
  const { error } = await supabase
    .from('profiles')
    .update({
      nombre: e.nombre.trim().slice(0, 40) || null,
      objetivo: e.objetivo,
      peso_objetivo_kg: e.objetivo === 'perder' ? numero(e.pesoObjetivo) : null,
      actividad: e.actividad,
      nivel_cocina: e.nivel,
      comidas_dia: e.comidas,
      alergias: e.alergias,
      condiciones: e.condiciones,
      no_me_gusta: e.noMeGusta,
      num_peques: e.hayPeques ? e.numPeques : 0,
      franjas_peques: e.hayPeques ? e.franjasPeques : [],
    })
    .eq('id', userId);
  if (error) throw new Error('No hemos podido guardar los cambios.');
  // Con alergias nuevas, por seguridad se rehace también lo que queda de hoy.
  const hoy = hoyISO();
  await rehacerMenuDesde(cambiaronAlergias ? hoy : sumarDias(hoy, 1));
}

// "No me gusta" desde una receta: se guarda y se quitan los próximos días que lo llevan.
export async function anadirNoMeGusta(userId: string, alimento: string): Promise<number> {
  const { data: p } = await supabase.from('profiles').select('no_me_gusta').eq('id', userId).maybeSingle();
  const lista: string[] = p?.no_me_gusta ?? [];
  if (!lista.some((x) => x.toLowerCase() === alimento.toLowerCase())) {
    const { error } = await supabase.from('profiles').update({ no_me_gusta: [...lista, alimento] }).eq('id', userId);
    if (error) throw new Error('No hemos podido guardarlo.');
  }
  const { data } = await supabase
    .from('comidas')
    .select('id, receta:recetas(nombre, ingredientes(nombre))')
    .eq('hecha', false)
    .gt('fecha', hoyISO());
  const afectadas = ((data ?? []) as unknown as { id: number; receta: { nombre: string; ingredientes: { nombre: string }[] } | null }[])
    .filter((c) => c.receta && [c.receta.nombre, ...c.receta.ingredientes.map((i) => i.nombre)].some((t) => contieneAlimento(t, alimento)))
    .map((c) => c.id);
  if (afectadas.length) await supabase.from('comidas').delete().in('id', afectadas);
  return afectadas.length;
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

export async function cargarFavoritas(): Promise<{ id: number; nombre: string; tipo_comida: string }[]> {
  const { data } = await supabase.from('favoritas').select('receta:recetas(id, nombre, tipo_comida)').order('created_at', { ascending: false });
  return ((data ?? []) as unknown as { receta: { id: number; nombre: string; tipo_comida: string } | null }[])
    .map((f) => f.receta)
    .filter((r): r is { id: number; nombre: string; tipo_comida: string } => !!r);
}

export async function borrarCuenta() {
  const { error } = await supabase.functions.invoke('borrar-cuenta', { body: {} });
  if (error) throw new Error('No hemos podido borrar tu cuenta. Inténtalo de nuevo o escríbenos.');
  await supabase.auth.signOut();
}
