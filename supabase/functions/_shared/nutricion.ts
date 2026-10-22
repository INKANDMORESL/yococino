// Cálculo prudente de energía diaria y reparto entre comidas.
// Fórmula de Mifflin-St Jeor y factores de actividad habituales.
// Los límites (mínimos y déficit) viven en la tabla ajustes_nutricion para que un
// dietista-nutricionista los pueda validar o cambiar sin tocar el código.

export type Sexo = 'mujer' | 'hombre' | 'otro';
export type Objetivo = 'perder' | 'mantener' | 'musculo';
export type Actividad = 'nada' | 'poca' | 'media' | 'alta';
export type TipoComida = 'desayuno' | 'media_manana' | 'almuerzo' | 'merienda' | 'cena';

export interface Ajustes {
  kcal_minimo_mujer: number;
  kcal_minimo_hombre: number;
  deficit_pct: number; // 0.15 = 15 %
  deficit_max_kcal: number;
  superavit_pct: number;
}

export const AJUSTES_POR_DEFECTO: Ajustes = {
  kcal_minimo_mujer: 1400,
  kcal_minimo_hombre: 1700,
  deficit_pct: 0.15,
  deficit_max_kcal: 500,
  superavit_pct: 0.1,
};

export interface DatosPersona {
  sexo: Sexo;
  edad: number;
  alturaCm: number;
  pesoKg: number;
  pesoObjetivoKg: number | null;
  objetivo: Objetivo;
  actividad: Actividad;
}

const FACTOR_ACTIVIDAD: Record<Actividad, number> = { nada: 1.2, poca: 1.375, media: 1.55, alta: 1.725 };

// Años cumplidos en una fecha (AAAA-MM-DD).
export function edadEn(fechaNacimiento: string, hoy: string): number {
  const [an, mn, dn] = fechaNacimiento.split('-').map(Number);
  const [ah, mh, dh] = hoy.split('-').map(Number);
  let edad = ah - an;
  if (mh < mn || (mh === mn && dh < dn)) edad -= 1;
  return edad;
}

export function metabolismoBasal(p: DatosPersona): number {
  const base = 10 * p.pesoKg + 6.25 * p.alturaCm - 5 * p.edad;
  const ajuste = p.sexo === 'hombre' ? 5 : p.sexo === 'mujer' ? -161 : -78;
  return base + ajuste;
}

export function minimoDiario(sexo: Sexo, a: Ajustes): number {
  if (sexo === 'mujer') return a.kcal_minimo_mujer;
  if (sexo === 'hombre') return a.kcal_minimo_hombre;
  return Math.round((a.kcal_minimo_mujer + a.kcal_minimo_hombre) / 2);
}

const redondear10 = (n: number) => Math.round(n / 10) * 10;

export interface Energia {
  kcal: number; // objetivo diario
  gasto: number; // gasto estimado
  minimo: number;
  objetivoAplicado: Objetivo;
}

export function energiaDiaria(p: DatosPersona, a: Ajustes = AJUSTES_POR_DEFECTO): Energia {
  const gasto = metabolismoBasal(p) * FACTOR_ACTIVIDAD[p.actividad];
  const minimo = minimoDiario(p.sexo, a);
  // Si ya está en su peso objetivo, se mantiene en lugar de seguir bajando.
  const objetivoAplicado: Objetivo =
    p.objetivo === 'perder' && p.pesoObjetivoKg !== null && p.pesoKg <= p.pesoObjetivoKg ? 'mantener' : p.objetivo;

  let kcal = gasto;
  if (objetivoAplicado === 'perder') kcal = gasto - Math.min(gasto * a.deficit_pct, a.deficit_max_kcal);
  if (objetivoAplicado === 'musculo') kcal = gasto * (1 + a.superavit_pct);
  kcal = Math.max(kcal, minimo);
  return { kcal: redondear10(kcal), gasto: redondear10(gasto), minimo, objetivoAplicado };
}

// Qué comidas se hacen según cuántas al día, y qué parte de la energía lleva cada una.
export const REPARTO: Record<3 | 4 | 5, Partial<Record<TipoComida, number>>> = {
  3: { desayuno: 0.25, almuerzo: 0.4, cena: 0.35 },
  4: { desayuno: 0.25, almuerzo: 0.35, merienda: 0.15, cena: 0.25 },
  5: { desayuno: 0.2, media_manana: 0.1, almuerzo: 0.35, merienda: 0.1, cena: 0.25 },
};

export const ORDEN_COMIDAS: TipoComida[] = ['desayuno', 'media_manana', 'almuerzo', 'merienda', 'cena'];

export function comidasDelDia(numero: number): { tipo: TipoComida; parte: number }[] {
  const n = (numero === 3 || numero === 4 ? numero : 5) as 3 | 4 | 5;
  const reparto = REPARTO[n];
  return ORDEN_COMIDAS.filter((t) => reparto[t] !== undefined).map((t) => ({ tipo: t, parte: reparto[t] as number }));
}

// Energía de una ración estándar de cada receta compartida (referencia de 2.000 kcal al día).
// Luego cada persona recibe un factor para ajustar las cantidades a su plan.
export const KCAL_RACION_ESTANDAR: Record<TipoComida, number> = {
  desayuno: 400,
  media_manana: 200,
  almuerzo: 700,
  merienda: 200,
  cena: 500,
};

// Factor por el que multiplicar las cantidades de la receta. Entre 0,6 y 1,6, en pasos de 0,05.
export function factorRacion(kcalObjetivoComida: number, kcalReceta: number | null | undefined): number {
  if (!kcalReceta || kcalReceta <= 0) return 1;
  const f = kcalObjetivoComida / kcalReceta;
  const limitado = Math.min(1.6, Math.max(0.6, f));
  return Math.round(limitado * 20) / 20;
}
