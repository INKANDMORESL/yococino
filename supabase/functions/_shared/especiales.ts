// Recetas especiales de temporada (Halloween, Navidad, Roscón, verano…): salen en Inicio y en el Recetario con
// su etiqueta, pero NUNCA en el menú (recetas.solo_especial). Pueden ser menos saludables, siempre con aviso
// (recetas.avisos). Las fechas que cambian cada año (Carnaval, Semana Santa, Día de la Madre) se calculan.
// Sin dependencias de Deno: se prueba en reglas_test.ts.
import type { TipoComida } from './nutricion.ts';

type Nivel = 'facil' | 'medio' | 'elaborado';
export type TipoEspecial = TipoComida | 'otro';
type Plato = [string, TipoEspecial, Nivel];

export interface Especial {
  clave: string;
  titulo: string; // «Especial Halloween»
  emoji: string;
  descripcion: string;
  prioridad: number; // si coinciden dos, sale el de más prioridad (los «días de» y fiestas, antes que la temporada)
  fechas: (ano: number) => [string, string]; // AAAA-MM-DD, ambos incluidos
  platos: Plato[];
}

const dos = (n: number) => String(n).padStart(2, '0');
const f = (ano: number, mes: number, dia: number) => `${ano}-${dos(mes)}-${dos(dia)}`;
const fijo = (m1: number, d1: number, m2: number, d2: number) => (ano: number): [string, string] => [f(ano, m1, d1), f(ano, m2, d2)];
const sumar = (iso: string, dias: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
};

// Domingo de Pascua (algoritmo de Meeus/Butcher, calendario gregoriano).
export function pascua(ano: number): string {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100, d = Math.floor(b / 4), e = b % 4;
  const g = Math.floor((8 * b + 13) / 25), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return f(ano, mes, dia);
}
// Primer domingo de mayo (Día de la Madre en España).
function diaMadre(ano: number): string {
  const d = new Date(Date.UTC(ano, 4, 1, 12));
  d.setUTCDate(1 + ((7 - d.getUTCDay()) % 7));
  return d.toISOString().slice(0, 10);
}

