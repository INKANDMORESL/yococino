import { supabase } from '../../lib/supabase';

export interface Peso {
  id: number;
  fecha: string;
  peso_kg: number;
  nota: string | null;
}

export const MEDIDAS = [
  { clave: 'cintura', texto: 'Cintura' },
  { clave: 'pecho', texto: 'Pecho' },
  { clave: 'abdomen', texto: 'Abdomen' },
  { clave: 'cadera', texto: 'Cadera' },
  { clave: 'brazo', texto: 'Brazo' },
  { clave: 'muslo', texto: 'Muslo' },
] as const;
export type ClaveMedida = (typeof MEDIDAS)[number]['clave'];

export type Medida = { id: number; fecha: string; nota: string | null } & Partial<Record<ClaveMedida, number | null>>;

export interface PerfilPeso {
  peso_inicial_kg: number | null;
  peso_objetivo_kg: number | null;
  objetivo: 'perder' | 'mantener' | 'musculo' | null;
  altura_cm: number | null;
}

// Personas de la familia (adultas) que siguen su progreso en la misma cuenta. null = la persona de la cuenta.
export const MAX_MIEMBROS = 4;
export interface Miembro extends PerfilPeso {
  id: number;
  nombre: string;
}

export async function cargarMiembros(): Promise<Miembro[]> {
  const { data, error } = await supabase
    .from('miembros')
    .select('id, nombre, altura_cm, peso_inicial_kg, objetivo, peso_objetivo_kg')
    .order('created_at');
  // Si la tabla aún no existe en el servidor, simplemente no hay familia.
  if (error) return [];
  return (data ?? []) as Miembro[];
}

export async function crearMiembro(m: {
  nombre: string;
  altura_cm: number;
  peso_inicial_kg: number;
  objetivo: 'perder' | 'mantener' | 'musculo';
  peso_objetivo_kg: number | null;
}): Promise<Miembro> {
  const { data, error } = await supabase
    .from('miembros')
    .insert({ ...m, nombre: m.nombre.trim(), mayor_edad: true })
    .select('id, nombre, altura_cm, peso_inicial_kg, objetivo, peso_objetivo_kg')
    .single();
  if (error || !data) {
    if (error?.message.includes('hasta 4')) throw new Error(`Puedes añadir hasta ${MAX_MIEMBROS} personas.`);
    throw new Error('No se ha podido añadir a esta persona.');
  }
  return data as Miembro;
}

export async function borrarMiembro(id: number) {
  const { error } = await supabase.from('miembros').delete().eq('id', id);
  if (error) throw new Error('No se ha podido quitar a esta persona.');
}

export async function cargarProgreso(miembroId: number | null = null) {
  let qPesos = supabase.from('pesos').select('id, fecha, peso_kg, nota');
  let qMedidas = supabase.from('medidas').select('*');
  qPesos = miembroId === null ? qPesos.is('miembro_id', null) : qPesos.eq('miembro_id', miembroId);
  qMedidas = miembroId === null ? qMedidas.is('miembro_id', null) : qMedidas.eq('miembro_id', miembroId);
  const [pesos, medidas, perfil] = await Promise.all([
    qPesos.order('fecha').order('id'),
    qMedidas.order('fecha').order('id'),
    supabase.from('profiles').select('peso_inicial_kg, peso_objetivo_kg, objetivo, altura_cm').maybeSingle(),
  ]);
  if (pesos.error || medidas.error) throw new Error('No hemos podido cargar tu progreso.');
  return {
    pesos: (pesos.data ?? []).map((p) => ({ ...p, peso_kg: Number(p.peso_kg) })) as Peso[],
    medidas: (medidas.data ?? []) as Medida[],
    perfil: (perfil.data ?? null) as PerfilPeso | null,
  };
}

export async function guardarPeso(userId: string, miembroId: number | null, fecha: string, peso: number, nota: string) {
  const { error } = await supabase.from('pesos').insert({ user_id: userId, miembro_id: miembroId, fecha, peso_kg: peso, nota: nota.trim() || null });
  if (error) throw new Error('No se ha podido guardar el peso.');
}

export async function borrarPeso(id: number) {
  const { error } = await supabase.from('pesos').delete().eq('id', id);
  if (error) throw new Error('No se ha podido borrar el registro.');
}

export async function guardarMedidas(userId: string, miembroId: number | null, fecha: string, valores: Partial<Record<ClaveMedida, number>>) {
  const { error } = await supabase.from('medidas').insert({ user_id: userId, miembro_id: miembroId, fecha, ...valores });
  if (error) throw new Error('No se han podido guardar las medidas.');
}

export async function borrarMedida(id: number) {
  const { error } = await supabase.from('medidas').delete().eq('id', id);
  if (error) throw new Error('No se ha podido borrar el registro.');
}

// ---------- Lo que comes: kcal y macros por día ----------
// Se suman las comidas del menú de la persona de la cuenta. Las cantidades de cada receta son de una ración
// estándar y se ajustan con comidas.factor (la ración de cada persona).
export interface DiaNutricion {
  fecha: string;
  kcal: number; // de las comidas marcadas como hechas
  proteinas: number;
  hidratos: number;
  grasas: number;
  kcalPlan: number; // de todo el menú del día
  proteinasPlan: number;
  hidratosPlan: number;
  grasasPlan: number;
  hechas: number;
  total: number;
}

export async function cargarNutricion(desde: string, hasta: string): Promise<{ dias: DiaNutricion[]; kcalObjetivo: number | null }> {
  const [c, p] = await Promise.all([
    supabase
      .from('comidas')
      .select('fecha, kcal, factor, hecha, receta:recetas(kcal, nutricion)')
      .gte('fecha', desde)
      .lte('fecha', hasta),
    supabase.from('profiles').select('kcal_dia').maybeSingle(),
  ]);
  if (c.error) throw new Error('No hemos podido cargar lo que comes.');
  const porDia = new Map<string, DiaNutricion>();
  const filas = (c.data ?? []) as unknown as {
    fecha: string;
    kcal: number | null;
    factor: number | null;
    hecha: boolean;
    receta: { kcal: number | null; nutricion: Record<string, number | null> | null } | null;
  }[];
  for (const f of filas) {
    const d =
      porDia.get(f.fecha) ??
      { fecha: f.fecha, kcal: 0, proteinas: 0, hidratos: 0, grasas: 0, kcalPlan: 0, proteinasPlan: 0, hidratosPlan: 0, grasasPlan: 0, hechas: 0, total: 0 };
    const factor = Number(f.factor) || 1;
    const n = f.receta?.nutricion ?? {};
    const kcal = Number(f.kcal) || (Number(f.receta?.kcal) || 0) * factor;
    const pr = (Number(n.proteinas) || 0) * factor;
    const hi = (Number(n.hidratos) || 0) * factor;
    const gr = (Number(n.grasas) || 0) * factor;
    d.total++;
    d.kcalPlan += kcal;
    d.proteinasPlan += pr;
    d.hidratosPlan += hi;
    d.grasasPlan += gr;
    if (f.hecha) {
      d.hechas++;
      d.kcal += kcal;
      d.proteinas += pr;
      d.hidratos += hi;
      d.grasas += gr;
    }
    porDia.set(f.fecha, d);
  }
  return { dias: [...porDia.values()].sort((a, b) => a.fecha.localeCompare(b.fecha)), kcalObjetivo: Number(p.data?.kcal_dia) || null };
}
