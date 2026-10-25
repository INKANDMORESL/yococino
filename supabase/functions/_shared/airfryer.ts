// Platos hechos en airfryer para el recetario. Solo los ven en su menú quienes tienen airfryer
// (recetas.aparatos incluye 'airfryer'). Se crean por lotes (acción «airfryer» de sembrar-recetas) y cuentan para el cupo del mes.
import type { TipoComida } from './nutricion.ts';

type Nivel = 'facil' | 'medio' | 'elaborado';
export const AIRFRYER: [string, TipoComida, Nivel][] = [
  // Pollo y pavo
  ['Alitas de pollo crujientes en airfryer', 'cena', 'facil'],
  ['Muslos de pollo al limón en airfryer', 'almuerzo', 'facil'],
  ['Pechuga de pollo jugosa en airfryer con verduras', 'almuerzo', 'facil'],
  ['Nuggets de pollo caseros en airfryer', 'cena', 'medio'],
  ['Pollo al ajillo en airfryer', 'almuerzo', 'facil'],
  ['Contramuslos de pollo con especias en airfryer', 'cena', 'facil'],
  ['Brochetas de pollo y pimiento en airfryer', 'cena', 'facil'],
  ['Pavo con mostaza y miel en airfryer', 'almuerzo', 'facil'],
  ['Pollo rebozado con copos de maíz en airfryer', 'almuerzo', 'medio'],
  ['Fajitas de pollo en airfryer', 'cena', 'facil'],
  // Carne
  ['Albóndigas con salsa de tomate en airfryer', 'almuerzo', 'medio'],
  ['Hamburguesas caseras de ternera en airfryer', 'cena', 'facil'],
  ['Lomo de cerdo con romero en airfryer', 'almuerzo', 'facil'],
  ['Costillas de cerdo en airfryer', 'almuerzo', 'medio'],
  ['Solomillo de cerdo a la mostaza en airfryer', 'cena', 'medio'],
  ['Flamenquines de pavo en airfryer', 'cena', 'medio'],
  ['Croquetas de jamón en airfryer', 'cena', 'elaborado'],
  // Pescado y marisco
  ['Salmón con costra de hierbas en airfryer', 'cena', 'facil'],
  ['Merluza rebozada ligera en airfryer', 'cena', 'facil'],
  ['Bacalao con patatas en airfryer', 'almuerzo', 'medio'],
  ['Calamares a la romana en airfryer', 'cena', 'medio'],
  ['Gambas al ajillo en airfryer', 'cena', 'facil'],
  ['Dorada entera en airfryer con limón', 'almuerzo', 'facil'],
  ['Boquerones fritos sin aceite en airfryer', 'cena', 'facil'],
  ['Lubina con verduras en airfryer', 'cena', 'facil'],
  ['Palitos de merluza caseros en airfryer', 'cena', 'medio'],
  ['Sardinas en airfryer con ensalada', 'cena', 'facil'],
  ['Croquetas de bacalao en airfryer', 'cena', 'elaborado'],
  // Huevo, legumbres y vegetal
  ['Falafel en airfryer con salsa de yogur', 'cena', 'medio'],
  ['Garbanzos crujientes especiados en airfryer', 'merienda', 'facil'],
  ['Tofu crujiente en airfryer con verduras', 'cena', 'facil'],
  ['Huevos rellenos de atún gratinados en airfryer', 'cena', 'facil'],
  ['Hamburguesa de lentejas en airfryer', 'almuerzo', 'medio'],
  ['Tortilla de patatas en airfryer', 'cena', 'medio'],
  ['Empanadillas de atún en airfryer', 'cena', 'medio'],
  ['Pimientos rellenos de arroz en airfryer', 'almuerzo', 'medio'],
  ['Berenjenas rellenas en airfryer', 'almuerzo', 'medio'],
  ['Calabacín relleno de carne en airfryer', 'cena', 'medio'],
  // Verduras y guarniciones
  ['Patatas fritas caseras en airfryer', 'almuerzo', 'facil'],
  ['Patatas bravas en airfryer', 'almuerzo', 'facil'],
  ['Boniato asado en airfryer con pollo', 'almuerzo', 'facil'],
  ['Coliflor asada con especias en airfryer', 'cena', 'facil'],
  ['Brócoli crujiente con parmesano en airfryer', 'cena', 'facil'],
  ['Verduras asadas en airfryer con huevo', 'cena', 'facil'],
  ['Chips de calabacín en airfryer', 'cena', 'facil'],
  ['Alcachofas asadas en airfryer', 'cena', 'facil'],
  ['Champiñones rellenos en airfryer', 'cena', 'facil'],
  ['Espárragos trigueros en airfryer con huevo poché', 'cena', 'facil'],
  ['Ensalada templada de calabaza asada en airfryer', 'almuerzo', 'facil'],
  ['Pisto con huevo en airfryer', 'cena', 'facil'],
  // Pasta, arroz y masas
  ['Pizza casera de masa integral en airfryer', 'cena', 'medio'],
  ['Lasaña de verduras en airfryer', 'almuerzo', 'elaborado'],
  ['Canelones de espinacas gratinados en airfryer', 'almuerzo', 'medio'],
  ['Quesadillas de pollo en airfryer', 'cena', 'facil'],
  ['Sándwich mixto en airfryer con ensalada', 'cena', 'facil'],
  // Desayunos y meriendas
  ['Tostadas con tomate y aceite en airfryer', 'desayuno', 'facil'],
  ['Manzana asada con canela en airfryer', 'merienda', 'facil'],
  ['Huevos al plato en airfryer', 'desayuno', 'facil'],
  ['Galletas de avena y plátano en airfryer', 'merienda', 'facil'],
  ['Bizcocho de yogur en airfryer', 'merienda', 'medio'],
];
