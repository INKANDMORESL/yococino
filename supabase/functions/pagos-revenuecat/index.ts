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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function iguales(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

async function pagos(req: Request): Promise<Response> {
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
