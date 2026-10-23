// admin: datos y acciones del panel de gestión (admin.yococino.app). Solo para administradores (tabla admins).
// Nunca devuelve datos de salud (alergias, condiciones, peso, medidas): no hacen falta para gestionar.
import { crearClientes, fallo, hoyEspana, responder, servir, sumarDias, type Cliente } from '../_shared/http.ts';
import { cupoRecetas } from '../_shared/recetas.ts';

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
    admin.from('suscripciones').select('user_id, activa_hasta').in('user_id', ids),
    admin.from('admins').select('user_id').in('user_id', ids),
  ]);
  const activos = ajustes.data?.planes_activos ?? true;
  const dias = Number(ajustes.data?.dias_prueba) || 7;
  const inicio = new Map((pruebas.data ?? []).map((p) => [p.user_id as string, p.inicio as string]));
  const hasta = new Map((subs.data ?? []).map((s) => [s.user_id as string, s.activa_hasta as string | null]));
  const esAdmin = new Set((admins.data ?? []).map((a) => a.user_id as string));
  const ahora = new Date().toISOString();
  return new Map(
    ids.map((id) => {
      const h = hasta.get(id);
      const i = inicio.get(id);
      const fin = i ? sumarDias(i, dias - 1) : null;
      const estado = !activos || esAdmin.has(id) || (h && h > ahora) ? 'premium' : !i ? 'sin empezar' : hoy <= (fin as string) ? 'prueba' : 'caducada';
      return [id, { estado, fin_prueba: fin, suscripcion_hasta: h ?? null, admin: esAdmin.has(id) }];
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

  // Dar o quitar la suscripción a mano (hasta que se conecten los pagos de las tiendas).
  async suscripcion(admin, d) {
    const id = String(d.user_id ?? '');
    const hasta = d.hasta ? String(d.hasta) : null;
    if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error('Cliente no válido');
    if (hasta && !/^\d{4}-\d{2}-\d{2}$/.test(hasta)) throw new Error('Fecha no válida');
    const { error } = await admin
      .from('suscripciones')
      .upsert({ user_id: id, plan_anual: !!hasta, peques: !!d.peques, activa_hasta: hasta ? `${hasta}T23:59:59+01:00` : null, updated_at: new Date().toISOString() });
    if (error) throw error;
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

  async suscripciones(admin) {
    const { data } = await admin.from('suscripciones').select('user_id, plan_anual, peques, activa_hasta, updated_at').order('updated_at', { ascending: false }).limit(500);
    const emails = new Map((await usuarios(admin)).map((u) => [u.id, u.email]));
    return (data ?? []).map((s) => ({ ...s, email: emails.get(s.user_id as string) ?? '' }));
  },

  async recetas(admin, d) {
    const buscar = String(d.buscar ?? '').trim();
    let q = admin.from('recetas').select('id, nombre, tipo_comida, nivel, kcal, imagen_mini, imagen, oculta, created_at, modelo');
    if (buscar) q = q.ilike('nombre', `%${buscar.replace(/[%_]/g, '')}%`);
    if (d.tipo) q = q.eq('tipo_comida', String(d.tipo));
    const { data, error } = await q.order('created_at', { ascending: false }).limit(300);
    if (error) throw error;
    return data ?? [];
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
