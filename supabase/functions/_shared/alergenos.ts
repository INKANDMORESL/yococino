// Control de alergias e intolerancias.
// Primera barrera: la IA etiqueta cada receta con los 14 alérgenos de declaración obligatoria en la UE.
// Segunda barrera (esta): se revisan los ingredientes por palabras clave, por si la etiqueta falla.
// Ante la duda, la receta se descarta para esa persona.
import { contieneAlimento, contienePalabra, normalizar } from './texto.ts';
import { APARATOS_POR_DEFECTO, aparatosDe, aparatosQueFaltan, NOMBRE_APARATO, type Aparato } from './aparatos.ts';

// Los 14 alérgenos del Reglamento (UE) 1169/2011.
export const ALERGENOS_UE = [
  'gluten',
  'crustaceos',
  'huevos',
  'pescado',
  'cacahuetes',
  'soja',
  'lacteos',
  'frutos_cascara',
  'apio',
  'mostaza',
  'sesamo',
  'sulfitos',
  'altramuces',
  'moluscos',
] as const;
export type AlergenoUE = (typeof ALERGENOS_UE)[number];

// "lactosa" no es un alérgeno UE: es la intolerancia, que sí admite lácteos sin lactosa.
export type Restriccion = AlergenoUE | 'lactosa';

export const NOMBRE_RESTRICCION: Record<Restriccion, string> = {
  gluten: 'gluten (celiaquía)',
  crustaceos: 'crustáceos',
  huevos: 'huevo',
  pescado: 'pescado',
  cacahuetes: 'cacahuete',
  soja: 'soja',
  lacteos: 'leche y derivados (proteína de leche)',
  frutos_cascara: 'frutos secos de cáscara',
  apio: 'apio',
  mostaza: 'mostaza',
  sesamo: 'sésamo',
  sulfitos: 'sulfitos',
  altramuces: 'altramuces',
  moluscos: 'moluscos',
  lactosa: 'lactosa (se permiten lácteos sin lactosa)',
};

// Opciones de la encuesta -> restricciones. Lo que no encaja se trata como alimento a evitar.
const DESDE_ENCUESTA: Record<string, Restriccion[]> = {
  'celiaquia gluten': ['gluten'],
  lactosa: ['lactosa'],
  'proteina de leche': ['lacteos'],
  'frutos secos': ['frutos_cascara', 'cacahuetes'],
  cacahuete: ['cacahuetes'],
  marisco: ['crustaceos', 'moluscos'],
  pescado: ['pescado'],
  huevo: ['huevos'],
  soja: ['soja'],
  sesamo: ['sesamo'],
  mostaza: ['mostaza'],
  apio: ['apio'],
  sulfitos: ['sulfitos'],
  altramuces: ['altramuces'],
  altramuz: ['altramuces'],
  gluten: ['gluten'],
  celiaquia: ['gluten'],
  crustaceos: ['crustaceos'],
  moluscos: ['moluscos'],
};

export interface Restricciones {
  codigos: Restriccion[];
  otrosAlimentos: string[]; // alergias escritas a mano que no son alérgenos UE + "no me gusta"
  aparatos?: Aparato[]; // lo que tiene en su cocina (sin dato = horno y microondas, ver aparatos.ts)
}

export function restriccionesDe(alergias: string[], noMeGusta: string[], aparatos?: unknown): Restricciones {
  const codigos = new Set<Restriccion>();
  const otros = new Set<string>();
  for (const a of alergias) {
    const clave = normalizar(a);
    const encontrados = DESDE_ENCUESTA[clave];
    if (encontrados) encontrados.forEach((c) => codigos.add(c));
    else if (clave) otros.add(a.trim());
  }
  // Quien no tolera la proteína de leche tampoco puede tomar lácteos sin lactosa.
  if (codigos.has('lacteos')) codigos.delete('lactosa');
  for (const n of noMeGusta) if (normalizar(n)) otros.add(n.trim());
  return { codigos: [...codigos], otrosAlimentos: [...otros], aparatos: aparatosDe(aparatos) };
}

