// Aparatos de cocina: qué tiene cada persona (profiles.aparatos) y qué necesita cada receta (recetas.aparatos).
// Los fuegos (vitro, inducción o gas) y los utensilios normales se dan por hechos y no cuentan.
// Una receta de horno también se puede hacer en airfryer si trae su nota (recetas.nota_airfryer).
import { normalizar } from './texto.ts';

export const APARATOS = ['horno', 'airfryer', 'microondas', 'robot'] as const;
export type Aparato = (typeof APARATOS)[number];

export const NOMBRE_APARATO: Record<Aparato, string> = {
  horno: 'horno',
  airfryer: 'airfryer (freidora de aire)',
  microondas: 'microondas',
  robot: 'robot de cocina (tipo Thermomix)',
};

// Si la persona aún no ha contestado, se supone una cocina normal: horno y microondas.
export const APARATOS_POR_DEFECTO: Aparato[] = ['horno', 'microondas'];

export const aparatosValidos = (v: unknown): Aparato[] =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is Aparato => (APARATOS as readonly string[]).includes(x as string)))] : [];

// Lo que tiene la persona (null o sin contestar = cocina normal).
export const aparatosDe = (v: unknown): Aparato[] => (Array.isArray(v) ? aparatosValidos(v) : APARATOS_POR_DEFECTO);

// Aparatos que necesita la receta y la persona no tiene (lista vacía = la puede hacer).
export function aparatosQueFaltan(necesita: unknown, notaAirfryer: unknown, tiene: Aparato[]): Aparato[] {
  const conNota = typeof notaAirfryer === 'string' && notaAirfryer.trim().length > 0;
  return aparatosValidos(necesita).filter((a) => !tiene.includes(a) && !(a === 'horno' && conNota && tiene.includes('airfryer')));
}

export const seHaceEnAirfryer = (necesita: unknown, notaAirfryer: unknown) =>
  aparatosValidos(necesita).includes('airfryer') || (typeof notaAirfryer === 'string' && notaAirfryer.trim().length > 0);

// Aparatos que se mencionan en los pasos (para marcar recetas sin preguntar a la IA).
const PALABRAS: Record<Aparato, string[]> = {
  horno: ['horno', 'hornea', 'hornear', 'gratina', 'gratinar', 'gratinado', 'precalienta'],
  airfryer: ['airfryer', 'air fryer', 'freidora de aire', 'freidora sin aceite'],
  microondas: ['microondas'],
  robot: ['thermomix', 'robot de cocina', 'vaso del robot', 'velocidad cuchara', 'varoma'],
};
export function aparatosEnTexto(textos: string[]): Aparato[] {
  const t = ` ${textos.map((x) => normalizar(x)).join(' ')} `;
  const encontrados = APARATOS.filter((a) => PALABRAS[a].some((p) => t.includes(normalizar(p))));
  // «Precalienta la airfryer» no es horno.
  if (encontrados.includes('airfryer') && encontrados.includes('horno') && !PALABRAS.horno.filter((p) => p !== 'precalienta').some((p) => t.includes(p))) {
    return encontrados.filter((a) => a !== 'horno');
  }
  return encontrados;
}

// Texto para la IA que escribe recetas.
export function describirCocina(tiene: Aparato[], airfryerPrincipal = false): string {
  const no = APARATOS.filter((a) => !tiene.includes(a)).map((a) => NOMBRE_APARATO[a]);
  return [
    `- Cocina disponible: fuegos y utensilios normales${tiene.length ? `, y además ${tiene.map((a) => NOMBRE_APARATO[a]).join(', ')}` : ''}.${
      no.length ? ` No uses: ${no.join(', ')}.` : ''
    }`,
    airfryerPrincipal
      ? '- Este plato se cocina en airfryer: escribe los pasos para airfryer con temperatura (°C) y minutos, y marca "airfryer" en aparatos.'
      : tiene.includes('airfryer')
        ? '- Si el plato queda bien en airfryer (asados, rebozados al horno, verduras crujientes), puedes hacerlo en airfryer.'
        : '',
    '- "aparatos": marca los aparatos que hacen falta de verdad (horno, airfryer, microondas, robot). Los fuegos no cuentan.',
    '- "nota_airfryer": si la receta usa el horno y se puede hacer igual de bien en airfryer, una frase que empiece por «En airfryer:» con temperatura, minutos y si hay que darle la vuelta. Si no usa horno o no queda bien en airfryer, vacío.',
  ]
    .filter(Boolean)
    .join('\n');
}
