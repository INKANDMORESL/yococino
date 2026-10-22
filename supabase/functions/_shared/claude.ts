// Llamada a la API de Claude obligando a responder con una herramienta (JSON con esquema fijo).
// La clave se guarda como secreto de Supabase: ANTHROPIC_API_KEY.

export class ErrorIA extends Error {
  readonly reintentable: boolean;
  readonly noConfigurada: boolean;
  constructor(mensaje: string, opciones: { reintentable?: boolean; noConfigurada?: boolean } = {}) {
    super(mensaje);
    this.reintentable = opciones.reintentable ?? false;
    this.noConfigurada = opciones.noConfigurada ?? false;
  }
}

interface Herramienta {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function pedirConHerramienta<T>(opciones: {
  modelo: string;
  sistema: string;
  mensaje: string;
  herramienta: Herramienta;
  maxTokens?: number;
  timeoutMs?: number;
}): Promise<T> {
  const clave = Deno.env.get('ANTHROPIC_API_KEY');
  if (!clave) throw new ErrorIA('Falta el secreto ANTHROPIC_API_KEY en Supabase.', { noConfigurada: true });

  const cuerpo = JSON.stringify({
    model: opciones.modelo,
    max_tokens: opciones.maxTokens ?? 4000,
    system: opciones.sistema,
    messages: [{ role: 'user', content: opciones.mensaje }],
    tools: [opciones.herramienta],
    tool_choice: { type: 'tool', name: opciones.herramienta.name },
  });

  let ultimoError = '';
  for (let intento = 0; intento < 3; intento++) {
    let res: Response;
    try {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': clave, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: cuerpo,
        signal: AbortSignal.timeout(opciones.timeoutMs ?? 90_000),
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
    if (!res.ok) {
      const detalle = datos?.error?.message ?? `HTTP ${res.status}`;
      // 401/403: clave incorrecta o sin saldo; se trata como "no configurada".
      const sinSaldo = /credit balance|billing/i.test(String(detalle));
      throw new ErrorIA(`La IA rechazó la petición: ${detalle}`, {
        noConfigurada: res.status === 401 || res.status === 403 || sinSaldo,
      });
    }
    const bloque = (datos?.content ?? []).find(
      (b: { type: string; name?: string }) => b.type === 'tool_use' && b.name === opciones.herramienta.name,
    );
    if (!bloque) throw new ErrorIA('La IA no devolvió el formato esperado.', { reintentable: true });
    if (datos.stop_reason === 'max_tokens') throw new ErrorIA('La respuesta de la IA quedó cortada.', { reintentable: true });
    return bloque.input as T;
  }
  throw new ErrorIA(`No se pudo contactar con la IA: ${ultimoError}`, { reintentable: true });
}
