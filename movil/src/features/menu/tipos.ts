export type TipoComida = 'desayuno' | 'media_manana' | 'almuerzo' | 'merienda' | 'cena' | 'otro';

export const TIPOS: Record<TipoComida, { texto: string; emoji: string; fondo: string }> = {
  desayuno: { texto: 'Desayuno', emoji: '☕', fondo: '#FBF1CC' },
  media_manana: { texto: 'Media mañana', emoji: '🍎', fondo: '#F6E5E1' },
  almuerzo: { texto: 'Almuerzo', emoji: '🍲', fondo: '#E6EDDC' },
  merienda: { texto: 'Merienda', emoji: '🥜', fondo: '#F2EADF' },
  cena: { texto: 'Cena', emoji: '🥗', fondo: '#E3EFF1' },
  otro: { texto: 'Otra toma', emoji: '🍽️', fondo: '#F0EEE7' },
};

export interface Ingrediente {
  orden: number;
  nombre: string;
  cantidad: number | null;
  unidad: string | null;
  nota: string | null;
  seccion: string | null;
}

export interface Nutricion {
  kcal?: number | null;
  proteinas?: number | null;
  hidratos?: number | null;
  grasas?: number | null;
  fibra?: number | null;
}

export interface Receta {
  id: number;
  nombre: string;
  descripcion: string | null;
  tipo_comida: TipoComida;
  nivel: 'facil' | 'medio' | 'elaborado';
  minutos: number | null;
  raciones: number;
  pasos: string[];
  consejos: string[];
  sustituciones: string[];
  nutricion: Nutricion | null;
  alergenos: string[];
  etiquetas: string[];
  imagen: string | null;
  ingredientes: Ingrediente[];
}

export interface Comida {
  id: number;
  fecha: string;
  orden: number;
  tipo_comida: TipoComida;
  receta_id: number | null;
  factor: number;
  kcal: number | null;
  hecha: boolean;
  receta: { id: number; nombre: string; minutos: number | null; descripcion: string | null; imagen: string | null } | null;
}

export const NOMBRE_ALERGENO: Record<string, string> = {
  gluten: 'gluten',
  crustaceos: 'crustáceos',
  huevos: 'huevo',
  pescado: 'pescado',
  cacahuetes: 'cacahuete',
  soja: 'soja',
  lacteos: 'lácteos',
  frutos_cascara: 'frutos secos',
  apio: 'apio',
  mostaza: 'mostaza',
  sesamo: 'sésamo',
  sulfitos: 'sulfitos',
  altramuces: 'altramuces',
  moluscos: 'moluscos',
};

export const NIVEL: Record<Receta['nivel'], string> = { facil: 'Fácil', medio: 'Media', elaborado: 'Elaborada' };
