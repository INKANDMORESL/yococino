// Pruebas de las reglas de seguridad. En GitHub se ejecutan con: deno test supabase/functions/_shared
import { motivosNoApta, restriccionesDe, textoIncumple } from './alergenos.ts';
import { comidasDelDia, edadEn, energiaDiaria, factorRacion } from './nutricion.ts';
import { frutasDelMes, frutasFueraDeTemporada } from './temporada.ts';
import { contieneAlimento, contienePalabra, limpiarNombre } from './texto.ts';

type Caso = [string, () => boolean];

export const CASOS: Caso[] = [
  // Texto
  ['"pan" coincide con "pan integral"', () => contienePalabra('Pan integral', 'pan')],
  ['"pan" no coincide con "panceta"', () => !contienePalabra('panceta ahumada', 'pan')],
  ['plural: "tomates" contiene "tomate"', () => contienePalabra('tomates cherry', 'tomate')],
  ['"coliflores" encuentra "coliflor"', () => contieneAlimento('coliflor al horno', 'coliflores')],
  ['"nueces" encuentra "nuez"', () => contieneAlimento('nuez picada', 'nueces')],
  ['"aguacates" encuentra "aguacate"', () => contieneAlimento('aguacate maduro', 'aguacates')],
  ['nombre: quita "(sin pescado)"', () => limpiarNombre('Pollo al horno con pisto (sin pescado)') === 'Pollo al horno con pisto'],
  ['nombre: quita "(sin gluten 2)" y "(variante)"', () => limpiarNombre('Tostada con tomate (sin gluten 2)') === 'Tostada con tomate' && limpiarNombre('Crema de calabaza (variante)') === 'Crema de calabaza'],
  ['nombre: respeta "sin anchoas" y otros paréntesis', () => limpiarNombre('Ensalada César sin anchoas') === 'Ensalada César sin anchoas' && limpiarNombre('Huevos rotos (estilo casero)') === 'Huevos rotos (estilo casero)'],

  // Gluten
  ['gluten: "pan integral" no es apto', () => textoIncumple('pan integral', 'gluten')],
  ['gluten: "pan sin gluten" es apto', () => !textoIncumple('pan sin gluten', 'gluten')],
  ['gluten: "harina de arroz" es apta', () => !textoIncumple('harina de arroz', 'gluten')],
  ['gluten: "harina de trigo" no es apta', () => textoIncumple('harina de trigo', 'gluten')],
  ['gluten: "trigo sarraceno" es apto', () => !textoIncumple('trigo sarraceno', 'gluten')],
  ['gluten: "copos de avena" no son aptos', () => textoIncumple('copos de avena', 'gluten')],
  ['gluten: "panceta" es apta', () => !textoIncumple('panceta', 'gluten')],

  // Lácteos y lactosa
  ['lactosa: "yogur sin lactosa" es apto', () => !textoIncumple('yogur natural sin lactosa', 'lactosa')],
  ['lactosa: "queso fresco" no es apto', () => textoIncumple('queso fresco batido', 'lactosa')],
  ['proteína de leche: "yogur sin lactosa" NO es apto', () => textoIncumple('yogur natural sin lactosa', 'lacteos')],
  ['lácteos: "leche de avena" es apta', () => !textoIncumple('leche de avena', 'lacteos')],
  ['lácteos: "mantequilla de cacahuete" no es lácteo', () => !textoIncumple('mantequilla de cacahuete', 'lacteos')],
  ['cacahuete: "mantequilla de cacahuete" no es apta', () => textoIncumple('mantequilla de cacahuete', 'cacahuetes')],

  // Huevo, marisco, frutos secos, sésamo
  ['huevo: "tortilla francesa" no es apta', () => textoIncumple('tortilla francesa', 'huevos')],
  ['huevo: "tortillas de trigo" son aptas', () => !textoIncumple('tortillas de trigo', 'huevos')],
  ['marisco: "langostinos" no son aptos', () => textoIncumple('langostinos cocidos', 'crustaceos')],
  ['moluscos: "calamares" no son aptos', () => textoIncumple('calamares a la plancha', 'moluscos')],
  ['frutos secos: "nuez moscada" es apta', () => !textoIncumple('nuez moscada', 'frutos_cascara')],
  ['frutos secos: "nueces" no son aptas', () => textoIncumple('nueces', 'frutos_cascara')],
  ['sésamo: "hummus" no es apto', () => textoIncumple('hummus', 'sesamo')],

  // Encuesta -> restricciones
  ['encuesta: celiaquía -> gluten', () => restriccionesDe(['Celiaquía (gluten)'], []).codigos.includes('gluten')],
  ['encuesta: marisco -> crustáceos y moluscos', () => {
    const c = restriccionesDe(['Marisco'], []).codigos;
    return c.includes('crustaceos') && c.includes('moluscos');
  }],
  ['encuesta: proteína de leche anula la excepción de lactosa', () => {
    const c = restriccionesDe(['Lactosa', 'Proteína de leche'], []).codigos;
    return c.includes('lacteos') && !c.includes('lactosa');
  }],
  ['encuesta: alergia escrita a mano pasa a alimentos a evitar', () =>
    restriccionesDe(['Kiwi'], []).otrosAlimentos.includes('Kiwi')],

  // Recetas completas
  ['receta con etiqueta de gluten se rechaza para celíacos', () =>
    motivosNoApta({ nombre: 'Ensalada', alergenos: ['gluten'], ingredientes: [{ nombre: 'lechuga' }] },
      restriccionesDe(['Celiaquía (gluten)'], [])).length > 0],
  ['receta sin etiqueta pero con pan se rechaza para celíacos (segunda barrera)', () =>
    motivosNoApta({ nombre: 'Tostada con tomate', alergenos: [], ingredientes: [{ nombre: 'pan de payés' }, { nombre: 'tomate' }] },
      restriccionesDe(['Celiaquía (gluten)'], [])).length > 0],
  ['receta con lácteos sin lactosa es apta para intolerantes a la lactosa', () =>
    motivosNoApta({ nombre: 'Yogur con fruta', alergenos: ['lacteos'], ingredientes: [{ nombre: 'yogur natural sin lactosa' }, { nombre: 'fresas' }] },
      restriccionesDe(['Lactosa'], [])).length === 0],
  ['"Tostada con tomate" con pan sin gluten es apta para celíacos', () =>
    motivosNoApta({ nombre: 'Tostada con tomate', alergenos: [], ingredientes: [{ nombre: 'pan sin gluten' }, { nombre: 'tomate' }] },
      restriccionesDe(['Celiaquía (gluten)'], [])).length === 0],
  ['"Tostada con tomate" sin pan en la lista se rechaza (el nombre delata el pan)', () =>
    motivosNoApta({ nombre: 'Tostada con tomate', alergenos: [], ingredientes: [{ nombre: 'tomate' }, { nombre: 'aceite de oliva' }] },
      restriccionesDe(['Celiaquía (gluten)'], [])).length > 0],
  ['"no me gusta" la coliflor excluye "crema de coliflor"', () =>
    motivosNoApta({ nombre: 'Crema de coliflor', alergenos: [], ingredientes: [{ nombre: 'coliflor' }] },
      restriccionesDe([], ['coliflores'])).length > 0],
  ['receta apta sin restricciones', () =>
    motivosNoApta({ nombre: 'Pollo al horno', alergenos: [], ingredientes: [{ nombre: 'pechuga de pollo' }] },
      restriccionesDe([], [])).length === 0],

  // Fruta de temporada
  ['temporada: sandía en enero está fuera', () => frutasFueraDeTemporada(['sandía'], 1).join() === 'sandía'],
  ['temporada: sandía en julio está bien', () => frutasFueraDeTemporada(['Sandía fresca'], 7).length === 0],
  ['temporada: mandarina en diciembre está bien', () => frutasFueraDeTemporada(['mandarinas'], 12).length === 0],
  ['temporada: fresas en octubre están fuera', () => frutasFueraDeTemporada(['Yogur con fresas'], 10).join() === 'fresa'],
  ['temporada: "ciruelas pasas" valen todo el año', () => frutasFueraDeTemporada(['ciruelas pasas'], 1).length === 0],
  ['temporada: manzana y plátano siempre', () => frutasFueraDeTemporada(['manzana', 'plátano'], 3).length === 0],
  ['temporada: "melón" no se confunde con "melocotón"', () => frutasFueraDeTemporada(['melón'], 6).length === 0 && frutasFueraDeTemporada(['melocotón'], 1).join() === 'melocotón'],
  ['temporada: la naranja pasa de diciembre a mayo', () => frutasDelMes(12).includes('naranja') && frutasDelMes(3).includes('naranja') && !frutasDelMes(8).includes('naranja')],

  // Energía
  ['edad: cumple años mañana', () => edadEn('1990-10-23', '2026-10-22') === 35],
  ['edad: cumplió ayer', () => edadEn('1990-10-21', '2026-10-22') === 36],
  ['energía: perder peso con déficit moderado (máx. 500 kcal)', () => {
    const e = energiaDiaria({ sexo: 'hombre', edad: 40, alturaCm: 185, pesoKg: 96, pesoObjetivoKg: 85, objetivo: 'perder', actividad: 'poca' });
    return e.gasto - e.kcal <= 500 && e.kcal < e.gasto && e.kcal >= 1700;
  }],
  ['energía: nunca por debajo del mínimo', () => {
    const e = energiaDiaria({ sexo: 'mujer', edad: 60, alturaCm: 150, pesoKg: 50, pesoObjetivoKg: 46, objetivo: 'perder', actividad: 'nada' });
    return e.kcal >= 1400;
  }],
  ['energía: si ya está en su objetivo, mantiene', () =>
    energiaDiaria({ sexo: 'mujer', edad: 30, alturaCm: 165, pesoKg: 60, pesoObjetivoKg: 62, objetivo: 'perder', actividad: 'media' }).objetivoAplicado === 'mantener'],
  ['reparto: 5 comidas suman el 100 %', () => Math.abs(comidasDelDia(5).reduce((s, c) => s + c.parte, 0) - 1) < 1e-9],
  ['reparto: 3 comidas = desayuno, almuerzo, cena', () => comidasDelDia(3).map((c) => c.tipo).join() === 'desayuno,almuerzo,cena'],
  ['factor: limitado entre 0,6 y 1,6', () => factorRacion(2000, 500) === 1.6 && factorRacion(100, 500) === 0.6],
  ['factor: en pasos de 0,05', () => factorRacion(560, 500) === 1.1],
];

// Deno ejecuta cada caso como una prueba.
const denoGlobal = (globalThis as { Deno?: { test: (nombre: string, fn: () => void) => void } }).Deno;
if (denoGlobal) {
  for (const [nombre, prueba] of CASOS) {
    denoGlobal.test(nombre, () => {
      if (!prueba()) throw new Error(`Falla: ${nombre}`);
    });
  }
}

