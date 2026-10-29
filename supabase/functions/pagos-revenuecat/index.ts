// pagos-revenuecat: RevenueCat avisa aquí de cada compra, renovación, cambio de plan, cancelación o caducidad.
// Se guarda en public.suscripciones y estado_plan() da premium mientras activa_hasta sea futura.
// Seguridad: RevenueCat manda la cabecera Authorization con el secreto REVENUECAT_WEBHOOK_SECRET (Supabase).
// La persona es app_user_id = id de su cuenta de Yococino (se pone al iniciar sesión en la app).
// No se guardan datos personales: solo plan, fechas y tienda.
import { crearClientes, fallo, responder, servir } from '../_shared/http.ts';

interface Evento {
  type?: string;
  app_user_id?: string;
  original_app_user_id?: string;
  aliases?: string[];
  product_id?: string;
  new_product_id?: string;
  entitlement_ids?: string[] | null;
  expiration_at_ms?: number | null;
  event_timestamp_ms?: number;
  store?: string;
  environment?: string;
}

// Lo que de verdad tiene la persona, preguntado a RevenueCat (más fiable que las fechas del aviso).
// Necesita el secreto REVENUECAT_SECRET_KEY (clave secreta «sk_…» de RevenueCat). Sin él, se usa el aviso.
interface Acceso {
  expires_date: string | null;
  product_identifier?: string;
}
async function accesosDe(userId: string): Promise<{ premium: Acceso | null; peques: Acceso | null; producto: string | null; tienda: string | null; entorno: string | null } | null> {
  const clave = Deno.env.get('REVENUECAT_SECRET_KEY');
  if (!clave) return null;
  const r = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`, {
    headers: { Authorization: `Bearer ${clave}`, 'Content-Type': 'application/json' },
  });
  if (!r.ok) throw new Error(`RevenueCat ${r.status}`);
  const j = (await r.json()) as {
    subscriber?: {
      entitlements?: Record<string, Acceso>;
      subscriptions?: Record<string, { store?: string; is_sandbox?: boolean; expires_date?: string | null }>;
    };
  };
  const ent = j.subscriber?.entitlements ?? {};
  const premium = ent.premium ?? null;
  const producto = premium?.product_identifier ?? null;
  const sub = producto ? j.subscriber?.subscriptions?.[producto] ?? null : null;
  return { premium, peques: ent.peques ?? null, producto, tienda: sub?.store ?? null, entorno: sub ? (sub.is_sandbox ? 'SANDBOX' : 'PRODUCTION') : null };
}

// Guarda en suscripciones lo que dice RevenueCat. true si se ha podido preguntar.
async function sincronizar(admin: ReturnType<typeof crearClientes>['admin'], userId: string, evento: string | null): Promise<boolean> {
  const a = await accesosDe(userId);
  if (!a) return false;
  // Una suscripción regalada desde el panel (sin compra en la tienda) no se toca si en RevenueCat no hay nada.
  if (!a.premium?.expires_date) {
    const { data: previa } = await admin.from('suscripciones').select('producto, activa_hasta').eq('user_id', userId).maybeSingle();
    if (previa?.producto === 'regalo' && previa.activa_hasta && Date.parse(previa.activa_hasta as string) > Date.now()) return true;
  }
  const fin = a.premium?.expires_date ?? null;
  const conPeques = !!a.peques?.expires_date && Date.parse(a.peques.expires_date) > Date.now();
  const fila: Record<string, unknown> = {
    user_id: userId,
    activa_hasta: fin,
    peques: conPeques || /peques/i.test(a.producto ?? ''),
    plan_anual: /year|anual/i.test(a.producto ?? ''),
    producto: a.producto,
    tienda: a.tienda,
    entorno: a.entorno,
    evento_ms: Date.now(),
    updated_at: new Date().toISOString(),
  };
  if (evento) fila.ultimo_evento = evento;
  const { error } = await admin.from('suscripciones').upsert(fila, { onConflict: 'user_id' });
  if (error) throw error;
  return true;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function iguales(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

async function pagos(req: Request): Promise<Response> {
  // Desde la app, justo después de pagar o al recuperar compras: «sincronizar» (con la sesión de la persona).
  const { usuario, admin: adminApp } = crearClientes(req);
  const copia = req.clone();
  const peticion = (await copia.json().catch(() => ({}))) as { accion?: string };
  if (peticion.accion === 'sincronizar') {
    const { data: auth } = await usuario.auth.getUser();
    if (!auth?.user) return fallo(401, 'no_autenticado', 'Vuelve a entrar en tu cuenta.');
    const hecho = await sincronizar(adminApp, auth.user.id, null);
    return responder({ ok: true, sincronizado: hecho });
  }

  const secreto = Deno.env.get('REVENUECAT_WEBHOOK_SECRET') ?? '';
  const llega = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!secreto || !iguales(llega, secreto)) return fallo(401, 'no_autorizado', 'No autorizado.');

  const cuerpo = (await req.json().catch(() => ({}))) as { event?: Evento };
  const e = cuerpo.event ?? {};
  if (e.type === 'TEST') return responder({ ok: true, prueba: true });

  // Quién: su id de Yococino (también puede venir entre los alias si la compra se hizo antes de entrar).
  const candidatos = [e.app_user_id, e.original_app_user_id, ...(e.aliases ?? [])].filter((x): x is string => !!x && UUID.test(x));
  const userId = candidatos[0];
  if (!userId) return responder({ ok: true, ignorado: 'sin_usuario' });

  const { admin } = crearClientes(req);
  // Lo más fiable: preguntar a RevenueCat qué tiene ahora mismo.
  try {
    if (await sincronizar(admin, userId, e.type ?? null)) return responder({ ok: true, sincronizado: true });
  } catch (err) {
    console.error('pagos-revenuecat: no se pudo preguntar a RevenueCat:', err instanceof Error ? err.message : String(err));
  }
  const { data: previo } = await admin.from('suscripciones').select('evento_ms').eq('user_id', userId).maybeSingle();
  const momento = Number(e.event_timestamp_ms) || Date.now();
  // RevenueCat puede repetir o desordenar avisos: uno más antiguo que el último guardado no cambia nada.
  if (previo?.evento_ms && Number(previo.evento_ms) > momento) return responder({ ok: true, ignorado: 'antiguo' });

  const producto = (e.type === 'PRODUCT_CHANGE' && e.new_product_id) || e.product_id || '';
  const caduca = e.expiration_at_ms ? new Date(Number(e.expiration_at_ms)).toISOString() : null;
  const fila: Record<string, unknown> = {
    user_id: userId,
    producto,
    tienda: e.store ?? null,
    entorno: e.environment ?? null,
    plan_anual: /year|anual/i.test(producto),
    peques: /peques/i.test(producto) || (e.entitlement_ids ?? []).includes('peques'),
    evento_ms: momento,
    ultimo_evento: e.type ?? null,
    updated_at: new Date().toISOString(),
  };
  switch (e.type) {
    case 'EXPIRATION':
      // Se acabó: deja de ser premium.
      fila.activa_hasta = caduca && Date.parse(caduca) < Date.now() ? caduca : new Date().toISOString();
      fila.cancelada = true;
      break;
    case 'CANCELLATION':
      // Ha cancelado la renovación: sigue siendo premium hasta que acabe lo pagado.
      if (caduca) fila.activa_hasta = caduca;
      fila.cancelada = true;
      break;
    case 'INITIAL_PURCHASE':
    case 'RENEWAL':
    case 'PRODUCT_CHANGE':
    case 'UNCANCELLATION':
    case 'NON_RENEWING_PURCHASE':
    case 'BILLING_ISSUE':
    case 'SUBSCRIPTION_EXTENDED':
    case 'TEMPORARY_ENTITLEMENT_GRANT':
      if (caduca) fila.activa_hasta = caduca;
      if (e.type !== 'BILLING_ISSUE') fila.cancelada = false;
      break;
    default:
      return responder({ ok: true, ignorado: e.type ?? 'sin_tipo' });
  }
  const { error } = await admin.from('suscripciones').upsert(fila, { onConflict: 'user_id' });
  if (error) throw error;
  return responder({ ok: true });
}

servir('pagos-revenuecat', pagos, 'No se ha podido guardar el pago.');