export const ESPECIALES: Especial[] = [
  {
    clave: 'halloween', titulo: 'Especial Halloween', emoji: '🎃', prioridad: 3,
    descripcion: 'Calabaza, castañas y los dulces de Todos los Santos.',
    fechas: fijo(10, 24, 11, 2),
    platos: [
      ['Crema de calabaza con pipas tostadas', 'cena', 'facil'], ['Huesos de santo caseros', 'otro', 'elaborado'],
      ['Buñuelos de viento al horno', 'otro', 'medio'], ['Panellets de almendra y boniato', 'otro', 'medio'],
      ['Castañas asadas al horno', 'merienda', 'facil'], ['Calabaza asada con especias y garbanzos', 'almuerzo', 'facil'],
      ['Muffins de calabaza y avena', 'merienda', 'facil'], ['Galletas dedos de bruja de almendra', 'otro', 'medio'],
      ['Pizza de calabaza con arañas de aceituna', 'cena', 'medio'], ['Hamburguesas monstruo de lentejas', 'cena', 'medio'],
      ['Mandarinas calabaza y plátanos fantasma', 'merienda', 'facil'], ['Gachas de avena y calabaza con canela', 'desayuno', 'facil'],
    ],
  },
  {
    clave: 'otono_setas', titulo: 'Otoño: setas, castañas y cuchara', emoji: '🍂', prioridad: 1,
    descripcion: 'Lo mejor del otoño, de la huerta y del monte.',
    fechas: fijo(11, 3, 11, 30),
    platos: [
      ['Guiso de setas con patatas', 'almuerzo', 'medio'], ['Crema de castañas', 'cena', 'facil'],
      ['Boniato asado relleno de queso fresco', 'cena', 'facil'], ['Potaje de garbanzos y calabaza', 'almuerzo', 'medio'],
      ['Pollo guisado con castañas y setas', 'almuerzo', 'medio'], ['Sopa de cebolla gratinada', 'cena', 'medio'],
      ['Crema de calabaza y jengibre', 'cena', 'facil'], ['Membrillo casero', 'otro', 'medio'],
      ['Bizcocho de calabaza y nueces', 'merienda', 'medio'], ['Pera asada con canela', 'merienda', 'facil'],
      ['Revuelto de setas y ajetes', 'cena', 'facil'], ['Lentejas con setas', 'almuerzo', 'facil'],
    ],
  },
  {
    clave: 'pre_navidad', titulo: 'Se acerca la Navidad', emoji: '🎄', prioridad: 1,
    descripcion: 'Dulces caseros y entrantes para ir preparando las fiestas.',
    fechas: fijo(12, 1, 12, 23),
    platos: [
      ['Galletas de jengibre', 'otro', 'medio'], ['Turrón casero de almendra y chocolate negro', 'otro', 'medio'],
      ['Polvorones caseros de almendra', 'otro', 'medio'], ['Mazapanes caseros', 'otro', 'medio'],
      ['Brochetas de langostino y piña', 'cena', 'facil'], ['Hummus de remolacha', 'cena', 'facil'],
      ['Paté de champiñones', 'cena', 'facil'], ['Canapés de salmón ahumado y aguacate', 'cena', 'facil'],
      ['Trufas de chocolate y dátiles', 'otro', 'facil'], ['Sopa de almendras', 'otro', 'medio'],
      ['Turrón de chocolate crujiente casero', 'otro', 'facil'], ['Crema de marisco ligera', 'cena', 'medio'],
    ],
  },
  {
    clave: 'navidad', titulo: 'Especial Navidad', emoji: '🎅', prioridad: 3,
    descripcion: 'Nochebuena, Navidad y Nochevieja en casa.',
    fechas: (ano) => [f(ano, 12, 24), f(ano + 1, 1, 1)],
    platos: [
      ['Pavo relleno al horno', 'almuerzo', 'elaborado'], ['Cordero asado al estilo castellano', 'almuerzo', 'elaborado'],
      ['Besugo al horno', 'cena', 'medio'], ['Langostinos cocidos con salsa de yogur', 'cena', 'facil'],
      ['Sopa de picadillo', 'cena', 'facil'], ['Lombarda con manzana', 'almuerzo', 'facil'],
      ['Cardo con almendras', 'almuerzo', 'medio'], ['Solomillo Wellington', 'cena', 'elaborado'],
      ['Merluza en salsa verde con almejas', 'cena', 'medio'], ['Turrón blando casero', 'otro', 'medio'],
      ['Ensalada de escarola y granada', 'cena', 'facil'], ['Pularda al horno con ciruelas', 'almuerzo', 'elaborado'],
    ],
  },
  {
    clave: 'roscon', titulo: 'Especial Roscón de Reyes', emoji: '👑', prioridad: 4,
    descripcion: 'El roscón de siempre y versiones más ligeras.',
    fechas: fijo(1, 2, 1, 6),
    platos: [
      ['Roscón de Reyes casero', 'otro', 'elaborado'], ['Roscón de Reyes integral más ligero', 'otro', 'elaborado'],
      ['Roscón de Reyes relleno de nata', 'otro', 'elaborado'], ['Chocolate a la taza casero', 'merienda', 'facil'],
      ['Roscón de bizcocho exprés', 'otro', 'medio'], ['Mini roscones de avena', 'merienda', 'medio'],
      ['Roscón de Reyes sin gluten', 'otro', 'elaborado'], ['Bizcocho de naranja y agua de azahar', 'merienda', 'medio'],
      ['Roscón de Reyes con crema y fresas', 'otro', 'elaborado'], ['Leche merengada casera', 'merienda', 'facil'],
    ],
  },
  {
    clave: 'invierno_cuchara', titulo: 'Invierno: platos de cuchara', emoji: '🥣', prioridad: 1,
    descripcion: 'Cocidos, legumbres y sopas para los días de frío.',
    fechas: (ano) => [f(ano, 1, 7), sumar(pascua(ano), -14)],
    platos: [
      ['Cocido madrileño', 'almuerzo', 'elaborado'], ['Fabada asturiana', 'almuerzo', 'elaborado'],
      ['Caldo de pollo casero', 'cena', 'facil'], ['Sopa castellana', 'cena', 'facil'],
      ['Crema de puerros', 'cena', 'facil'], ['Cocido montañés', 'almuerzo', 'elaborado'],
      ['Garbanzos con espinacas', 'almuerzo', 'facil'], ['Caldo gallego', 'almuerzo', 'medio'],
      ['Alubias con almejas', 'almuerzo', 'medio'], ['Arroz caldoso de pollo', 'almuerzo', 'medio'],
      ['Lentejas estofadas con verduras', 'almuerzo', 'facil'], ['Sopa de cebolla', 'cena', 'facil'],
    ],
  },
  {
    clave: 'carnaval', titulo: 'Especial Carnaval', emoji: '🎭', prioridad: 3,
    descripcion: 'Los dulces de Carnaval, también en versión de horno.',
    fechas: (ano) => [sumar(pascua(ano), -52), sumar(pascua(ano), -47)],
    platos: [
      ['Orejas de carnaval al horno', 'otro', 'medio'], ['Filloas caseras', 'merienda', 'medio'],
      ['Flores de carnaval', 'otro', 'medio'], ['Leche frita al horno', 'otro', 'medio'],
      ['Buñuelos de crema', 'otro', 'elaborado'], ['Pestiños al horno', 'otro', 'medio'],
      ['Rosquillas de anís al horno', 'otro', 'medio'], ['Crepes de avena con fruta', 'merienda', 'facil'],
      ['Tortas de aceite caseras', 'merienda', 'medio'], ['Filloas rellenas de crema', 'otro', 'medio'],
    ],
  },
  {
    clave: 'san_valentin', titulo: 'Especial San Valentín', emoji: '❤️', prioridad: 2,
    descripcion: 'Cenas para dos y postres con chocolate y fresas.',
    fechas: fijo(2, 7, 2, 14),
    platos: [
      ['Solomillo con salsa de frutos rojos', 'cena', 'medio'], ['Risotto de setas', 'cena', 'medio'],
      ['Lubina a la sal', 'cena', 'medio'], ['Fresas bañadas en chocolate negro', 'otro', 'facil'],
      ['Mousse de chocolate y aguacate', 'otro', 'facil'], ['Tartar de salmón y aguacate', 'cena', 'facil'],
      ['Pasta con gambas y tomate cherry', 'cena', 'facil'], ['Coulant de chocolate', 'otro', 'medio'],
      ['Ensalada de rúcula, pera y nueces', 'cena', 'facil'], ['Pizza casera en forma de corazón', 'cena', 'medio'],
      ['Fondue de chocolate con fruta', 'otro', 'facil'],
    ],
  },
  {
    clave: 'dia_padre', titulo: 'Especial Día del Padre', emoji: '👨', prioridad: 4,
    descripcion: 'Un menú para celebrarlo en casa.',
    fechas: fijo(3, 15, 3, 19),
    platos: [
      ['Entrecot a la plancha con pimientos asados', 'almuerzo', 'facil'], ['Tarta de queso al horno', 'otro', 'medio'],
      ['Pulpo a la gallega', 'almuerzo', 'medio'], ['Croquetas caseras de jamón', 'cena', 'elaborado'],
      ['Tortilla de patatas jugosa', 'cena', 'medio'], ['Brownie de chocolate', 'otro', 'medio'],
      ['Costillas de cerdo al horno', 'almuerzo', 'medio'], ['Ensaladilla rusa casera', 'almuerzo', 'medio'],
      ['Paella mixta', 'almuerzo', 'elaborado'], ['Chipirones encebollados', 'cena', 'medio'],
    ],
  },
  {
    clave: 'semana_santa', titulo: 'Especial Semana Santa', emoji: '🌿', prioridad: 3,
    descripcion: 'Torrijas, potajes y bacalao, como manda la tradición.',
    fechas: (ano) => [sumar(pascua(ano), -13), sumar(pascua(ano), 1)],
    platos: [
      ['Torrijas tradicionales', 'otro', 'medio'], ['Torrijas al horno más ligeras', 'otro', 'medio'],
      ['Potaje de vigilia', 'almuerzo', 'medio'], ['Bacalao con tomate', 'almuerzo', 'medio'],
      ['Buñuelos de bacalao', 'cena', 'medio'], ['Soldaditos de Pavía al horno', 'cena', 'medio'],
      ['Mona de Pascua casera', 'otro', 'elaborado'], ['Sopa de ajo', 'cena', 'facil'],
      ['Garbanzos con bacalao y espinacas', 'almuerzo', 'medio'], ['Bacalao al pil pil', 'cena', 'elaborado'],
      ['Huevos rellenos de atún', 'cena', 'facil'], ['Torrijas con leche vegetal', 'otro', 'medio'],
    ],
  },
  {
    clave: 'primavera', titulo: 'Primavera en la cocina', emoji: '🌸', prioridad: 1,
    descripcion: 'Espárragos, guisantes, habas y fresas de temporada.',
    fechas: (ano) => [sumar(pascua(ano), 2), f(ano, 5, 31)],
    platos: [
      ['Espárragos trigueros con huevo', 'cena', 'facil'], ['Guisantes con jamón', 'almuerzo', 'facil'],
      ['Habas salteadas con ajetes', 'cena', 'facil'], ['Alcachofas a la plancha', 'cena', 'facil'],
      ['Ensalada de fresas y espinacas', 'cena', 'facil'], ['Crema de guisantes y menta', 'cena', 'facil'],
      ['Menestra de verduras', 'almuerzo', 'medio'], ['Tortilla de espárragos', 'cena', 'facil'],
      ['Arroz primavera con verduras', 'almuerzo', 'medio'], ['Fresas con yogur y menta', 'merienda', 'facil'],
      ['Pasta con pesto de guisantes', 'almuerzo', 'facil'],
    ],
  },
  {
    clave: 'dia_madre', titulo: 'Especial Día de la Madre', emoji: '💐', prioridad: 4,
    descripcion: 'Un desayuno o una comida especial para ella.',
    fechas: (ano) => [sumar(diaMadre(ano), -4), diaMadre(ano)],
    platos: [
      ['Tortitas de avena con fresas', 'desayuno', 'facil'], ['Tostadas francesas al horno', 'desayuno', 'facil'],
      ['Bizcocho de limón y yogur', 'merienda', 'medio'], ['Tarta de fresas y yogur', 'otro', 'medio'],
      ['Salmón al horno con espárragos', 'almuerzo', 'facil'], ['Ensalada de quinoa y frutos rojos', 'almuerzo', 'facil'],
      ['Bol de yogur con frutos rojos y granola', 'desayuno', 'facil'], ['Muffins de plátano y avena', 'merienda', 'facil'],
      ['Huevos benedict ligeros', 'desayuno', 'medio'], ['Crema de espárragos blancos', 'cena', 'facil'],
    ],
  },
  {
    clave: 'buen_tiempo', titulo: 'Llega el buen tiempo', emoji: '🧺', prioridad: 1,
    descripcion: 'Recetas frescas para llevar a la playa, la piscina o el campo.',
    fechas: fijo(6, 1, 6, 20),
    platos: [
      ['Ensalada de pasta para llevar', 'almuerzo', 'facil'], ['Wrap de pollo y verduras', 'almuerzo', 'facil'],
      ['Ensalada de garbanzos para llevar', 'almuerzo', 'facil'], ['Empanada gallega de atún', 'almuerzo', 'elaborado'],
      ['Tortilla de calabacín', 'cena', 'facil'], ['Hummus con crudités', 'merienda', 'facil'],
      ['Bocadillo integral de atún y pimientos', 'almuerzo', 'facil'], ['Ensalada de lentejas', 'almuerzo', 'facil'],
      ['Brochetas de fruta', 'merienda', 'facil'], ['Sándwich vegetal integral', 'cena', 'facil'],
    ],
  },
  {
    clave: 'san_juan', titulo: 'Especial San Juan', emoji: '🔥', prioridad: 4,
    descripcion: 'Para la noche más corta del año.',
    fechas: fijo(6, 21, 6, 24),
    platos: [
      ['Sardinas asadas', 'cena', 'facil'], ['Coca de San Juan casera', 'otro', 'elaborado'],
      ['Brochetas de pollo y verduras a la parrilla', 'cena', 'facil'], ['Pimientos asados', 'cena', 'facil'],
      ['Patatas a lo pobre al horno', 'cena', 'facil'], ['Ensalada de tomate y ventresca', 'cena', 'facil'],
      ['Pinchos morunos de pollo', 'cena', 'medio'], ['Coca de recapte', 'cena', 'medio'],
      ['Mazorcas de maíz a la brasa', 'cena', 'facil'], ['Sangría sin alcohol de frutas', 'merienda', 'facil'],
    ],
  },
  {
    clave: 'verano', titulo: 'Recetas de verano', emoji: '☀️', prioridad: 1,
    descripcion: 'Gazpachos, ensaladas, smoothies y helados caseros.',
    fechas: fijo(6, 25, 8, 31),
    platos: [
      ['Gazpacho andaluz', 'almuerzo', 'facil'], ['Salmorejo cordobés', 'cena', 'facil'],
      ['Ajoblanco malagueño', 'cena', 'facil'], ['Smoothie de mango y plátano', 'merienda', 'facil'],
      ['Smoothie verde de espinacas y piña', 'desayuno', 'facil'], ['Polos de sandía', 'merienda', 'facil'],
      ['Helado de plátano y cacao', 'merienda', 'facil'], ['Ensalada de sandía y queso feta', 'cena', 'facil'],
      ['Pipirrana', 'cena', 'facil'], ['Ceviche de corvina', 'cena', 'medio'],
      ['Gazpacho de fresas', 'cena', 'facil'], ['Tomates rellenos de atún', 'cena', 'facil'],
      ['Granizado de limón casero', 'merienda', 'facil'],
    ],
  },
  {
    clave: 'vuelta_rutina', titulo: 'Vuelta a la rutina', emoji: '🎒', prioridad: 1,
    descripcion: 'Tuppers, cenas rápidas y cocinar para toda la semana.',
    fechas: fijo(9, 1, 9, 16),
    platos: [
      ['Tupper de arroz con pollo y verduras', 'almuerzo', 'facil'], ['Ensalada de quinoa para llevar', 'almuerzo', 'facil'],
      ['Pollo al curry con arroz', 'almuerzo', 'medio'], ['Albóndigas en salsa de tomate', 'almuerzo', 'medio'],
      ['Pisto con huevo', 'cena', 'facil'], ['Pasta integral con atún y tomate', 'almuerzo', 'facil'],
      ['Crema de calabacín', 'cena', 'facil'], ['Hamburguesas caseras de pollo', 'cena', 'facil'],
      ['Bowl de garbanzos y verduras asadas', 'almuerzo', 'facil'], ['Tortilla de patatas y espinacas', 'cena', 'medio'],
    ],
  },
  {
    clave: 'dia_paella', titulo: 'Día de la Paella', emoji: '🥘', prioridad: 4,
    descripcion: 'El 20 de septiembre, arroz para todos.',
    fechas: fijo(9, 17, 9, 20),
    platos: [
      ['Paella valenciana', 'almuerzo', 'elaborado'], ['Paella de marisco', 'almuerzo', 'elaborado'],
      ['Arroz negro', 'almuerzo', 'elaborado'], ['Arroz a banda', 'almuerzo', 'elaborado'],
      ['Paella de verduras', 'almuerzo', 'medio'], ['Paella mixta', 'almuerzo', 'elaborado'],
      ['Fideuá', 'almuerzo', 'elaborado'], ['Arroz al horno', 'almuerzo', 'medio'],
      ['Arroz caldoso de marisco', 'almuerzo', 'elaborado'], ['Paella de pollo y conejo', 'almuerzo', 'elaborado'],
    ],
  },
  {
    clave: 'otono_inicio', titulo: 'Llega el otoño', emoji: '🍁', prioridad: 1,
    descripcion: 'Calabaza, granada, uvas y los primeros guisos.',
    fechas: fijo(9, 21, 10, 23),
    platos: [
      ['Crema de calabaza asada', 'cena', 'facil'], ['Ensalada de granada y queso fresco', 'cena', 'facil'],
      ['Lentejas con calabaza', 'almuerzo', 'facil'], ['Pollo asado con uvas', 'almuerzo', 'medio'],
      ['Pastel de calabaza', 'otro', 'medio'], ['Setas al ajillo', 'cena', 'facil'],
      ['Arroz meloso con setas', 'almuerzo', 'medio'], ['Ensalada templada de calabaza y quinoa', 'cena', 'facil'],
      ['Higos con yogur y nueces', 'merienda', 'facil'], ['Boniato asado con pollo', 'almuerzo', 'facil'],
    ],
  },
];

