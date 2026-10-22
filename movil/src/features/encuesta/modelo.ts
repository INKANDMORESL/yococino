// Encuesta inicial de Yococino: tipos, opciones y reglas de seguridad.
// Las reglas de seguridad son fijas: la IA que genere menús nunca puede saltárselas.

export type Sexo = 'mujer' | 'hombre' | 'otro';
export type Objetivo = 'perder' | 'mantener' | 'musculo';
export type Actividad = 'nada' | 'poca' | 'media' | 'alta';
export type Nivel = 'facil' | 'medio' | 'elaborado';
export type FranjaPeques = '1-3' | '4-8' | '9-13' | '14-17';

export interface Fecha {
  dia: string;
  mes: string;
  ano: string;
}

export interface Encuesta {
  nombre: string;
  nacimiento: Fecha;
  sexo: Sexo | null;
  altura: string; // cm
  peso: string; // kg
  objetivo: Objetivo | null;
  pesoObjetivo: string; // kg, solo si objetivo = perder
  actividad: Actividad | null;
  alergias: string[];
  condiciones: string[];
  noMeGusta: string[];
  nivel: Nivel | null;
  comidas: 3 | 4 | 5;
  hayPeques: boolean | null;
  numPeques: number;
  franjasPeques: FranjaPeques[];
}

export const encuestaVacia: Encuesta = {
  nombre: '',
  nacimiento: { dia: '', mes: '', ano: '' },
  sexo: null,
  altura: '',
  peso: '',
  objetivo: null,
  pesoObjetivo: '',
  actividad: null,
  alergias: [],
  condiciones: [],
  noMeGusta: [],
  nivel: null,
  comidas: 5,
  hayPeques: null,
  numPeques: 1,
  franjasPeques: [],
};

export const OPCIONES = {
  sexo: [
    { valor: 'mujer', texto: 'Mujer' },
    { valor: 'hombre', texto: 'Hombre' },
    { valor: 'otro', texto: 'Prefiero no decirlo' },
  ],
  objetivo: [
    { valor: 'perder', texto: 'Perder peso', detalle: 'A un ritmo prudente y sostenible' },
    { valor: 'mantener', texto: 'Mantener mi peso', detalle: 'Comer equilibrado sin cambiar de peso' },
    { valor: 'musculo', texto: 'Ganar músculo', detalle: 'Más proteína para acompañar tu entrenamiento' },
  ],
  actividad: [
    { valor: 'nada', texto: 'No hago deporte', detalle: 'Trabajo sentado y me muevo poco' },
    { valor: 'poca', texto: '1 o 2 días por semana', detalle: 'Caminar, algo de gimnasio o deporte suave' },
    { valor: 'media', texto: '3 o 4 días por semana', detalle: 'Entreno con regularidad' },
    { valor: 'alta', texto: '5 días o más', detalle: 'Entreno casi a diario o tengo un trabajo físico' },
  ],
  alergias: [
    'Celiaquía (gluten)',
    'Lactosa',
    'Proteína de leche',
    'Frutos secos',
    'Cacahuete',
    'Marisco',
    'Pescado',
    'Huevo',
    'Soja',
    'Sésamo',
  ],
  condiciones: [
    'Embarazo o lactancia',
    'Diabetes',
    'Enfermedad renal',
    'Problemas de tiroides',
    'Trastorno de la conducta alimentaria, actual o pasado',
  ],
  nivel: [
    { valor: 'facil', texto: 'Fácil', detalle: 'Menos de 20 minutos al día' },
    { valor: 'medio', texto: 'Medio', detalle: 'Entre 20 y 40 minutos' },
    { valor: 'elaborado', texto: 'Me gusta cocinar', detalle: 'Más de 40 minutos, recetas con más pasos' },
  ],
  comidas: [3, 4, 5] as const,
  franjasPeques: [
    { valor: '1-3', texto: '1 a 3 años' },
    { valor: '4-8', texto: '4 a 8 años' },
    { valor: '9-13', texto: '9 a 13 años' },
    { valor: '14-17', texto: '14 a 17 años' },
  ],
} as const;

