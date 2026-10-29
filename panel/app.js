// Panel de gestión de Yococino. Habla con la función "admin" de Supabase, que solo responde a administradores.
// Todo lo que viene de clientes (emails, nombres, mensajes) se escapa antes de mostrarlo.
(function () {
  'use strict';

  const cfg = window.YOCOCINO || {};
  const app = document.getElementById('app');
  if (!cfg.url || !cfg.clave || !window.supabase) {
    app.innerHTML = '<div class="cargando">Falta la configuración del panel (se añade al publicarlo desde GitHub).</div>';
    return;
  }
  const sb = window.supabase.createClient(cfg.url, cfg.clave, { auth: { persistSession: true, storageKey: 'yococino-panel' } });

  // ---------- Utilidades ----------
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const euros = (n) => `${Number(n || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
  const fecha = (iso) => (iso ? new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
  const fechaHora = (iso) => (iso ? new Date(iso).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
  const TIPOS = { desayuno: 'Desayuno', media_manana: 'Media mañana', almuerzo: 'Comida', merienda: 'Merienda', cena: 'Cena', otro: 'Otra' };
  const ESTADOS = { premium: ['Premium', 'e-premium'], prueba: ['En prueba', 'e-prueba'], caducada: ['Prueba terminada', 'e-caducada'], 'sin empezar': ['Sin empezar', 'e-gris'] };
  const estado = (e) => {
    const [t, c] = ESTADOS[e] || [e || '—', 'e-gris'];
    return `<span class="etiqueta ${c}">${esc(t)}</span>`;
  };

  async function pedir(accion, datos = {}) {
    const { data, error } = await sb.functions.invoke('admin', { body: { accion, ...datos } });
    if (error) {
      let mensaje = 'No se ha podido completar.';
      try {
        mensaje = (await error.context.json()).mensaje || mensaje;
      } catch (_) { /* sin cuerpo */ }
      throw new Error(mensaje);
    }
    return data.datos;
  }

  // ---------- Entrar ----------
  function pantallaEntrar(error) {
    app.innerHTML = `
      <div class="entrar"><form id="f-entrar">
        <img src="logo.png" alt="Yococino">
        <h1 style="text-align:center">Gestión</h1>
        <p class="sub" style="text-align:center;margin:0">Entra con tu cuenta de administrador.</p>
        <input type="email" name="email" placeholder="Email" autocomplete="username" required>
        <input type="password" name="contrasena" placeholder="Contraseña" autocomplete="current-password" required>
        ${error ? `<div class="aviso error">${esc(error)}</div>` : ''}
        <button class="boton" type="submit">Entrar</button>
      </form></div>`;
    document.getElementById('f-entrar').onsubmit = async (ev) => {
      ev.preventDefault();
      const f = new FormData(ev.target);
      const { error: e } = await sb.auth.signInWithPassword({ email: String(f.get('email')).trim(), password: String(f.get('contrasena')) });
      if (e) return pantallaEntrar('Email o contraseña incorrectos.');
      iniciar();
    };
  }

  // ---------- Estructura ----------
  const SECCIONES = [
    ['resumen', 'Resumen'],
    ['estado', 'Estado de la app'],
    ['clientes', 'Clientes'],
    ['mensajes', 'Mensajes'],
    ['suscripciones', 'Suscripciones'],
    ['promociones', 'Promociones'],
    ['facturacion', 'Facturación'],
    ['recetas', 'Recetas'],
    ['gastos', 'Gastos de IA'],
    ['ajustes', 'Ajustes'],
  ];
  let sinResponder = 0;

  function marco(actual, contenido) {
    app.innerHTML = `
      <div class="marco">
        <nav class="lateral">
          <div class="marca"><img src="logo.png" alt=""><div><b>Yococino</b><small>Gestión</small></div></div>
          ${SECCIONES.map(([k, t]) => `<a href="#${k}" class="${k === actual ? 'on' : ''}">${t}${k === 'mensajes' && sinResponder ? `<span class="globo">${sinResponder}</span>` : ''}</a>`).join('')}
          <a href="#" class="salir" id="salir">Cerrar sesión</a>
        </nav>
        <main class="principal" id="principal">${contenido}</main>
      </div>`;
    document.getElementById('salir').onclick = async (ev) => {
      ev.preventDefault();
      await sb.auth.signOut();
      pantallaEntrar();
    };
  }

  const cargando = (actual) => marco(actual, '<div class="cargando">Cargando…</div>');
  const fallo = (actual, e) => marco(actual, `<div class="aviso error">${esc(e.message || e)}</div>`);

  // ---------- Secciones ----------
  const V = {};

  V.resumen = async () => {
    const r = await pedir('resumen');
    sinResponder = r.mensajes_sin_responder;
    const pct = r.cupo_mes ? Math.min(100, Math.round((r.recetas_mes / r.cupo_mes) * 100)) : 0;
    const salud = await pedir('salud').catch(() => null);
    marco('resumen', `
      <h1>Resumen</h1><p class="sub">Cómo va Yococino hoy.</p>
      ${salud ? `<a href="#estado" class="salud ${salud.general}"><span>${ICONO[salud.general]}</span><b>${TITULO[salud.general]}</b><span class="muted">Ver el estado de la app →</span></a>` : ''}
      <div class="tarjetas">
        <div class="tarjeta"><div class="num">${r.clientes}</div><div class="eti">Cuentas creadas</div></div>
        <div class="tarjeta"><div class="num">${r.nuevos_7_dias}</div><div class="eti">Nuevas en 7 días</div></div>
        <div class="tarjeta verde"><div class="num">${r.premium}</div><div class="eti">Premium</div></div>
        <div class="tarjeta limon"><div class="num">${r.en_prueba}</div><div class="eti">En prueba gratis</div></div>
        <div class="tarjeta"><div class="num">${r.prueba_terminada}</div><div class="eti">Prueba terminada sin pagar</div></div>
        <div class="tarjeta"><div class="num">${r.mensajes_sin_responder}</div><div class="eti">Mensajes por responder</div></div>
      </div>
      <h2>Recetas y gasto</h2>
      <div class="tarjetas">
        <div class="tarjeta"><div class="num">${r.recetas}</div><div class="eti">Recetas en el recetario</div></div>
        <div class="tarjeta"><div class="num">${r.recetas_mes} <span class="muted" style="font-size:18px">/ ${r.cupo_mes}</span></div><div class="eti">Recetas nuevas este mes (límite)</div><div class="barra"><i style="width:${pct}%"></i></div></div>
        <div class="tarjeta"><div class="num">${euros(r.gasto_mes_eur)}</div><div class="eti">Gasto en IA este mes</div></div>
        <div class="tarjeta"><div class="num">${euros(r.gasto_30_dias_eur)}</div><div class="eti">Gasto en IA últimos 30 días</div></div>
      </div>`);
  };

  const ICONO = { ok: '🟢', aviso: '🟡', error: '🔴' };
  const TITULO = { ok: 'Todo funciona bien', aviso: 'Funciona, con algún aviso', error: 'Hay algo que no funciona' };
  V.estado = async () => {
    const s = await pedir('salud');
    marco('estado', `
      <div class="fila entre"><div><h1>Estado de la app</h1><p class="sub">Se comprueba solo cada vez que abres esta página.</p></div>
      <button class="boton suave" id="refrescar">Comprobar otra vez</button></div>
      <div class="salud ${s.general}"><span>${ICONO[s.general]}</span><b>${TITULO[s.general]}</b></div>
      <table><thead><tr><th></th><th>Qué</th><th>Cómo está</th></tr></thead><tbody>
      ${s.comprobaciones.map((c) => `<tr><td style="width:36px">${ICONO[c.nivel]}</td><td><b>${esc(c.nombre)}</b></td><td>${esc(c.texto)}</td></tr>`).join('')}
      </tbody></table>
      <h2>Últimos fallos</h2>
      ${
        s.errores.length
          ? `<table><thead><tr><th>Cuándo</th><th>Dónde</th><th>Qué pasó</th></tr></thead><tbody>${s.errores
              .map((e) => `<tr><td>${fechaHora(e.created_at)}</td><td>${esc(e.funcion)} <span class="etiqueta e-gris">${esc(e.tipo)}</span></td><td class="peq">${esc(e.mensaje)}</td></tr>`)
              .join('')}</tbody></table><p class="peq muted">Son mensajes técnicos, sin datos de clientes. Si ves muchos iguales, pásaselos a Claude.</p>`
          : '<p class="muted">No hay fallos registrados. 🎉</p>'
      }`);
    document.getElementById('refrescar').onclick = () => cargarSeccion('estado');
  };

  V.clientes = async (buscar = '') => {
    const lista = await pedir('clientes', { buscar });
    marco('clientes', `
      <div class="fila entre"><div><h1>Clientes</h1><p class="sub">${lista.length} ${lista.length === 1 ? 'cuenta' : 'cuentas'}${buscar ? ' encontradas' : ' (las 200 más recientes)'}.</p></div>
      <form id="f-buscar" class="fila"><input type="search" name="q" placeholder="Buscar por email" value="${esc(buscar)}"><button class="boton suave">Buscar</button></form></div>
      <table><thead><tr><th>Email</th><th>Nombre</th><th>Plan</th><th>Alta</th><th>Gasto IA (mes / año)</th><th>Último acceso</th></tr></thead><tbody>
      ${lista.map((c) => `<tr class="clic" data-id="${esc(c.id)}"><td>${esc(c.email)}${c.admin ? ' <span class="etiqueta e-gris">admin</span>' : ''}</td><td>${esc(c.nombre || '—')}</td><td>${estado(c.estado)}${c.estado === 'prueba' ? `<div class="peq muted">hasta ${fecha(c.fin_prueba)}</div>` : ''}</td><td>${fecha(c.created_at)}</td><td>${euros(c.gasto_mes_eur)} / ${euros(c.gasto_ano_eur)}</td><td>${fecha(c.last_sign_in_at)}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">Sin resultados.</td></tr>'}
      </tbody></table>`);
    document.getElementById('f-buscar').onsubmit = (ev) => {
      ev.preventDefault();
      cargarSeccion('clientes', new FormData(ev.target).get('q'));
    };
    document.querySelectorAll('tr[data-id]').forEach((tr) => (tr.onclick = () => fichaCliente(lista.find((c) => c.id === tr.dataset.id))));
  };

  V.promociones = async () => {
    const r = await pedir('promociones');
    const lista = r.lista;
    marco('promociones', `
      <div class="fila entre"><div><h1>Promociones</h1><p class="sub">${lista.length} ${lista.length === 1 ? 'persona ha aceptado' : 'personas han aceptado'} recibir novedades y promociones por email${r.bajas ? ` · ${r.bajas} se han dado de baja` : ''}.</p></div>
      <div class="fila"><button class="boton suave" id="copiar">Copiar emails</button><button class="boton" id="csv">Descargar para Mailchimp (CSV)</button></div></div>
      <div id="res-promo"></div>
      <p class="peq muted">Solo aparecen quienes lo han marcado. Si alguien se da de baja desde la app, desaparece de esta lista al momento: descarga la lista justo antes de cada envío.</p>
      <table><thead><tr><th>Email</th><th>Nombre</th><th>Aceptó el</th></tr></thead><tbody>
      ${lista.map((p) => `<tr><td>${esc(p.email)}</td><td>${esc(p.nombre || '—')}</td><td>${fecha(p.desde)}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">Todavía nadie.</td></tr>'}
      </tbody></table>`);
    const res = document.getElementById('res-promo');
    document.getElementById('copiar').onclick = async () => {
      try {
        await navigator.clipboard.writeText(lista.map((p) => p.email).join(', '));
        res.innerHTML = '<div class="aviso ok">Emails copiados.</div>';
      } catch {
        res.innerHTML = '<div class="aviso error">No se han podido copiar. Usa la descarga.</div>';
      }
    };
    document.getElementById('csv').onclick = () => {
      const celda = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const filas = [['Email Address', 'First Name', 'Fecha consentimiento'], ...lista.map((p) => [p.email, p.nombre, p.desde ? String(p.desde).slice(0, 10) : ''])];
      const blob = new Blob(['\ufeff' + filas.map((f) => f.map(celda).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `yococino-promociones-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    };
  };

  function fichaCliente(c) {
    const velo = document.createElement('div');
    velo.className = 'velo';
    const hoy = new Date();
    const enUnAno = new Date(hoy.getFullYear() + 1, hoy.getMonth(), hoy.getDate()).toISOString().slice(0, 10);
    velo.innerHTML = `<div class="ficha">
      <div class="fila entre"><h1 style="font-size:22px">${esc(c.nombre || c.email)}</h1><button class="boton linea" id="cerrar">Cerrar</button></div>
      <dl class="datos">
        <dt>Email</dt><dd>${esc(c.email)}</dd>
        <dt>Alta</dt><dd>${fecha(c.created_at)}</dd>
        <dt>Último acceso</dt><dd>${fecha(c.last_sign_in_at)}</dd>
        <dt>Encuesta</dt><dd>${c.encuesta ? 'Hecha' : 'Pendiente'}</dd>
        <dt>Plan</dt><dd>${estado(c.estado)}</dd>
        <dt>Fin de la prueba</dt><dd>${fecha(c.fin_prueba)}</dd>
        <dt>Suscripción hasta</dt><dd>${fecha(c.suscripcion_hasta)}</dd>
        <dt>Gasto IA este mes</dt><dd>${euros(c.gasto_mes_eur)}</dd>
        <dt>Gasto IA en el año</dt><dd>${euros(c.gasto_ano_eur)} de 9,00 €</dd>
      </dl>
      <h2>Regalar o cambiar la suscripción</h2>
      <p class="muted peq">Para un amigo, un probador o alguien que te paga por otro medio. No pasa por las tiendas ni se le cobra nada.</p>
      <div class="fila" style="margin-bottom:10px">
        <button class="boton suave" data-regalo="1">Regalar 1 año</button>
        <button class="boton suave" data-regalo="5">5 años</button>
        <button class="boton suave" data-regalo="siempre">Para siempre</button>
      </div>
      <div class="fila"><label class="peq">O hasta el día <input type="date" id="hasta" value="${esc((c.suscripcion_hasta || '').slice(0, 10) || enUnAno)}"></label>
        <label class="peq" style="display:inline-flex;align-items:center;gap:8px;cursor:pointer"><input type="checkbox" id="peques" style="width:20px;height:20px;margin:0;flex:none"${c.peques ? ' checked' : ''}> Con Peques</label>
        <button class="boton" id="dar">Guardar</button>
        <button class="boton peligro" id="quitar">Quitar</button></div>
      <div id="resultado"></div>
      <h2>Mensajes</h2>
      <button class="boton suave" id="ver-mensajes">Abrir conversación</button>
      <p class="muted peq" style="margin-top:20px">Por privacidad, el panel no muestra datos de salud (alergias, condiciones, peso o medidas).</p>
    </div>`;
    document.body.appendChild(velo);
    const cerrar = () => velo.remove();
    velo.onclick = (ev) => ev.target === velo && cerrar();
    velo.querySelector('#cerrar').onclick = cerrar;
    const guardar = async (hasta) => {
      const r = velo.querySelector('#resultado');
      try {
        await pedir('suscripcion', { user_id: c.id, hasta, peques: velo.querySelector('#peques').checked });
        r.innerHTML = `<div class="aviso ok">${hasta ? (hasta.startsWith('2099') ? 'Suscripción regalada para siempre.' : `Suscripción activa hasta el ${fecha(hasta)}.`) : 'Suscripción quitada.'}</div>`;
      } catch (e) {
        r.innerHTML = `<div class="aviso error">${esc(e.message)}</div>`;
      }
    };
    velo.querySelector('#dar').onclick = () => guardar(velo.querySelector('#hasta').value);
    velo.querySelectorAll('[data-regalo]').forEach((b) => (b.onclick = () => {
      const v = b.dataset.regalo;
      const d = new Date();
      const hasta = v === 'siempre' ? '2099-12-31' : new Date(d.getFullYear() + Number(v), d.getMonth(), d.getDate()).toISOString().slice(0, 10);
      velo.querySelector('#hasta').value = hasta;
      guardar(hasta);
    }));
    velo.querySelector('#quitar').onclick = () => confirm('¿Quitar la suscripción a este cliente?') && guardar(null);
    velo.querySelector('#ver-mensajes').onclick = () => {
      cerrar();
      hiloAbierto = c.id;
      location.hash = 'mensajes';
    };
  }

  let hiloAbierto = null;
  V.mensajes = async () => {
    const hilos = (await pedir('hilos')).sort((a, b) => Number(b.sin_responder) - Number(a.sin_responder) || b.ultimo.localeCompare(a.ultimo));
    sinResponder = hilos.filter((h) => h.sin_responder).length;
    if (!hiloAbierto && hilos.length) hiloAbierto = hilos[0].user_id;
    const conversacion = hiloAbierto ? await pedir('hilo', { user_id: hiloAbierto }) : [];
    const actual = hilos.find((h) => h.user_id === hiloAbierto);
    marco('mensajes', `
      <h1>Mensajes</h1><p class="sub">Lo que te escriben los clientes desde la app. Tu respuesta les llega a la app (Perfil → Contacta con nosotros).</p>
      <div class="chat">
        <div class="hilos">${hilos.map((h) => `<div class="hilo ${h.user_id === hiloAbierto ? 'on' : ''}" data-id="${esc(h.user_id)}"><div class="fila entre"><b>${esc(h.email || 'Cliente')}</b>${h.sin_responder ? '<span class="globo">!</span>' : ''}</div><p>${h.de === 'equipo' ? 'Tú: ' : ''}${esc(h.texto)}</p><p>${fechaHora(h.ultimo)}</p></div>`).join('') || '<div class="hilo muted">Aún no hay mensajes.</div>'}</div>
        <div class="conversacion">
          ${hiloAbierto ? `<div class="hilo" style="cursor:default"><b>${esc(actual ? actual.email : 'Cliente')}</b></div>
          <div class="burbujas" id="burbujas">${conversacion.map((m) => `<div class="burbuja b-${m.de}">${esc(m.texto)}<small>${fechaHora(m.created_at)}</small></div>`).join('') || '<p class="muted">Sin mensajes todavía. Puedes escribirle tú primero.</p>'}</div>
          <form class="responder" id="f-responder"><textarea name="texto" placeholder="Escribe tu respuesta" maxlength="2000" required></textarea><button class="boton">Enviar</button></form>` : '<div class="cargando">Elige una conversación.</div>'}
        </div>
      </div>`);
    const b = document.getElementById('burbujas');
    if (b) b.scrollTop = b.scrollHeight;
    document.querySelectorAll('.hilo[data-id]').forEach((h) => (h.onclick = () => { hiloAbierto = h.dataset.id; cargarSeccion('mensajes'); }));
    const f = document.getElementById('f-responder');
    if (f) f.onsubmit = async (ev) => {
      ev.preventDefault();
      const boton = f.querySelector('button');
      boton.disabled = true;
      try {
        await pedir('responder', { user_id: hiloAbierto, texto: new FormData(f).get('texto') });
        cargarSeccion('mensajes');
      } catch (e) {
        alert(e.message);
        boton.disabled = false;
      }
    };
  };

  V.suscripciones = async () => {
    const lista = await pedir('suscripciones');
    const ahora = new Date().toISOString();
    marco('suscripciones', `
      <h1>Suscripciones</h1><p class="sub">Las suscripciones activas y pasadas. Para dar una a mano, abre el cliente en «Clientes».</p>
      <table><thead><tr><th>Email</th><th>Estado</th><th>Hasta</th><th>Peques</th><th>Actualizada</th></tr></thead><tbody>
      ${lista.map((s) => `<tr><td>${esc(s.email)}</td><td>${s.activa_hasta && s.activa_hasta > ahora ? estado('premium') : '<span class="etiqueta e-gris">Inactiva</span>'}</td><td>${fecha(s.activa_hasta)}</td><td>${s.peques ? 'Sí' : 'No'}</td><td>${fecha(s.updated_at)}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">Aún no hay suscripciones.</td></tr>'}
      </tbody></table>`);
  };

  V.facturacion = async () => {
    marco('facturacion', `
      <h1>Facturación</h1><p class="sub">Ingresos y facturas de las suscripciones.</p>
      <div class="aviso">Los pagos aún no están conectados. Cuando se conecten las suscripciones de App Store y Google Play, aquí verás los ingresos de cada mes, las renovaciones y las cancelaciones.</div>
      <div class="tarjeta" style="margin-top:14px"><p style="margin:0 0 8px"><b>Cómo funcionará</b></p>
      <ul style="margin:0;padding-left:18px;line-height:1.7">
        <li>Apple y Google cobran al cliente y le envían su factura o recibo; ellos actúan como vendedor ante el cliente.</li>
        <li>Te pagan a ti cada mes lo vendido, menos su comisión (normalmente un 15 % para negocios pequeños).</li>
        <li>Tu gestor puede usar esos informes mensuales de las tiendas para tu contabilidad.</li>
      </ul></div>`);
  };

  V.recetas = async (buscar = '') => {
    const lista = await pedir('recetas', { buscar });
    marco('recetas', `
      <div class="fila entre"><div><h1>Recetas</h1><p class="sub">${lista.length} recetas${buscar ? ' encontradas' : ' (las 300 más recientes)'}. Si una receta no te gusta, ocúltala y no volverá a salir en menús nuevos.</p></div>
      <form id="f-buscar" class="fila"><input type="search" name="q" placeholder="Buscar receta" value="${esc(buscar)}"><button class="boton suave">Buscar</button></form></div>
      <table><thead><tr><th></th><th>Receta</th><th>Tipo</th><th>Kcal</th><th>Creada</th><th></th></tr></thead><tbody>
      ${lista.map((r) => `<tr class="clic" data-id="${r.id}"><td>${r.imagen_mini || r.imagen ? `<img class="mini" src="${esc(r.imagen_mini || r.imagen)}" alt="">` : '<div class="mini"></div>'}</td><td><b>${esc(r.nombre)}</b>${r.oculta ? ' <span class="etiqueta e-caducada">oculta</span>' : ''}</td><td>${esc(TIPOS[r.tipo_comida] || r.tipo_comida)}</td><td>${r.kcal ?? '—'}</td><td>${fecha(r.created_at)}</td><td><button class="boton ${r.oculta ? 'suave' : 'linea'}" data-ocultar="${r.id}" data-valor="${r.oculta ? '0' : '1'}">${r.oculta ? 'Mostrar' : 'Ocultar'}</button></td></tr>`).join('') || '<tr><td colspan="6" class="muted">Sin resultados.</td></tr>'}
      </tbody></table>`);
    document.getElementById('f-buscar').onsubmit = (ev) => {
      ev.preventDefault();
      cargarSeccion('recetas', new FormData(ev.target).get('q'));
    };
    document.querySelectorAll('[data-ocultar]').forEach((b) => (b.onclick = async (ev) => {
      ev.stopPropagation();
      await pedir('ocultar_receta', { id: Number(b.dataset.ocultar), oculta: b.dataset.valor === '1' });
      cargarSeccion('recetas', buscar);
    }));
    document.querySelectorAll('tr[data-id]').forEach((tr) => (tr.onclick = () => fichaReceta(Number(tr.dataset.id))));
  };

  async function fichaReceta(id) {
    const r = await pedir('receta', { id });
    const velo = document.createElement('div');
    velo.className = 'velo';
    velo.innerHTML = `<div class="ficha">
      <div class="fila entre"><h1 style="font-size:22px">${esc(r.nombre)}</h1><button class="boton linea" id="cerrar">Cerrar</button></div>
      ${r.imagen ? `<img src="${esc(r.imagen)}" alt="" style="width:100%;border-radius:16px;margin:8px 0">` : ''}
      <p class="muted">${esc(r.descripcion || '')}</p>
      <dl class="datos"><dt>Tipo</dt><dd>${esc(TIPOS[r.tipo_comida] || r.tipo_comida)}</dd><dt>Tiempo</dt><dd>${r.minutos ?? '—'} min</dd><dt>Kcal (ración estándar)</dt><dd>${r.kcal ?? '—'}</dd><dt>Alérgenos</dt><dd>${esc((r.alergenos || []).join(', ') || 'Ninguno declarado')}</dd><dt>En menús</dt><dd>${r.usos} comidas</dd></dl>
      <h2>Ingredientes</h2><ul>${(r.ingredientes || []).sort((a, b) => a.orden - b.orden).map((i) => `<li>${esc(i.cantidad ?? '')} ${esc(i.unidad || '')} ${esc(i.nombre)}</li>`).join('')}</ul>
      <h2>Pasos</h2><ol>${(r.pasos || []).map((p) => `<li style="margin-bottom:6px">${esc(p)}</li>`).join('')}</ol>
    </div>`;
    document.body.appendChild(velo);
    velo.onclick = (ev) => ev.target === velo && velo.remove();
    velo.querySelector('#cerrar').onclick = () => velo.remove();
  }

  V.gastos = async () => {
    const g = await pedir('gastos');
    const NOMBRES = { menu: 'Menú', cambiar: 'Plato nuevo', cocinar: 'Cocina con lo que tienes', ingrediente: 'Cambiar ingrediente', peques: 'Peques', foto: 'Fotos' };
    marco('gastos', `
      <h1>Gastos de IA</h1><p class="sub">Lo que cuesta la IA (Claude) y las fotos (Google), por mes. Cada cliente tiene un máximo de 9 € al año. La carga inicial del recetario no aparece aquí.</p>
      <table><thead><tr><th>Mes</th><th>Total</th><th>Detalle</th></tr></thead><tbody>
      ${g.meses.map((m) => `<tr><td><b>${esc(m.mes)}</b></td><td>${euros(m.total_eur)}</td><td class="peq">${Object.entries(m.por_tipo).map(([t, v]) => `${esc(NOMBRES[t] || t)}: ${euros(v)}`).join(' · ')}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">Aún no hay gasto registrado.</td></tr>'}
      </tbody></table>
      <h2>Clientes que más gastan este mes</h2>
      <table><thead><tr><th>Email</th><th>Gasto este mes</th></tr></thead><tbody>
      ${g.top.map((t) => `<tr><td>${esc(t.email)}</td><td>${euros(t.gasto_mes_eur)}</td></tr>`).join('') || '<tr><td colspan="2" class="muted">Nadie todavía.</td></tr>'}
      </tbody></table>`);
  };

  V.ajustes = async () => {
    const a = await pedir('ajustes');
    const p = a.planes || {};
    const r = a.recetas || {};
    const n = a.nutricion || {};
    marco('ajustes', `
      <h1>Ajustes</h1><p class="sub">Cambia cómo funciona la app sin tocar el código.</p>
      <form id="f-ajustes">
        <h2>Prueba gratis</h2>
        <div class="tarjeta" style="display:grid;gap:12px;max-width:560px">
          <label class="fila"><input type="checkbox" name="planes_activos" ${p.planes_activos !== false ? 'checked' : ''}> Planes activos (si lo desmarcas, todos ven la versión completa)</label>
          <label>Días de prueba<br><input type="number" name="dias_prueba" min="1" max="60" value="${esc(p.dias_prueba ?? 7)}"></label>
          <label>Gasto máximo en IA durante la prueba (€)<br><input type="number" name="presupuesto_prueba_eur" min="0" max="5" step="0.05" value="${esc(p.presupuesto_prueba_eur ?? 0.5)}"></label>
        </div>
        <h2>Recetas nuevas al mes (entre todos los clientes)</h2>
        <div class="tarjeta" style="display:grid;gap:12px;max-width:560px">
          <label>Fecha de lanzamiento<br><input type="date" name="fecha_inicio" value="${esc(r.fecha_inicio || '')}"></label>
          <label>Recetas nuevas al mes al principio<br><input type="number" name="tope_inicial" min="0" max="5000" value="${esc(r.tope_inicial ?? 600)}"></label>
          <label>Durante cuántos meses<br><input type="number" name="meses_iniciales" min="0" max="60" value="${esc(r.meses_iniciales ?? 7)}"></label>
          <label>Recetas nuevas al mes después<br><input type="number" name="tope_despues" min="0" max="5000" value="${esc(r.tope_despues ?? 200)}"></label>
        </div>
        <div id="resultado"></div>
        <button class="boton" style="margin-top:14px">Guardar ajustes</button>
      </form>
      <h2>Límites nutricionales</h2>
      <div class="tarjeta" style="max-width:560px">
        <p class="muted peq" style="margin-top:0">Pendientes de validar por un dietista-nutricionista. Por seguridad, solo se cambian con su visto bueno (pídemelo y lo actualizamos).</p>
        <dl class="datos" style="padding:0">${Object.entries(n).filter(([k]) => k !== 'id').map(([k, v]) => `<dt>${esc(k.replace(/_/g, ' '))}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
      </div>`);
    document.getElementById('f-ajustes').onsubmit = async (ev) => {
      ev.preventDefault();
      const f = new FormData(ev.target);
      const res = document.getElementById('resultado');
      try {
        await pedir('guardar_ajustes', {
          planes: { planes_activos: f.get('planes_activos') === 'on', dias_prueba: f.get('dias_prueba'), presupuesto_prueba_eur: f.get('presupuesto_prueba_eur') },
          recetas: { fecha_inicio: f.get('fecha_inicio'), tope_inicial: f.get('tope_inicial'), meses_iniciales: f.get('meses_iniciales'), tope_despues: f.get('tope_despues') },
        });
        res.innerHTML = '<div class="aviso ok">Ajustes guardados.</div>';
      } catch (e) {
        res.innerHTML = `<div class="aviso error">${esc(e.message)}</div>`;
      }
    };
  };

  // ---------- Navegación ----------
  async function cargarSeccion(nombre, arg) {
    const seccion = V[nombre] ? nombre : 'resumen';
    cargando(seccion);
    try {
      await V[seccion](arg);
    } catch (e) {
      if (/no tiene acceso|Vuelve a entrar/.test(e.message)) {
        await sb.auth.signOut();
        return pantallaEntrar(e.message);
      }
      fallo(seccion, e);
    }
  }

  async function iniciar() {
    const { data } = await sb.auth.getSession();
    if (!data.session) return pantallaEntrar();
    cargarSeccion(location.hash.slice(1) || 'resumen');
  }

  window.addEventListener('hashchange', () => cargarSeccion(location.hash.slice(1)));
  iniciar();
})();