// Palabras clave por restricción.
// - si: palabras que indican la presencia del alérgeno.
// - salvo: expresiones completas que, aun conteniendo una palabra clave, son aptas ("harina de arroz").
// - aptoSi: si el texto incluye esto, se considera apto ("pasta sin gluten").
interface Regla {
  si: string[];
  salvo?: string[];
  aptoSi?: string[];
}

const LACTEOS = ['leche', 'queso', 'yogur', 'nata', 'mantequilla', 'requeson', 'kefir', 'cuajada', 'lacteo', 'mozzarella',
  'parmesano', 'ricotta', 'bechamel', 'skyr', 'ghee', 'suero', 'feta', 'burrata', 'mascarpone', 'quark', 'batido'];
const VEGETALES_NO_LACTEOS = ['leche de almendra', 'leche de avena', 'leche de soja', 'leche de coco', 'leche de arroz',
  'yogur de soja', 'yogures de soja', 'yogur de coco', 'nata de coco', 'crema de coco', 'mantequilla de cacahuete',
  'mantequilla de almendra'];

const PALABRAS: Record<Restriccion, Regla> = {
  gluten: {
    si: ['trigo', 'harina', 'pan', 'panecillo', 'pasta', 'espagueti', 'espaguetis', 'macarron', 'fideo', 'tallarin', 'lasana',
      'cuscus', 'bulgur', 'seitan', 'cebada', 'centeno', 'espelta', 'kamut', 'tostada', 'biscote', 'galleta', 'pan rallado',
      'rebozado', 'empanado', 'wrap', 'cerveza', 'semola', 'avena', 'masa', 'hojaldre', 'pizza', 'croissant', 'bizcocho',
      'magdalena', 'picatoste', 'crouton', 'gnocchi', 'noquis', 'bollo'],
    salvo: ['harina de arroz', 'harina de maiz', 'harina de garbanzo', 'harina de almendra', 'harina de trigo sarraceno',
      'trigo sarraceno', 'pasta de arroz', 'pasta de lenteja', 'pasta de lentejas', 'pasta de garbanzo', 'pasta de legumbres',
      'pasta de sesamo', 'fideo de arroz', 'fideos de arroz', 'tallarines de arroz', 'tortita de arroz', 'tortitas de arroz',
      'tortita de maiz', 'tortitas de maiz', 'semola de maiz', 'masa de patata'],
    aptoSi: ['sin gluten'],
  },
  lacteos: { si: LACTEOS, salvo: VEGETALES_NO_LACTEOS, aptoSi: ['vegano', 'vegana', 'vegetal'] },
  lactosa: { si: LACTEOS, salvo: VEGETALES_NO_LACTEOS, aptoSi: ['sin lactosa', 'vegano', 'vegana', 'vegetal'] },
  huevos: {
    si: ['huevo', 'clara', 'yema', 'mayonesa', 'tortilla', 'merengue', 'revuelto', 'alioli'],
    salvo: ['tortilla de trigo', 'tortillas de trigo', 'tortilla de maiz', 'tortillas de maiz'],
    aptoSi: ['sin huevo', 'vegana', 'vegano'],
  },
  pescado: {
    si: ['pescado', 'salmon', 'merluza', 'atun', 'bacalao', 'dorada', 'lubina', 'sardina', 'boqueron', 'anchoa', 'caballa',
      'rape', 'lenguado', 'trucha', 'emperador', 'pez espada', 'pez', 'peces', 'rodaballo', 'surimi', 'bonito', 'jurel', 'pescadilla',
      'besugo', 'mero', 'corvina', 'abadejo', 'arenque', 'panga', 'tilapia', 'fumet'],
  },
  crustaceos: {
    si: ['gamba', 'langostino', 'cigala', 'cangrejo', 'bogavante', 'langosta', 'carabinero', 'necora', 'centolla', 'camaron',
      'quisquilla', 'surimi', 'marisco'],
  },
  moluscos: {
    si: ['mejillon', 'almeja', 'berberecho', 'calamar', 'sepia', 'pulpo', 'chipiron', 'ostra', 'vieira', 'navaja', 'caracol',
      'choco', 'puntilla', 'marisco', 'chirla'],
  },
  frutos_cascara: {
    si: ['almendra', 'nuez', 'nueces', 'avellana', 'anacardo', 'pistacho', 'pecana', 'macadamia', 'pinon', 'frutos secos', 'praline',
      'mazapan', 'turron'],
    salvo: ['nuez moscada'],
  },
  cacahuetes: { si: ['cacahuete', 'mani', 'frutos secos'] },
  soja: { si: ['soja', 'tofu', 'tempeh', 'edamame', 'miso', 'tamari', 'texturizado'] },
  sesamo: { si: ['sesamo', 'ajonjoli', 'tahini', 'tahin', 'hummus', 'humus'] },
  apio: { si: ['apio'] },
  mostaza: { si: ['mostaza'] },
  sulfitos: { si: ['vino', 'sulfito', 'sulfitos', 'orejones', 'pasas'] },
  altramuces: { si: ['altramuz', 'altramuces'] },
};

