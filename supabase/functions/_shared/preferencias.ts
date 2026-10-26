// «Cuéntanos cómo te gusta comer»: la persona escribe libremente («me gusta desayunar pan», «no me gusta el
// pimiento», «quiero más recetas con pollo») y se convierte en preferencias que el menú respeta, siempre dentro
// de las reglas de la app. Primero se entiende sin IA (gratis); la IA barata solo si no se entiende nada.
// Sin dependencias de Deno: se prueba en reglas_test.ts.
import { normalizar } from './texto.ts';
import { CATEGORIAS, categoriasDe } from './categorias.ts';

// Palabras que son grupos de alimentos: se comparan con la categoría de la receta («legumbres» = lentejas, garbanzos…).
const GRUPO: Record<string, string> = { legumbre: 'legumbres', legumbres: 'legumbres', pescado: 'pescado', pescados: 'pescado', carne: 'carne', carnes: 'carne', marisco: 'marisco', mariscos: 'marisco', huevo: 'huevos', huevos: 'huevos', pasta: 'pasta_arroz', arroz: 'pasta_arroz', verdura: 'vegetal', verduras: 'vegetal' };

export const TIPOS_PREF = ['desayuno', 'media_manana', 'almuerzo', 'merienda', 'cena', 'todas'] as const;
export type TipoPref = (typeof TIPOS_PREF)[number];

export interface Preferencias {
  mas: Partial<Record<TipoPref, string[]>>; // alimentos que le gustan, por toma («todas» = en general)
  evitar: string[]; // alimentos que no quiere
}

export const NOMBRE_TOMA: Record<TipoPref, string> = {
  desayuno: 'desayunos',
  media_manana: 'medias mañanas',
  almuerzo: 'comidas',
  merienda: 'meriendas',
  cena: 'cenas',
  todas: 'tus menús',
};

// Lo que no encaja con una alimentación sana: no se añade como preferencia (sí se puede evitar).
const NO_SALUDABLE = [
  'alcohol', 'vino', 'cerveza', 'cubata', 'licor', 'refresco', 'refrescos', 'cola', 'chuche', 'chuches', 'golosina', 'golosinas',
  'bolleria', 'donut', 'donuts', 'gominola', 'gominolas', 'azucar', 'dulces', 'comida rapida', 'fritos', 'frituras', 'hamburguesa del burger',
  'pizza congelada', 'nuggets congelados', 'bebida energetica', 'bebidas energeticas', 'suplemento', 'suplementos', 'proteina en polvo', 'batido de proteinas',
];

const TOMAS: [RegExp, TipoPref][] = [
  [/desayun\w*/, 'desayuno'],
  [/media manana|almorzar a media manana|tentempie/, 'media_manana'],
  [/merend\w*|merienda\w*/, 'merienda'],
  [/cen\w*/, 'cena'],
  [/almuerz\w*|almorzar|comida\w*|comer\b|al mediodia/, 'almuerzo'],
];

const ARTICULOS = /^(el|la|los|las|un|una|unos|unas|de|del|con|mucho|mucha|muchos|muchas|algo de|algun|alguna|mas|poco|tipo)\s+/;

// "las tostadas con tomate" -> "tostadas con tomate"; descarta lo que no parece un alimento corto.
function limpiarAlimento(t: string): string | null {
  let x = normalizar(t);
  x = x.replace(/^algo(\s+\w+)?\s+(como|tipo)\s+/, '').replace(/^(como|tipo)\s+/, '');
  for (let i = 0; i < 3; i++) x = x.replace(ARTICULOS, '');
  x = x.replace(/\b(por favor|gracias|siempre|normalmente|generalmente|casi siempre|a veces|todos los dias|cada dia)\b/g, '').trim();
  x = x.replace(/\s+(y|o|pero)$/, '').trim();
  if (x.length < 3 || x.length > 30 || x.split(' ').length > 4) return null;
  return x;
}

