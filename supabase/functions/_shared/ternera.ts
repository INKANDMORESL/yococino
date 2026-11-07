// Platos de ternera para el recetario (había pocos). Cortes magros y raciones moderadas, con verdura.
// Se crean por lotes (acción «ternera» de sembrar-recetas), solo los que faltan, y cuentan para el cupo del mes.
import type { TipoComida } from './nutricion.ts';

type Nivel = 'facil' | 'medio' | 'elaborado';
export const TERNERA: [string, TipoComida, Nivel][] = [
  ['Filete de ternera a la plancha con pimientos asados', 'almuerzo', 'facil'],
  ['Ternera guisada con patatas y zanahoria', 'almuerzo', 'medio'],
  ['Ternera en salsa de cebolla con arroz integral', 'almuerzo', 'medio'],
  ['Albóndigas de ternera en salsa de tomate', 'almuerzo', 'medio'],
  ['Ternera salteada con brócoli y sésamo', 'cena', 'facil'],
  ['Wok de ternera con verduras y fideos de arroz', 'cena', 'facil'],
  ['Carne guisada de ternera con guisantes', 'almuerzo', 'medio'],
  ['Ternera a la jardinera', 'almuerzo', 'medio'],
  ['Redondo de ternera al horno con verduras', 'almuerzo', 'elaborado'],
  ['Brochetas de ternera y verduras a la plancha', 'cena', 'facil'],
  ['Hamburguesa casera de ternera con ensalada', 'cena', 'facil'],
  ['Ternera al ajillo con champiñones', 'cena', 'facil'],
  ['Estofado de ternera con setas', 'almuerzo', 'medio'],
  ['Lentejas con ternera y verduras', 'almuerzo', 'medio'],
  ['Garbanzos con ternera y espinacas', 'almuerzo', 'medio'],
  ['Pimientos rellenos de ternera y arroz', 'almuerzo', 'medio'],
  ['Calabacines rellenos de carne picada de ternera', 'cena', 'medio'],
  ['Berenjenas rellenas de ternera gratinadas', 'cena', 'medio'],
  ['Ensalada templada de ternera con rúcula y parmesano', 'cena', 'facil'],
  ['Tacos de ternera con pico de gallo', 'cena', 'facil'],
  ['Fajitas de ternera con pimientos y cebolla', 'cena', 'facil'],
  ['Ternera con tomate al estilo casero', 'almuerzo', 'facil'],
  ['Escalopines de ternera al limón con ensalada', 'cena', 'facil'],
  ['Filetes de ternera rusos al horno con puré de calabaza', 'almuerzo', 'medio'],
  ['Ternera en salsa de pimienta con verduras salteadas', 'cena', 'medio'],
  ['Carpaccio de ternera con rúcula', 'cena', 'facil'],
  ['Espaguetis integrales a la boloñesa de ternera', 'almuerzo', 'facil'],
  ['Lasaña de calabacín y ternera', 'almuerzo', 'elaborado'],
  ['Caldereta de ternera con patatas', 'almuerzo', 'medio'],
  ['Tiras de ternera con pimiento y arroz basmati', 'almuerzo', 'facil'],
];
