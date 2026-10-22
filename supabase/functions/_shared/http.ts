// Piezas comunes de las funciones: respuestas HTTP, conexión con Supabase y fechas de España.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { ErrorIA } from './claude.ts';

// ---------- Respuestas HTTP ----------

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export const responder = (cuerpo: unknown, estado = 200) =>
  new Response(JSON.stringify(cuerpo), { status: estado, headers: { ...CORS, 'Content-Type': 'application/json' } });

// `detalle` es técnico y nunca incluye datos de la persona: sirve para diagnosticar.
export const fallo = (estado: number, error: string, mensaje: string, detalle?: string) =>
  responder({ error, mensaje, ...(detalle ? { detalle: detalle.slice(0, 300) } : {}) }, estado);

export const mensajeTecnico = (e: unknown) =>
  e instanceof Error ? e.message : (e as { message?: string })?.message ?? String(e);

// ---------- Fechas (zona horaria de España) ----------

const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

export const hoyEspana = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid' }).format(new Date());

export function sumarDias(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export const diaSemana = (iso: string) => DIAS_SEMANA[new Date(`${iso}T12:00:00Z`).getUTCDay()];

// ---------- Conexión con Supabase ----------

function claveDeLista(variable: string): string | undefined {
  try {
    const d = JSON.parse(Deno.env.get(variable) ?? '{}') as Record<string, string>;
    return d.default ?? Object.values(d)[0];
  } catch {
    return undefined;
  }
}

export function crearClientes(req: Request) {
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const publica = Deno.env.get('SUPABASE_ANON_KEY') || claveDeLista('SUPABASE_PUBLISHABLE_KEYS') || '';
  const secreta = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || claveDeLista('SUPABASE_SECRET_KEYS') || '';
  const opciones = { auth: { persistSession: false, autoRefreshToken: false } };
  const usuario = createClient(url, publica, {
    ...opciones,
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const admin = createClient(url, secreta, opciones);
  return { usuario, admin };
}

export type Cliente = ReturnType<typeof crearClientes>['admin'];

// Arranca una función con CORS, solo POST y errores sin datos personales.
export function servir(nombre: string, manejar: (req: Request) => Promise<Response>, textoFallo: string) {
  Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    if (req.method !== 'POST') return fallo(405, 'metodo', 'Usa POST.');
    try {
      return await manejar(req);
    } catch (e) {
      if (e instanceof ErrorIA && e.noConfigurada) {
        console.error(`${nombre}: IA no configurada:`, e.message);
        return fallo(503, 'ia_no_configurada', 'Esta función aún no está activada. Vuelve a intentarlo más tarde.');
      }
      if (e instanceof ErrorIA) return fallo(502, 'ia', textoFallo, e.message);
      // Solo el mensaje técnico: nunca datos de la persona.
      console.error(`${nombre}:`, mensajeTecnico(e));
      return fallo(500, 'interno', textoFallo, mensajeTecnico(e));
    }
  });
}