function trocear(lista: string): string[] {
  return lista
    .split(/,|\by\b|\bo\b|\be\b|\//)
    .map((p) => limpiarAlimento(p))
    .filter((p): p is string => !!p);
}

export const esNoSaludable = (alimento: string) => NO_SALUDABLE.some((n) => normalizar(alimento).includes(n));

// Interpreta el texto con reglas sencillas. «entendido» es false si no se ha sacado nada (entonces se usa la IA).
export function interpretarPreferencias(texto: string): { prefs: Preferencias; ignorado: string[]; entendido: boolean } {
  const prefs: Preferencias = { mas: {}, evitar: [] };
  const ignorado: string[] = [];
  const anadirMas = (tipo: TipoPref, items: string[]) => {
    for (const it of items) {
      if (esNoSaludable(it)) {
        ignorado.push(it);
        continue;
      }
      const l = (prefs.mas[tipo] ??= []);
      if (!l.includes(it)) l.push(it);
    }
  };
  const anadirEvitar = (items: string[]) => items.forEach((it) => !prefs.evitar.includes(it) && prefs.evitar.push(it));
  const tomaDe = (t: string): TipoPref | null => TOMAS.find(([re]) => re.test(t))?.[1] ?? null;

  const frases = texto
    .split(/[.;!?\n]+/)
    .map((f) => normalizar(f))
    .flatMap((f) => f.split(/\s+pero\s+|\s+aunque\s+|\s+y\s+(?=no\s)/));
  for (const f0 of frases) {
    const f = f0.trim();
    if (!f) continue;
    let m: RegExpMatchArray | null;
    // No me gusta / odio / no quiero / no como / sin ...
    if ((m = f.match(/(?:no me gusta[n]?|odio|no soporto|no quiero|no como|no tomo|evita[r]?|quita[r]?|sin|^no(?=\s+(?:el|la|los|las)\s))\s+(?:nada de\s+|ni\s+)?(.+)/))) {
      anadirEvitar(trocear(m[1].replace(/\bni\b/g, ',')));
      continue;
    }
    // "en el desayuno / para cenar ... (me gusta|quiero|prefiero) X" o "me gusta desayunar X"
    const toma = tomaDe(f);
    if (toma) {
      const tras =
        f.match(/(?:desayun\w*|merend\w*|cen\w*|almuerz\w*|almorzar|comida\w*|comer|media manana)\s+(?:suelo tomar |me gusta tomar |me gusta |quiero |prefiero |tomo |como )?(.+)/)?.[1] ??
        f.match(/(?:me gusta[n]?|quiero|prefiero|suelo tomar|tomo|como)\s+(.+)/)?.[1];
      if (tras) {
        const items = trocear(tras.replace(/^(?:con|de)\s+/, ''));
        if (items.length) {
          anadirMas(toma, items);
          continue;
        }
      }
    }
    // Quiero más (recetas|platos) con X / me encanta X / me gusta X
    if ((m = f.match(/(?:quiero|me gustaria|pon(?:me)?|dame|prefiero)\s+(?:mas\s+)?(?:recetas|platos|comidas|cosas)?\s*(?:con|de)?\s*(.+)/))) {
      const items = trocear(m[1].replace(/^mas\s+/, ''));
      if (items.length) {
        anadirMas('todas', items);
        continue;
      }
    }
    if ((m = f.match(/(?:me encanta[n]?|me gusta[n]? mucho|me gusta[n]?|soy de|me chifla[n]?)\s+(.+)/))) {
      anadirMas('todas', trocear(m[1]));
    }
  }
  const entendido = prefs.evitar.length > 0 || Object.values(prefs.mas).some((l) => (l ?? []).length > 0) || ignorado.length > 0;
  return { prefs, ignorado, entendido };
}

// ¿La receta encaja con alguna de las preferencias de esa toma?
export function encajaPreferencia(receta: { nombre: string; ingredientes?: { nombre: string }[] | null }, alimentos: string[]): boolean {
  if (!alimentos.length) return false;
  const texto = ` ${normalizar([receta.nombre, ...(receta.ingredientes ?? []).map((i) => i.nombre)].join(' '))} `;
  let cats: string[] | null = null;
  return alimentos.some((a) => {
    const n = normalizar(a);
    if (!n) return false;
    const grupo = GRUPO[n];
    if (grupo && (CATEGORIAS as readonly string[]).includes(grupo)) {
      cats ??= categoriasDe({ nombre: receta.nombre, ingredientes: receta.ingredientes ?? [] }).categorias;
      if (cats.includes(grupo)) return true;
    }
    // Todas las palabras del alimento deben aparecer («pan integral», «tostadas con tomate»).
    return n
      .split(' ')
      .filter((w) => w.length > 2 && !['con', 'del', 'los', 'las'].includes(w))
      .every((w) => new RegExp(` ${w}(s|es)? `).test(texto) || texto.includes(` ${w.replace(/s$/, '')} `));
  });
}

// Texto corto para enseñar lo que se ha entendido.
export function resumenPreferencias(p: Preferencias): string[] {
  const lineas: string[] = [];
  for (const t of TIPOS_PREF) {
    const l = p.mas[t] ?? [];
    if (l.length) lineas.push(t === 'todas' ? `Más platos con ${l.join(', ')}` : `En ${NOMBRE_TOMA[t]}: ${l.join(', ')}`);
  }
  if (p.evitar.length) lineas.push(`Sin ${p.evitar.join(', ')}`);
  return lineas;
}