export const numero = (v: string): number | null => {
  const n = parseFloat(v.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

// Convierte día/mes/año en fecha real. Devuelve null si la fecha no existe (por ejemplo, 31/02).
export const fechaDe = (f: Fecha): Date | null => {
  const d = parseInt(f.dia, 10);
  const m = parseInt(f.mes, 10);
  const a = parseInt(f.ano, 10);
  if (!d || !m || !a || f.ano.length !== 4) return null;
  const fecha = new Date(a, m - 1, d);
  if (fecha.getFullYear() !== a || fecha.getMonth() !== m - 1 || fecha.getDate() !== d) return null;
  return fecha;
};

// Fecha en formato AAAA-MM-DD, el que usa la base de datos.
export const fechaISO = (f: Fecha): string | null => {
  const fecha = fechaDe(f);
  if (!fecha) return null;
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}`;
};

// Años cumplidos a día de hoy.
export const edadDe = (f: Fecha, hoy: Date = new Date()): number | null => {
  const n = fechaDe(f);
  if (!n) return null;
  let edad = hoy.getFullYear() - n.getFullYear();
  const aunNoCumple = hoy.getMonth() < n.getMonth() || (hoy.getMonth() === n.getMonth() && hoy.getDate() < n.getDate());
  if (aunNoCumple) edad -= 1;
  return edad;
};

// Peso mínimo saludable para la altura (IMC 18,5). Por debajo, la app no acepta el objetivo.
export const pesoMinimoSaludable = (alturaCm: number): number => {
  const m = alturaCm / 100;
  return Math.ceil(18.5 * m * m * 10) / 10;
};

export type Resultado =
  | { tipo: 'ok' }
  | { tipo: 'menor' }
  | { tipo: 'profesional'; motivos: string[] };

// Decide si la app puede generar un menú o debe recomendar un profesional.
export const evaluar = (e: Encuesta): Resultado => {
  const edad = edadDe(e.nacimiento);
  if (edad !== null && edad < 18) return { tipo: 'menor' };
  if (e.condiciones.length > 0) return { tipo: 'profesional', motivos: e.condiciones };
  return { tipo: 'ok' };
};

// Errores de cada paso. Un paso sin errores deja avanzar.
export const erroresPaso = (paso: number, e: Encuesta): string | null => {
  if (paso === 0) {
    if (!e.nombre.trim()) return 'Dinos cómo te llamas.';
    const edad = edadDe(e.nacimiento);
    const altura = numero(e.altura);
    const peso = numero(e.peso);
    if (edad === null) return 'Revisa tu fecha de nacimiento: día, mes y año con 4 cifras (por ejemplo, 15 / 03 / 1988).';
    if (edad < 0 || edad > 110) return 'Revisa el año de tu fecha de nacimiento.';
    if (!e.sexo) return 'Elige una opción de sexo. Se usa para calcular tus raciones.';
    if (altura === null || altura < 120 || altura > 230) return 'Escribe tu altura en centímetros, por ejemplo 175.';
    if (peso === null || peso < 30 || peso > 300) return 'Escribe tu peso en kilos, por ejemplo 82,5.';
    return null;
  }
  if (paso === 1) {
    if (!e.objetivo) return 'Elige tu objetivo.';
    if (e.objetivo === 'perder') {
      const obj = numero(e.pesoObjetivo);
      const peso = numero(e.peso) ?? 0;
      const min = pesoMinimoSaludable(numero(e.altura) ?? 170);
      if (obj === null) return 'Escribe el peso al que quieres llegar.';
      if (obj >= peso) return 'Para perder peso, el objetivo debe ser menor que tu peso actual.';
      if (obj < min) return `Para tu altura, el peso saludable mínimo es ${String(min).replace('.', ',')} kg. Elige un objetivo igual o mayor.`;
    }
    return null;
  }
  if (paso === 2) return e.actividad ? null : 'Elige tu nivel de actividad.';
  if (paso === 5) return e.nivel ? null : 'Elige cuánto tiempo quieres dedicar a cocinar.';
  if (paso === 6) {
    if (e.hayPeques === null) return 'Dinos si hay niños en casa.';
    if (e.hayPeques && e.franjasPeques.length === 0) return 'Elige la edad de los peques.';
    return null;
  }
  return null;
};

export const PASOS = [
  { titulo: 'Sobre ti', subtitulo: 'Para calcular tus raciones.' },
  { titulo: 'Tu objetivo', subtitulo: 'Lo que quieres conseguir con Yococino.' },
  { titulo: 'Actividad', subtitulo: '¿Cuánto te mueves en una semana normal?' },
  { titulo: 'Tu salud', subtitulo: 'Nunca te propondremos nada con lo que no puedas comer.' },
  { titulo: 'Tus gustos', subtitulo: 'Lo que no te gusta no aparecerá en tus menús.' },
  { titulo: 'Tu cocina', subtitulo: '¿Cuánto tiempo quieres dedicar a cocinar?' },
  { titulo: 'En casa', subtitulo: 'Para preparar también recetas para los peques.' },
] as const;
