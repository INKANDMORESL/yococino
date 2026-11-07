// admin: datos y acciones del panel de gestión (admin.yococino.app). Solo para administradores (tabla admins).
// Nunca devuelve datos de salud (alergias, condiciones, peso, medidas): no hacen falta para gestionar.
import { crearClientes, fallo, hoyEspana, responder, servir, sumarDias, type Cliente } from '../_shared/http.ts';
import { cupoRecetas } from '../_shared/recetas.ts';
import { categoriasDe } from '../_shared/categorias.ts';

const EUR_POR_USD = Number(Deno.env.get('EUR_POR_USD')) || 0.9;
const eur = (usd: number) => Math.round(usd * EUR_POR_USD * 100) / 100;
const inicioMes = () => `${hoyEspana().slice(0, 8)}01T00:00:00+01:00`;

type Datos = Record<string, unknown>;

// Todas las cuentas (con email), de 1000 en 1000.
async function usuarios(admin: Cliente) {
  const lista: { id: string; email: string; created_at: string; last_sign_in_at: string | null }[] = [];
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    for (const u of data.users) lista.push({ id: u.id, email: u.email ?? '', created_at: u.created_at, last_sign_in_at: u.last_sign_in_at ?? null });
    if (data.users.length < 1000) break;
  }
  return lista;
}

// Plan de muchas personas a la vez (misma lógica que estado_plan, pero sin una consulta por persona).
async function planes(admin: Cliente, ids: string[]) {
  const hoy = hoyEspana();
  const [ajustes, pruebas, subs, admins] = await Promise.all([
    admin.from('ajustes_planes').select('*').eq('id', 1).maybeSingle(),
    admin.from('pruebas').select('user_id, inicio').in('user_id', ids),
    admin.from('suscripciones').select('user_id, activa_hasta, peques').in('user_id', ids),
    admin.from('admins').select('user_id').in('user_id', ids),
  ]);
  const activos = ajustes.data?.planes_activos ?? true;
  const dias = Number(ajustes.data?.dias_prueba) || 7;
  const inicio = new Map((pruebas.data ?? []).map((p) => [p.user_id as string, p.inicio as string]));
  const hasta = new Map((subs.data ?? []).map((s) => [s.user_id as string, s.activa_hasta as string | null]));
  const conPeques = new Set((subs.data ?? []).filter((s) => s.peques).map((s) => s.user_id as string));
  const esAdmin = new Set((admins.data ?? []).map((a) => a.user_id as string));
  const ahora = new Date().toISOString();
  return new Map(
    ids.map((id) => {
      const h = hasta.get(id);
      const i = inicio.get(id);
      const fin = i ? sumarDias(i, dias - 1) : null;
      const estado = !activos || esAdmin.has(id) || (h && h > ahora) ? 'premium' : !i ? 'sin empezar' : hoy <= (fin as string) ? 'prueba' : 'caducada';
      return [id, { estado, fin_prueba: fin, suscripcion_hasta: h ?? null, peques: conPeques.has(id), admin: esAdmin.has(id) }];
    }),
  );
}

async function gastoPorUsuario(admin: Cliente, desde: string, ids?: string[]) {
  let q = admin.from('usos_ia').select('user_id, coste_usd').gte('created_at', desde).gt('coste_usd', 0);
  if (ids) q = q.in('user_id', ids);
  const { data } = await q.limit(100000);
  const m = new Map<string, number>();
  for (const f of data ?? []) m.set(f.user_id as string, (m.get(f.user_id as string) ?? 0) + Number(f.coste_usd));
  return m;
}

