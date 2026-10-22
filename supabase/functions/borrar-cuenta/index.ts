// borrar-cuenta: borra para siempre la cuenta de quien llama y todos sus datos (derecho de supresión, RGPD).
// Las tablas de la persona tienen "on delete cascade", así que al borrar el usuario se borra todo lo suyo.
// Las recetas compartidas no son datos personales y se conservan.
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const responder = (cuerpo: unknown, estado = 200) =>
  new Response(JSON.stringify(cuerpo), { status: estado, headers: { ...CORS, 'Content-Type': 'application/json' } });

function claveDeLista(variable: string): string | undefined {
  try {
    const d = JSON.parse(Deno.env.get(variable) ?? '{}') as Record<string, string>;
    return d.default ?? Object.values(d)[0];
  } catch {
    return undefined;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return responder({ error: 'metodo' }, 405);

  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const publica = Deno.env.get('SUPABASE_ANON_KEY') || claveDeLista('SUPABASE_PUBLISHABLE_KEYS') || '';
  const secreta = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || claveDeLista('SUPABASE_SECRET_KEYS') || '';
  const opciones = { auth: { persistSession: false, autoRefreshToken: false } };

  const usuario = createClient(url, publica, { ...opciones, global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
  const { data } = await usuario.auth.getUser();
  if (!data?.user) return responder({ error: 'no_autenticado', mensaje: 'Vuelve a entrar en tu cuenta.' }, 401);

  const admin = createClient(url, secreta, opciones);
  const { error } = await admin.auth.admin.deleteUser(data.user.id);
  if (error) {
    console.error('borrar-cuenta:', error.message);
    return responder({ error: 'interno', mensaje: 'No hemos podido borrar la cuenta.' }, 500);
  }
  return responder({ ok: true });
});
