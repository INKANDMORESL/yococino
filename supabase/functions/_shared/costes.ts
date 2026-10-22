// Control de gasto por cliente. La suscripción cuesta 39,99 €/año y cada cliente no puede gastar
// más de 9 €/año en IA, fotos u otros servicios (decisión del dueño). Todo es configurable con secretos.
//
// - Cada petición acumula su coste (tokens de Claude, fotos de Google) y al terminar se guarda en usos_ia.
// - Funciones extra (plato nuevo, cocina con lo que tienes, cambiar ingrediente, versión Peques, fotos):
//   solo mientras quede presupuesto, guardando una reserva para el menú y con un tope mensual.
// - El menú nunca se queda sin hacer: si se acaba el presupuesto, se monta solo con recetas ya existentes y sin IA.
import { AsyncLocalStorage } from 'node:async_hooks';

const num = (variable: string, porDefecto: number) => {
  const v = Number(Deno.env.get(variable));
  return Number.isFinite(v) && v > 0 ? v : porDefecto;
};

export const PRESUPUESTO_ANUAL_EUR = num('PRESUPUESTO_ANUAL_EUR', 9);
export const RESERVA_MENU_EUR = num('RESERVA_MENU_EUR', 1.5);
export const TOPE_MES_EXTRAS_EUR = num('TOPE_MES_EXTRAS_EUR', 0.6);
const EUR_POR_USD = num('EUR_POR_USD', 0.9);
export const FOTO_USD = num('FOTO_USD', 0.04);

// Precio en dólares por millón de tokens (entrada, salida). Si un modelo no está, se usa el más caro conocido.
const PRECIOS: [string, number, number][] = [
  ['claude-haiku-5-5', 0.1, 0.5],
  ['claude-sonnet-5-5', 2, 10],
  ['claude-opus-5-5', 4, 20],
];

export function costeTokens(modelo: string, u: { input_tokens?: number; output_tokens?: number; cache_creation_input_tokens?: number; cache_read_input_tokens?: number }) {
  const [, entrada, salida] = PRECIOS.find(([m]) => modelo.startsWith(m)) ?? ['', 4, 20];
  const tokensEntrada = (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) * 1.25 + (u.cache_read_input_tokens ?? 0) * 0.1;
  return (tokensEntrada * entrada + (u.output_tokens ?? 0) * salida) / 1_000_000;
}

// ---------- Coste acumulado de la petición en curso ----------

interface Cuenta {
  usd: number;
  userId?: string;
  tipo?: string;
}
const almacen = new AsyncLocalStorage<Cuenta>();

export const conCuenta = <T>(fn: () => Promise<T>) => almacen.run({ usd: 0 }, fn);
export const sumarCoste = (usd: number) => {
  const c = almacen.getStore();
  if (c && usd > 0) c.usd += usd;
};
// Quién paga lo que se gaste en esta petición.
export const cobrarA = (userId: string, tipo: string) => {
  const c = almacen.getStore();
  if (c) Object.assign(c, { userId, tipo });
};
export const cuentaActual = () => almacen.getStore();

// ---------- Presupuesto ----------

// deno-lint-ignore no-explicit-any
type ClienteRpc = { rpc: (f: string, a: Record<string, unknown>) => PromiseLike<{ data: any }> };

export async function gastoEur(admin: ClienteRpc, userId: string, dias: number): Promise<number> {
  const desde = new Date(Date.now() - dias * 86_400_000).toISOString();
  const { data } = await admin.rpc('gasto_ia', { p_user: userId, p_desde: desde });
  return (Number(data) || 0) * EUR_POR_USD;
}

export type ModoMenu = 'completo' | 'ahorro' | 'sin_ia';

// Completo: IA y recetas nuevas. Ahorro: IA para planificar (barata), sin recetas nuevas. Sin IA: solo catálogo.
export async function modoMenu(admin: ClienteRpc, userId: string): Promise<ModoMenu> {
  const anual = await gastoEur(admin, userId, 365);
  if (anual >= PRESUPUESTO_ANUAL_EUR - 0.05) return 'sin_ia';
  if (anual >= PRESUPUESTO_ANUAL_EUR - 0.5) return 'ahorro';
  return 'completo';
}

// ¿Se puede usar una función extra? Devuelve null si sí, o el mensaje para la persona si no.
export async function motivoSinExtras(admin: ClienteRpc, userId: string): Promise<string | null> {
  const [anual, mes] = await Promise.all([gastoEur(admin, userId, 365), gastoEur(admin, userId, 30)]);
  if (anual >= PRESUPUESTO_ANUAL_EUR - RESERVA_MENU_EUR) {
    return 'Ya has usado todas las funciones con IA incluidas en tu plan este año. Tu menú sigue funcionando con normalidad.';
  }
  if (mes >= TOPE_MES_EXTRAS_EUR) {
    return 'Este mes ya has usado todas las funciones con IA incluidas en tu plan. Vuelven en unos días; tu menú sigue funcionando con normalidad.';
  }
  return null;
}