const acciones: Record<string, (admin: Cliente, d: Datos, yo: string) => Promise<unknown>> = {
  async resumen(admin) {
    const hoy = hoyEspana();
    const [todos, perfiles, cupo, gastoMes, gasto30, recetas, sinResponder] = await Promise.all([
      usuarios(admin),
      admin.from('profiles').select('id, encuesta_completada_at'),
      cupoRecetas(admin),
      admin.from('usos_ia').select('coste_usd').gte('created_at', inicioMes()),
      admin.from('usos_ia').select('coste_usd').gte('created_at', new Date(Date.now() - 30 * 86_400_000).toISOString()),
      admin.from('recetas').select('id', { count: 'exact', head: true }),
      acciones.hilos(admin, {}, ''),
    ]);
    const p = await planes(admin, todos.map((u) => u.id));
    const cuenta = (e: string) => [...p.values()].filter((x) => x.estado === e).length;
    const suma = (filas: { coste_usd: unknown }[] | null) => (filas ?? []).reduce((s, f) => s + Number(f.coste_usd), 0);
    return {
      clientes: todos.length,
      nuevos_7_dias: todos.filter((u) => u.created_at.slice(0, 10) >= sumarDias(hoy, -6)).length,
      con_encuesta: (perfiles.data ?? []).filter((f) => f.encuesta_completada_at).length,
      premium: cuenta('premium'),
      en_prueba: cuenta('prueba'),
      prueba_terminada: cuenta('caducada'),
      recetas: recetas.count ?? 0,
      recetas_mes: cupo.usadas,
      cupo_mes: cupo.tope,
      gasto_mes_eur: eur(suma(gastoMes.data)),
      gasto_30_dias_eur: eur(suma(gasto30.data)),
      mensajes_sin_responder: (sinResponder as { sin_responder: boolean }[]).filter((h) => h.sin_responder).length,
    };
  },

  async clientes(admin, d) {
    const buscar = String(d.buscar ?? '').trim().toLowerCase();
    const todos = (await usuarios(admin))
      .filter((u) => !buscar || u.email.toLowerCase().includes(buscar))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 200);
    const ids = todos.map((u) => u.id);
    if (!ids.length) return [];
    const [perfiles, p, gastoMes, gastoAno] = await Promise.all([
      admin.from('profiles').select('id, nombre, encuesta_completada_at').in('id', ids),
      planes(admin, ids),
      gastoPorUsuario(admin, inicioMes(), ids),
      gastoPorUsuario(admin, new Date(Date.now() - 365 * 86_400_000).toISOString(), ids),
    ]);
    const perfil = new Map((perfiles.data ?? []).map((f) => [f.id as string, f]));
    return todos.map((u) => ({
      ...u,
      nombre: perfil.get(u.id)?.nombre ?? null,
      encuesta: !!perfil.get(u.id)?.encuesta_completada_at,
      ...p.get(u.id),
      gasto_mes_eur: eur(gastoMes.get(u.id) ?? 0),
      gasto_ano_eur: eur(gastoAno.get(u.id) ?? 0),
    }));
  },

  // Estado de la app: comprobaciones automáticas y últimos fallos (sin datos de personas).
  async salud(admin) {
    const hoy = hoyEspana();
    const hace24 = new Date(Date.now() - 86_400_000).toISOString();
    const hace26h = new Date(Date.now() - 26 * 3600_000).toISOString();
    const dentroDe25 = sumarDias(hoy, 25);
    const contar = (q: PromiseLike<{ count: number | null }>) => Promise.resolve(q).then((r) => r.count ?? 0);
    const [
      errores24,
      ultimosErrores,
      lotesAbiertos,
      lotesViejos,
      visiblesSinFoto,
      esperandoFoto,
      sinMiniatura,
      conEncuesta,
      conMenuLargo,
      ultimaWeb,
      sinResponder,
      cupo,
      gastoHoy,
    ] = await Promise.all([
      contar(admin.from('errores_servidor').select('id', { count: 'exact', head: true }).gte('created_at', hace24)),
      admin.from('errores_servidor').select('funcion, tipo, mensaje, created_at').order('created_at', { ascending: false }).limit(15),
      contar(admin.from('lotes_ia').select('id', { count: 'exact', head: true }).eq('estado', 'enviado')),
      contar(admin.from('lotes_ia').select('id', { count: 'exact', head: true }).eq('estado', 'enviado').lt('created_at', hace26h)),
      contar(admin.from('recetas').select('id', { count: 'exact', head: true }).eq('oculta', false).is('imagen', null).is('privada_de', null)),
      contar(admin.from('recetas').select('id', { count: 'exact', head: true }).eq('espera_foto', true)),
      contar(admin.from('recetas').select('id', { count: 'exact', head: true }).not('imagen', 'is', null).is('imagen_mini', null)),
      admin.from('profiles').select('id').not('encuesta_completada_at', 'is', null).limit(20000),
      Promise.resolve(null),
      admin.from('blog_recetas').select('publicada_el').order('publicada_el', { ascending: false }).limit(1).maybeSingle(),
      acciones.hilos(admin, {}, ''),
      cupoRecetas(admin),
      admin.from('usos_ia').select('coste_usd').gte('created_at', `${hoy}T00:00:00+01:00`),
    ]);
    // Menús: con suscripción, 30 días por delante (se comprueba el día +25); en la prueba gratis, solo sus 7 días
    // (se comprueba que tenga hasta el último día de la prueba). Las pruebas terminadas no cuentan.
    void conMenuLargo;
    const idsEncuesta = ((conEncuesta.data ?? []) as { id: string }[]).map((p) => p.id);
    const planesEncuesta = idsEncuesta.length ? await planes(admin, idsEncuesta) : new Map();
    const premium = idsEncuesta.filter((id) => planesEncuesta.get(id)?.estado === 'premium');
    const enPrueba = idsEncuesta.filter((id) => planesEncuesta.get(id)?.estado === 'prueba');
    const [{ data: largos }, { data: dePrueba }] = await Promise.all([
      premium.length ? admin.from('comidas').select('user_id').eq('fecha', dentroDe25).in('user_id', premium).limit(20000) : Promise.resolve({ data: [] }),
      enPrueba.length ? admin.from('comidas').select('user_id, fecha').gte('fecha', hoy).in('user_id', enPrueba).limit(20000) : Promise.resolve({ data: [] }),
    ]);
    const premiumOk = new Set(((largos ?? []) as { user_id: string }[]).map((f) => f.user_id)).size;
    const fechasPrueba = new Map<string, Set<string>>();
    for (const f of (dePrueba ?? []) as { user_id: string; fecha: string }[]) {
      if (!fechasPrueba.has(f.user_id)) fechasPrueba.set(f.user_id, new Set());
      fechasPrueba.get(f.user_id)!.add(f.fecha);
    }
    const pruebaOk = enPrueba.filter((id) => {
      const fin = planesEncuesta.get(id)?.fin_prueba as string | null;
      return fin ? fechasPrueba.get(id)?.has(fin) : (fechasPrueba.get(id)?.size ?? 0) > 0;
    }).length;
    const conMenu = premiumOk + pruebaOk;
    const aComprobar = premium.length + enPrueba.length;
    const pendientes = (sinResponder as { sin_responder: boolean }[]).filter((h) => h.sin_responder).length;
    const web = (ultimaWeb.data?.publicada_el as string | undefined) ?? null;
    const gasto = eur(((gastoHoy.data ?? []) as { coste_usd: number }[]).reduce((s, f) => s + Number(f.coste_usd), 0));
    type Nivel = 'ok' | 'aviso' | 'error';
    const c: { nombre: string; nivel: Nivel; texto: string }[] = [];
    c.push(
      Deno.env.get('ANTHROPIC_API_KEY')
        ? { nombre: 'Inteligencia artificial (recetas y menús)', nivel: 'ok', texto: 'Conectada.' }
        : { nombre: 'Inteligencia artificial (recetas y menús)', nivel: 'error', texto: 'Falta la clave ANTHROPIC_API_KEY en Supabase.' },
    );
    c.push(
      Deno.env.get('GEMINI_API_KEY')
        ? { nombre: 'Fotos de los platos', nivel: 'ok', texto: 'Conectadas.' }
        : { nombre: 'Fotos de los platos', nivel: 'error', texto: 'Falta la clave GEMINI_API_KEY en Supabase.' },
    );
    c.push({
      nombre: 'Fallos del servidor (últimas 24 h)',
      nivel: errores24 === 0 ? 'ok' : errores24 < 10 ? 'aviso' : 'error',
      texto: errores24 === 0 ? 'Ningún fallo.' : `${errores24} ${errores24 === 1 ? 'fallo' : 'fallos'}. Mira el detalle abajo.`,
    });
    c.push({
      nombre: 'Menús de los clientes',
      nivel: aComprobar === 0 || conMenu >= aComprobar * 0.9 ? 'ok' : conMenu >= aComprobar * 0.6 ? 'aviso' : 'error',
      texto:
        aComprobar === 0
          ? 'Todavía no hay clientes activos con menú.'
          : `${premiumOk} de ${premium.length} con suscripción tienen su menú de 30 días; ${pruebaOk} de ${enPrueba.length} en prueba tienen sus 7 días.`,
    });
    c.push({
      nombre: 'Fotos del recetario',
      nivel: visiblesSinFoto === 0 && sinMiniatura < 20 ? 'ok' : 'aviso',
      texto:
        visiblesSinFoto === 0 && esperandoFoto === 0 && sinMiniatura === 0
          ? 'Todas las recetas tienen su foto.'
          : `${visiblesSinFoto} visibles sin foto · ${esperandoFoto} recetas nuevas esperando su foto · ${sinMiniatura} fotos por aligerar.`,
    });
    c.push({
      nombre: 'Lotes de recetas y fotos',
      nivel: lotesViejos === 0 ? 'ok' : 'aviso',
      texto: lotesViejos ? `${lotesViejos} lotes llevan más de 26 h sin terminar (se rehacen solos).` : lotesAbiertos ? `${lotesAbiertos} en marcha.` : 'Ninguno en marcha.',
    });
    c.push({
      nombre: 'Receta del día en la web',
      nivel: web === hoy ? 'ok' : web && web >= sumarDias(hoy, -1) ? 'aviso' : 'error',
      texto: web ? (web === hoy ? 'Publicada hoy.' : `La última es del ${web}.`) : 'Aún no hay ninguna.',
    });
    c.push({ nombre: 'Mensajes de clientes', nivel: pendientes ? 'aviso' : 'ok', texto: pendientes ? `${pendientes} por responder.` : 'Todo respondido.' });
    c.push({
      nombre: 'Cupo de recetas nuevas del mes',
      nivel: cupo.quedan > cupo.tope * 0.1 ? 'ok' : 'aviso',
      texto: `${cupo.usadas} de ${cupo.tope} usadas (quedan ${cupo.quedan}).`,
    });
    c.push({ nombre: 'Gasto en IA hoy', nivel: 'ok', texto: `${gasto.toFixed(2).replace('.', ',')} €` });
    const general: Nivel = c.some((x) => x.nivel === 'error') ? 'error' : c.some((x) => x.nivel === 'aviso') ? 'aviso' : 'ok';
    return { general, comprobaciones: c, errores: ultimosErrores.data ?? [] };
  },

  // Dar o quitar la suscripción a mano (hasta que se conecten los pagos de las tiendas).
  async suscripcion(admin, d) {
    const id = String(d.user_id ?? '');
    const hasta = d.hasta ? String(d.hasta) : null;
    if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error('Cliente no válido');
    if (hasta && !/^\d{4}-\d{2}-\d{2}$/.test(hasta)) throw new Error('Fecha no válida');
    const { error } = await admin
      .from('suscripciones')
      // producto «regalo»: así la sincronización con RevenueCat no la borra (no hay compra en la tienda).
      .upsert({ user_id: id, plan_anual: !!hasta, peques: !!d.peques, producto: hasta ? 'regalo' : null, activa_hasta: hasta ? `${hasta}T23:59:59+01:00` : null, updated_at: new Date().toISOString() });
    if (error) throw error;
    return { ok: true };
  },

  // Deja a un cliente con la prueba gratis terminada y sin suscripción (por ejemplo, la cuenta de revisión
  // de Apple «con la suscripción caducada», para que vean el flujo de compra).
  async terminarPrueba(admin, d) {
    const id = String(d.user_id ?? '');
    if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error('Cliente no válido');
    const { data: esAdmin } = await admin.from('admins').select('user_id').eq('user_id', id).maybeSingle();
    if (esAdmin) throw new Error('Los administradores siempre tienen premium: usa otra cuenta.');
    const hace = new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10);
    const { error } = await admin.from('pruebas').upsert({ user_id: id, inicio: hace });
    if (error) throw error;
    const { error: e2 } = await admin.from('suscripciones').update({ activa_hasta: new Date(Date.now() - 86400000).toISOString(), updated_at: new Date().toISOString() }).eq('user_id', id);
    if (e2) throw e2;
    return { ok: true };
  },

  // Personas que han dado permiso para recibir novedades y promociones (para enviarles emails o pasarlas a Mailchimp).
  async promociones(admin) {
    const { data, error } = await admin
      .from('profiles')
      .select('id, nombre, promociones_at')
      .eq('promociones', true)
      .order('promociones_at', { ascending: false })
      .limit(20000);
    if (error) throw error;
    const emails = new Map((await usuarios(admin)).map((u) => [u.id, u.email]));
    const { count: bajas } = await admin.from('profiles').select('id', { count: 'exact', head: true }).eq('promociones', false).not('promociones_baja_at', 'is', null);
    return {
      bajas: bajas ?? 0,
      lista: (data ?? []).map((p) => ({ email: emails.get(p.id as string) ?? '', nombre: p.nombre ?? '', desde: p.promociones_at })).filter((p) => p.email),
    };
  },

  // Facturación: suscripciones de pago activas, ingreso mensual estimado y avisos de RevenueCat (compras,
  // renovaciones, cancelaciones, reembolsos) por mes. Las de prueba (sandbox) y las regaladas no cuentan.
  async facturacion(admin) {
    const PRECIOS: [RegExp, number, boolean][] = [
      [/pequesyear/, 49.99, true],
      [/pequesmes/, 6.99, false],
      [/premiumyear/, 39.99, true],
      [/premiummes/, 5.99, false],
    ];
    const catalogo = (producto: string | null) => {
      const p = PRECIOS.find(([re]) => re.test(producto ?? ''));
      return p ? { precio: p[1], anual: p[2] } : null;
    };
    const ahora = new Date().toISOString();
    const [{ data: subs }, { data: eventos }] = await Promise.all([
      admin.from('suscripciones').select('user_id, producto, tienda, entorno, peques, plan_anual, activa_hasta, cancelada').gt('activa_hasta', ahora).limit(20000),
      admin.from('pagos_eventos').select('id, user_id, tipo, producto, tienda, entorno, precio, moneda, neto_pct, motivo, momento').gte('momento', new Date(Date.now() - 400 * 86400000).toISOString()).order('momento', { ascending: false }).limit(20000),
    ]);
    const activas = { mensual: 0, anual: 0, peques: 0, regaladas: 0, prueba: 0, cancelan: 0, apple: 0, google: 0 };
    let mrr = 0;
    for (const s of subs ?? []) {
      if (s.producto === 'regalo' || !s.producto) { activas.regaladas++; continue; }
      if (s.entorno === 'SANDBOX') { activas.prueba++; continue; }
      const c = catalogo(s.producto as string);
      if (c?.anual || s.plan_anual) activas.anual++;
      else activas.mensual++;
      if (s.peques) activas.peques++;
      if (s.cancelada) activas.cancelan++;
      if (s.tienda === 'app_store') activas.apple++;
      else activas.google++;
      if (c && !s.cancelada) mrr += c.anual ? c.precio / 12 : c.precio;
    }
    const COBROS = new Set(['INITIAL_PURCHASE', 'RENEWAL', 'PRODUCT_CHANGE', 'NON_RENEWING_PURCHASE']);
    const meses = new Map<string, { mes: string; bruto: number; neto: number; nuevas: number; renovaciones: number; cancelaciones: number; caducadas: number; reembolsos: number }>();
    const delMes = (iso: string) => {
      const mes = iso.slice(0, 7);
      if (!meses.has(mes)) meses.set(mes, { mes, bruto: 0, neto: 0, nuevas: 0, renovaciones: 0, cancelaciones: 0, caducadas: 0, reembolsos: 0 });
      return meses.get(mes)!;
    };
    const reales = (eventos ?? []).filter((e) => e.entorno !== 'SANDBOX');
    for (const e of reales) {
      const m = delMes(String(e.momento));
      const precio = Number(e.precio ?? 0);
      if (COBROS.has(String(e.tipo)) || precio < 0) {
        m.bruto += precio;
        // Si RevenueCat no da la parte neta: 15 % de la tienda y el IVA (21 %) incluido en el precio.
        m.neto += precio * (e.neto_pct != null ? Number(e.neto_pct) : 0.85 / 1.21);
      }
      if (e.tipo === 'INITIAL_PURCHASE') m.nuevas++;
      if (e.tipo === 'RENEWAL') m.renovaciones++;
      if (e.tipo === 'CANCELLATION') m.cancelaciones++;
      if (e.tipo === 'EXPIRATION') m.caducadas++;
      if (precio < 0 || e.motivo === 'CUSTOMER_SUPPORT') m.reembolsos++;
    }
    const emails = new Map((await usuarios(admin)).map((u) => [u.id, u.email]));
    return {
      activas,
      ingreso_mensual: Math.round(mrr * 100) / 100,
      meses: [...meses.values()].sort((a, b) => b.mes.localeCompare(a.mes)).slice(0, 12).map((m) => ({ ...m, bruto: Math.round(m.bruto * 100) / 100, neto: Math.round(m.neto * 100) / 100 })),
      ultimos: (eventos ?? []).slice(0, 40).map((e) => ({ ...e, email: emails.get(e.user_id as string) ?? '' })),
      desde: (eventos ?? []).length ? (eventos ?? [])[(eventos ?? []).length - 1].momento : null,
    };
  },

  async suscripciones(admin) {
    const { data } = await admin.from('suscripciones').select('user_id, plan_anual, peques, activa_hasta, updated_at').order('updated_at', { ascending: false }).limit(500);
    const emails = new Map((await usuarios(admin)).map((u) => [u.id, u.email]));
    return (data ?? []).map((s) => ({ ...s, email: emails.get(s.user_id as string) ?? '' }));
  },

  // Todas las recetas (de 1.000 en 1.000), con filtros por toma, ingrediente principal (carne, pescado…)
  // y estado, y paginadas de 100 en 100. Las privadas de clientes (cambios de ingrediente, redes) solo con su filtro.
  async recetas(admin, d) {
    interface FilaReceta {
      id: number;
      nombre: string;
      tipo_comida: string;
      oculta: boolean;
      dulce: boolean;
      solo_especial: boolean;
      privada_de: string | null;
      aparatos: string[] | null;
      nota_airfryer: string | null;
      ingredientes: { nombre: string }[] | null;
      [otro: string]: unknown;
    }
    const filas: FilaReceta[] = [];
    for (let desde = 0; desde < 50000; desde += 1000) {
      const { data, error } = await admin
        .from('recetas')
        .select('id, nombre, tipo_comida, nivel, kcal, imagen_mini, imagen, oculta, created_at, dulce, solo_especial, privada_de, espera_foto, aparatos, nota_airfryer, ingredientes(nombre)')
        .order('created_at', { ascending: false })
        .range(desde, desde + 999);
      if (error) throw error;
      filas.push(...((data ?? []) as unknown as FilaReceta[]));
      if (!data || data.length < 1000) break;
    }
    const sinTildes = (t: string) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const palabras = sinTildes(String(d.buscar ?? '').trim()).split(/\s+/).filter(Boolean);
    const estado = String(d.estado ?? 'visibles');
    const conCat = filas.map((r) => ({ ...r, categorias: categoriasDe(r).categorias as string[] }));
    const deEstado = conCat.filter((r) => {
      if (estado === 'privadas') return !!r.privada_de;
      if (r.privada_de) return false;
      if (estado === 'todas') return true;
      if (estado === 'ocultas') return !!r.oculta;
      if (estado === 'dulces') return !!r.dulce && !r.oculta;
      if (estado === 'especiales') return !!r.solo_especial && !r.oculta;
      return !r.oculta; // visibles
    });
    const porTexto = deEstado.filter((r) => {
      if (!palabras.length) return true;
      const t = sinTildes(`${r.nombre} ${(r.ingredientes ?? []).map((i) => i.nombre).join(' ')}`);
      return palabras.every((p) => t.includes(p));
    });
    // Recuentos para los botones de filtro (con el estado y la búsqueda ya aplicados).
    const cuentaTipo: Record<string, number> = {};
    const cuentaCat: Record<string, number> = {};
    const tipo = d.tipo ? String(d.tipo) : '';
    const cat = d.categoria ? String(d.categoria) : '';
    for (const r of porTexto) {
      if (!cat || r.categorias.includes(cat)) cuentaTipo[r.tipo_comida] = (cuentaTipo[r.tipo_comida] ?? 0) + 1;
      if (!tipo || r.tipo_comida === tipo) for (const c of r.categorias) cuentaCat[c] = (cuentaCat[c] ?? 0) + 1;
    }
    const lista = porTexto.filter((r) => (!tipo || r.tipo_comida === tipo) && (!cat || r.categorias.includes(cat)));
    // Panel antiguo guardado en la caché del navegador (no manda «estado»): espera una lista simple.
    if (d.estado === undefined) return lista.slice(0, 300).map(({ ingredientes: _i, aparatos: _a, nota_airfryer: _n, ...r }) => r);
    const porPagina = 100;
    const paginas = Math.max(1, Math.ceil(lista.length / porPagina));
    const pagina = Math.min(paginas, Math.max(1, Number(d.pagina) || 1));
    return {
      total: lista.length,
      todas: filas.filter((r) => !r.privada_de).length,
      pagina,
      paginas,
      cuentaTipo,
      cuentaCat,
      recetas: lista.slice((pagina - 1) * porPagina, pagina * porPagina).map(({ ingredientes: _i, aparatos: _a, nota_airfryer: _n, privada_de, ...r }) => ({ ...r, privada: !!privada_de })),
    };
  },

  async receta(admin, d) {
    const { data, error } = await admin.from('recetas').select('*, ingredientes(*)').eq('id', Number(d.id)).maybeSingle();
    if (error) throw error;
    const { count } = await admin.from('comidas').select('id', { count: 'exact', head: true }).eq('receta_id', Number(d.id));
    return { ...data, usos: count ?? 0 };
  },

  async ocultar_receta(admin, d) {
    const { error } = await admin.from('recetas').update({ oculta: !!d.oculta }).eq('id', Number(d.id));
    if (error) throw error;
    return { ok: true };
  },

  async gastos(admin) {
    const desde = new Date(Date.now() - 183 * 86_400_000).toISOString();
    const { data } = await admin.from('usos_ia').select('user_id, tipo, coste_usd, created_at').gte('created_at', desde).gt('coste_usd', 0).limit(100000);
    const porMes = new Map<string, Record<string, number>>();
    for (const f of data ?? []) {
      const mes = String(f.created_at).slice(0, 7);
      const fila = porMes.get(mes) ?? {};
      fila[f.tipo as string] = (fila[f.tipo as string] ?? 0) + Number(f.coste_usd);
      porMes.set(mes, fila);
    }
    const meses = [...porMes.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([mes, tipos]) => ({ mes, total_eur: eur(Object.values(tipos).reduce((s, v) => s + v, 0)), por_tipo: Object.fromEntries(Object.entries(tipos).map(([t, v]) => [t, eur(v)])) }));
    const mesActual = await gastoPorUsuario(admin, inicioMes());
    const emails = new Map((await usuarios(admin)).map((u) => [u.id, u.email]));
    const top = [...mesActual.entries()]
      .sort(([, a], [, b]) => b - a)
      .slice(0, 15)
      .map(([id, v]) => ({ user_id: id, email: emails.get(id) ?? '', gasto_mes_eur: eur(v) }));
    return { meses, top };
  },

  async ajustes(admin) {
    const [planesA, recetasA, nutricion] = await Promise.all([
      admin.from('ajustes_planes').select('*').eq('id', 1).maybeSingle(),
      admin.from('ajustes_recetas').select('*').eq('id', 1).maybeSingle(),
      admin.from('ajustes_nutricion').select('*').maybeSingle(),
    ]);
    return { planes: planesA.data, recetas: recetasA.data, nutricion: nutricion.data };
  },

  async guardar_ajustes(admin, d) {
    const p = (d.planes ?? {}) as Datos;
    const r = (d.recetas ?? {}) as Datos;
    const entero = (v: unknown, min: number, max: number) => {
      const n = Math.round(Number(v));
      if (!Number.isFinite(n) || n < min || n > max) throw new Error(`Valor fuera de rango (${min}-${max})`);
      return n;
    };
    if (Object.keys(p).length) {
      const { error } = await admin
        .from('ajustes_planes')
        .update({
          planes_activos: !!p.planes_activos,
          dias_prueba: entero(p.dias_prueba, 1, 60),
          presupuesto_prueba_eur: Math.max(0, Math.min(5, Number(p.presupuesto_prueba_eur) || 0)),
        })
        .eq('id', 1);
      if (error) throw error;
    }
    if (Object.keys(r).length) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(r.fecha_inicio))) throw new Error('Fecha no válida');
      const { error } = await admin
        .from('ajustes_recetas')
        .update({
          fecha_inicio: r.fecha_inicio,
          tope_inicial: entero(r.tope_inicial, 0, 5000),
          meses_iniciales: entero(r.meses_iniciales, 0, 60),
          tope_despues: entero(r.tope_despues, 0, 5000),
        })
        .eq('id', 1);
      if (error) throw error;
    }
    return { ok: true };
  },

  // Conversaciones con clientes: la última de cada uno y si espera respuesta.
  async hilos(admin) {
    const { data } = await admin.from('mensajes').select('user_id, de, texto, created_at, leido_at').order('created_at', { ascending: false }).limit(3000);
    const porUsuario = new Map<string, { user_id: string; ultimo: string; texto: string; de: string; sin_leer: number }>();
    for (const m of data ?? []) {
      const id = m.user_id as string;
      const h = porUsuario.get(id) ?? { user_id: id, ultimo: m.created_at as string, texto: m.texto as string, de: m.de as string, sin_leer: 0 };
      if (m.de === 'cliente' && !m.leido_at) h.sin_leer++;
      porUsuario.set(id, h);
    }
    if (!porUsuario.size) return [];
    const emails = new Map((await usuarios(admin)).map((u) => [u.id, u.email]));
    return [...porUsuario.values()].map((h) => ({ ...h, email: emails.get(h.user_id) ?? '', sin_responder: h.de === 'cliente' }));
  },

  async hilo(admin, d) {
    const id = String(d.user_id ?? '');
    const { data, error } = await admin.from('mensajes').select('id, de, texto, created_at, leido_at').eq('user_id', id).order('created_at').limit(500);
    if (error) throw error;
    await admin.from('mensajes').update({ leido_at: new Date().toISOString() }).eq('user_id', id).eq('de', 'cliente').is('leido_at', null);
    return data ?? [];
  },

  async responder(admin, d) {
    const id = String(d.user_id ?? '');
    const texto = String(d.texto ?? '').trim().slice(0, 2000);
    if (!/^[0-9a-f-]{36}$/.test(id) || !texto) throw new Error('Faltan datos');
    const { error } = await admin.from('mensajes').insert({ user_id: id, de: 'equipo', texto });
    if (error) throw error;
    return { ok: true };
  },
};

async function manejar(req: Request): Promise<Response> {
  const { usuario, admin } = crearClientes(req);
  const { data: auth } = await usuario.auth.getUser();
  const user = auth?.user;
  if (!user) return fallo(401, 'no_autenticado', 'Vuelve a entrar.');
  const { data: esAdmin } = await admin.from('admins').select('user_id').eq('user_id', user.id).maybeSingle();
  if (!esAdmin) return fallo(403, 'no_admin', 'Esta cuenta no tiene acceso al panel.');

  const cuerpo = (await req.json().catch(() => ({}))) as { accion?: string } & Datos;
  const accion = acciones[String(cuerpo.accion)];
  if (!accion) return fallo(400, 'accion', 'Acción desconocida.');
  try {
    return responder({ ok: true, datos: await accion(admin, cuerpo, user.id) });
  } catch (e) {
    return fallo(400, 'datos', e instanceof Error ? e.message : 'No se ha podido hacer.');
  }
}

servir('admin', manejar, 'No se ha podido completar la acción del panel.');
