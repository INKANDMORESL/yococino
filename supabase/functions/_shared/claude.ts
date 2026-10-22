// Llamada a la API de Claude pidiendo la respuesta en JSON con un esquema fijo ("structured outputs").
// Los modelos actuales (Sonnet 5.5, Opus 5.5) no permiten forzar una herramienta, así que se usa
// output_config.format, que garantiza que la respuesta cumple el esquema.
// La clave se guarda como secreto de Supabase: ANTHROPIC_API_KEY.

import { costeTokens, sumarCoste } from './costes.ts';

export class ErrorIA extends Error {
  readonly reintentable: boolean;
  readonly noConfigurada: boolean;
  constructor(mensaje: string, opciones: { reintentable?: boolean; noConfigurada?: boolean } = {}) {
    super(mensaje);
    this.reintentable = opciones.reintentable ?? false;
    this.noConfigurada = opciones.noConfigurada ?? false;
  }
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface PeticionJSON {
  modelo: string;
  sistema: string;
  mensaje: string;
  esquema: Record<string, unknown>;
  maxTokens?: number;
  timeoutMs?: number;
}

// Cuerpo de la petición a Claude (sirve igual para una llamada normal y para un lote).
export const parametros = (o: PeticionJSON) => ({
  model: o.modelo,
  max_tokens: o.maxTokens ?? 8000,
  system: o.sistema,
  messages: [{ role: 'user', content: o.mensaje }],
  output_config: { format: { type: 'json_schema', schema: o.esquema } },
});

// Saca el JSON de una respuesta de Claude.
// deno-lint-ignore no-explicit-any
export function leerJSON<T>(datos: any): T {
  const textoRespuesta = (datos?.content ?? [])
    .filter((b: { type: string }) => b.type === 'text')
    .map((b: { text: string }) => b.text)
    .join('');
  try {
    return JSON.parse(textoRespuesta) as T;
  } catch {
    throw new ErrorIA('La IA no devolvió un JSON válido.', { reintentable: true });
  }
}

export async function pedirJSON<T>(opciones: PeticionJSON): Promise<T> {
  const clave = Deno.env.get('ANTHROPIC_API_KEY');
  if (!clave) throw new ErrorIA('Falta el secreto ANTHROPIC_API_KEY en Supabase.', { noConfigurada: true });

  const cuerpo = JSON.stringify(parametros(opciones));

  let ultimoError = '';
  for (let intento = 0; intento < 3; intento++) {
    let res: Response;
    try {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': clave, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: cuerpo,
        signal: AbortSignal.timeout(opciones.timeoutMs ?? 120_000),
      });
    } catch (e) {
      ultimoError = `sin respuesta (${e instanceof Error ? e.message : e})`;
      await esperar(1500 * (intento + 1));
      continue;
    }

    if (res.status === 429 || res.status === 529 || res.status >= 500) {
      ultimoError = `HTTP ${res.status}`;
      const espera = Number(res.headers.get('retry-after')) * 1000 || 2000 * (intento + 1);
      await esperar(Math.min(espera, 10_000));
      continue;
    }

    const datos = await res.json().catch(() => null);
    // Lo que se ha pagado por esta respuesta cuenta aunque luego no sirva.
    if (datos?.usage) sumarCoste(costeTokens(opciones.modelo, datos.usage));
    if (!res.ok) {
      const detalle = datos?.error?.message ?? `HTTP ${res.status}`;
      const sinSaldo = /credit balance|billing/i.test(String(detalle));
      throw new ErrorIA(`La IA rechazó la petición: ${detalle}`, {
        noConfigurada: res.status === 401 || res.status === 403 || sinSaldo,
      });
    }
    if (datos?.stop_reason === 'max_tokens') throw new ErrorIA('La respuesta de la IA quedó cortada.', { reintentable: true });
    if (datos?.stop_reason === 'refusal') throw new ErrorIA('La IA no quiso responder a esta petición.', { reintentable: true });

    return leerJSON<T>(datos);
  }
  throw new ErrorIA(`No se pudo contactar con la IA: ${ultimoError}`, { reintentable: true });
}

// ---------- Lotes (Message Batches): mitad de precio, respuesta en minutos u horas ----------
// Solo se usan para lo que crea el administrador (carga del recetario), nunca para los clientes.

const API = 'https://api.anthropic.com/v1/messages/batches';
const cabeceras = () => {
  const clave = Deno.env.get('ANTHROPIC_API_KEY');
  if (!clave) throw new ErrorIA('Falta el secreto ANTHROPIC_API_KEY en Supabase.', { noConfigurada: true });
  return { 'x-api-key': clave, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' };
};

export async function crearLote(peticiones: { id: string; peticion: PeticionJSON }[]): Promise<string> {
  const res = await fetch(API, {
    method: 'POST',
    headers: cabeceras(),
    body: JSON.stringify({ requests: peticiones.map((p) => ({ custom_id: p.id, params: parametros(p.peticion) })) }),
  });
  const datos = await res.json().catch(() => null);
  if (!res.ok || !datos?.id) throw new ErrorIA(`No se pudo crear el lote: ${datos?.error?.message ?? res.status}`);
  return datos.id as string;
}

export async function estadoLote(id: string): Promise<{ terminado: boolean; urlResultados: string | null }> {
  const res = await fetch(`${API}/${id}`, { headers: cabeceras() });
  const datos = await res.json().catch(() => null);
  if (!res.ok) throw new ErrorIA(`No se pudo consultar el lote: ${datos?.error?.message ?? res.status}`);
  return { terminado: datos?.processing_status === 'ended', urlResultados: datos?.results_url ?? null };
}

// Resultados de un lote: por cada petición, el mensaje de Claude (o null si falló).
// deno-lint-ignore no-explicit-any
export async function resultadosLote(url: string): Promise<Map<string, any>> {
  const res = await fetch(url, { headers: cabeceras() });
  if (!res.ok) throw new ErrorIA(`No se pudieron leer los resultados del lote: ${res.status}`);
  // deno-lint-ignore no-explicit-any
  const mapa = new Map<string, any>();
  for (const linea of (await res.text()).split('\n')) {
    if (!linea.trim()) continue;
    try {
      const fila = JSON.parse(linea);
      mapa.set(fila.custom_id, fila.result?.type === 'succeeded' ? fila.result.message : null);
    } catch {
      // línea dañada: se ignora
    }
  }
  return mapa;
}