// Comprueba un texto (nombre de ingrediente o de plato) contra una restricción.
export function textoIncumple(texto: string, r: Restriccion): boolean {
  const { si, salvo = [], aptoSi = [] } = PALABRAS[r];
  if (aptoSi.some((a) => contienePalabra(texto, a))) return false;
  let t = ` ${normalizar(texto)} `;
  // Quitar las expresiones aptas, para que "harina de arroz" no cuente como "harina".
  for (const s of salvo) t = t.split(` ${normalizar(s)} `).join('  ');
  return si.some((p) => contienePalabra(t, p));
}

export interface RecetaRevisable {
  nombre: string;
  alergenos: string[];
  ingredientes: { nombre: string; nota?: string | null }[];
  aparatos?: string[] | null; // si se sabe, se comprueba que la persona tenga esos aparatos
  nota_airfryer?: string | null;
}

// ¿Algún ingrediente es un sustituto apto ("pan sin gluten", "harina de arroz", "yogur sin lactosa")?
function usaSustituto(ingredientes: string[], r: Restriccion): boolean {
  const { salvo = [], aptoSi = [] } = PALABRAS[r];
  return ingredientes.some((t) => [...aptoSi, ...salvo].some((a) => contienePalabra(t, a)));
}

// Devuelve los motivos por los que la receta no es apta. Lista vacía = apta.
export function motivosNoApta(receta: RecetaRevisable, r: Restricciones): string[] {
  const motivos: string[] = [];
  const etiquetas = new Set(receta.alergenos.map((a) => normalizar(a).replace(/ /g, '_')));
  const ingredientes = receta.ingredientes.map((i) => `${i.nombre} ${i.nota ?? ''}`.trim());

  for (const c of r.codigos) {
    // La intolerancia a la lactosa se revisa solo por ingredientes: el lácteo sin lactosa es apto.
    if (c !== 'lactosa' && etiquetas.has(c)) {
      motivos.push(`contiene ${NOMBRE_RESTRICCION[c]}`);
      continue;
    }
    // El nombre del plato se revisa salvo que la receta use un sustituto apto
    // ("Tostada con tomate" hecha con "pan sin gluten").
    const textos = usaSustituto(ingredientes, c) ? ingredientes : [receta.nombre, ...ingredientes];
    const culpable = textos.find((t) => textoIncumple(t, c));
    if (culpable) motivos.push(`${NOMBRE_RESTRICCION[c]} en «${culpable}»`);
  }
  for (const alimento of r.otrosAlimentos) {
    const culpable = [receta.nombre, ...ingredientes].find((t) => contieneAlimento(t, alimento));
    if (culpable) motivos.push(`${alimento} en «${culpable}»`);
  }
  if (receta.aparatos) {
    for (const a of aparatosQueFaltan(receta.aparatos, receta.nota_airfryer, r.aparatos ?? APARATOS_POR_DEFECTO)) motivos.push(`necesita ${NOMBRE_APARATO[a]}`);
  }
  return motivos;
}

// Texto para la IA con todo lo que no puede aparecer.
export function describirRestricciones(r: Restricciones): string {
  const partes = r.codigos.map((c) => NOMBRE_RESTRICCION[c]);
  if (r.otrosAlimentos.length) partes.push(...r.otrosAlimentos);
  return partes.length ? partes.join(', ') : 'ninguna';
}
