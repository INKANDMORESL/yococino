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

export async function cargarProgreso() {
  const [pesos, medidas, perfil] = await Promise.all([
    supabase.from('pesos').select('id, fecha, peso_kg, nota').order('fecha').order('id'),
    supabase.from('medidas').select('*').order('fecha').order('id'),
    supabase.from('profiles').select('peso_inicial_kg, peso_objetivo_kg, objetivo, altura_cm').maybeSingle(),
  ]);
  if (pesos.error || medidas.error) throw new Error('No hemos podido cargar tu progreso.');
  return {
    pesos: (pesos.data ?? []).map((p) => ({ ...p, peso_kg: Number(p.peso_kg) })) as Peso[],
    medidas: (medidas.data ?? []) as Medida[],
    perfil: (perfil.data ?? null) as PerfilPeso | null,
  };
}

export async function guardarPeso(userId: string, fecha: string, peso: number, nota: string) {
  const { error } = await supabase.from('pesos').insert({ user_id: userId, fecha, peso_kg: peso, nota: nota.trim() || null });
  if (error) throw new Error('No se ha podido guardar el peso.');
}

export async function borrarPeso(id: number) {
  const { error } = await supabase.from('pesos').delete().eq('id', id);
  if (error) throw new Error('No se ha podido borrar el registro.');
}

export async function guardarMedidas(userId: string, fecha: string, valores: Partial<Record<ClaveMedida, number>>) {
  const { error } = await supabase.from('medidas').insert({ user_id: userId, fecha, ...valores });
  if (error) throw new Error('No se han podido guardar las medidas.');
}

export async function borrarMedida(id: number) {
  const { error } = await supabase.from('medidas').delete().eq('id', id);
  if (error) throw new Error('No se ha podido borrar el registro.');
}
