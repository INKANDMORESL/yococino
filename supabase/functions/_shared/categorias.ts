// Categorías del recetario por ingrediente principal (carne, pescado…), para los filtros de la pestaña Recetas.
// Se deducen del nombre del plato y de sus ingredientes, sin IA. Sin dependencias de Deno: se prueban en reglas_test.ts.
import { contieneAlimento, normalizar } from './texto.ts';

export const SUBCATEGORIAS: Record<string, Record<string, string[]>> = {
  carne: {
    pollo: ['pollo', 'pechuga de pollo', 'muslo de pollo', 'contramuslo'],
    pavo: ['pavo', 'pechuga de pavo'],
    ternera: ['ternera', 'buey', 'vaca', 'añojo', 'carne picada'],
    cerdo: ['cerdo', 'lomo de cerdo', 'lomo adobado', 'cinta de lomo', 'panceta', 'chorizo', 'jamon serrano', 'jamon iberico', 'jamon cocido', 'secreto iberico', 'presa iberica', 'costilla', 'morcilla'],
    cordero: ['cordero'],
    conejo: ['conejo'],
  },
  pescado: {
    blanco: ['merluza', 'bacalao', 'pescadilla', 'rape', 'lubina', 'dorada', 'lenguado', 'gallo', 'rodaballo', 'abadejo', 'corvina', 'pescado blanco'],
    azul: ['salmon', 'atun', 'sardina', 'boqueron', 'caballa', 'bonito', 'trucha', 'anchoa', 'jurel', 'emperador', 'pez espada', 'pescado azul'],
  },
};

const GRUPOS: Record<string, string[]> = {
  marisco: ['gamba', 'langostino', 'mejillon', 'almeja', 'calamar', 'sepia', 'pulpo', 'chipiron', 'berberecho', 'navaja', 'vieira', 'cigala', 'marisco'],
  huevos: ['huevo', 'clara de huevo'],
  legumbres: ['lenteja', 'garbanzo', 'alubia', 'judion', 'frijol', 'edamame', 'hummus', 'soja texturizada'],
  pasta_arroz: ['pasta', 'espagueti', 'macarron', 'tallarin', 'fideo', 'lasaña', 'arroz', 'cuscus', 'ñoqui', 'quinoa'],
};

export const CATEGORIAS = ['carne', 'pescado', 'marisco', 'huevos', 'legumbres', 'vegetal', 'pasta_arroz'] as const;
export type Categoria = (typeof CATEGORIAS)[number];

// "Jamón de pavo" no es cerdo y "lomo de salmón" no es carne: se quitan antes de buscar.
const quitarConfusiones = (t: string) => t.replace(/jamon de pavo/g, 'pavo').replace(/lomos? de (salmon|bacalao|atun|merluza|bonito|rape)/g, '$1');

const hay = (texto: string, palabras: string[]) => palabras.some((p) => contieneAlimento(texto, p));

export function categoriasDe(r: { nombre: string; ingredientes?: { nombre: string }[] | null }): { categorias: Categoria[]; sub: string[] } {
  const texto = quitarConfusiones(normalizar([r.nombre, ...(r.ingredientes ?? []).map((i) => i.nombre)].join(' | ')));
  const categorias = new Set<Categoria>();
  const sub: string[] = [];
  for (const [cat, subs] of Object.entries(SUBCATEGORIAS)) {
    for (const [s, palabras] of Object.entries(subs)) {
      if (hay(texto, palabras)) {
        categorias.add(cat as Categoria);
        sub.push(s);
      }
    }
  }
  for (const [cat, palabras] of Object.entries(GRUPOS)) if (hay(texto, palabras)) categorias.add(cat as Categoria);
  if (!categorias.has('carne') && !categorias.has('pescado') && !categorias.has('marisco')) categorias.add('vegetal');
  return { categorias: [...categorias], sub };
}