// Fechas de un especial alrededor de una fecha (el de este año, o el que empezó el año anterior: Navidad).
function rangoEn(e: Especial, fecha: string): [string, string] {
  const ano = Number(fecha.slice(0, 4));
  for (const a of [ano, ano - 1]) {
    const [ini, fin] = e.fechas(a);
    if (fecha >= ini && fecha <= fin) return [ini, fin];
  }
  return e.fechas(ano);
}

// Especiales de una fecha, el más importante primero.
export function especialesDe(fecha: string): (Especial & { desde: string; hasta: string })[] {
  return ESPECIALES.map((e) => {
    const [desde, hasta] = rangoEn(e, fecha);
    return { ...e, desde, hasta };
  })
    .filter((e) => fecha >= e.desde && fecha <= e.hasta)
    .sort((a, b) => b.prioridad - a.prioridad);
}

// Especiales que están en marcha o empiezan en los próximos `dias` días (para preparar sus recetas con tiempo).
export function especialesProximos(fecha: string, dias: number): Especial[] {
  const limite = sumar(fecha, dias);
  const ano = Number(fecha.slice(0, 4));
  return ESPECIALES.filter((e) =>
    [ano - 1, ano, ano + 1].some((a) => {
      const [ini, fin] = e.fechas(a);
      return ini <= limite && fin >= fecha;
    }),
  );
}

export const especialPorClave = (clave: string) => ESPECIALES.find((e) => e.clave === clave) ?? null;
