// Aviso de cookies de yococino.app.
// Hoy la web solo usa almacenamiento técnico (para recordar esta elección). Si algún día se añade analítica
// o publicidad, su código debe cargarse solo cuando window.yococinoCookies.permitido('analitica' | 'marketing')
// sea true, o al recibir el evento 'yococino-cookies' con la elección nueva.
(function () {
  var CLAVE = 'yococino-cookies';
  var VERSION = 1;
  var VALIDEZ_MS = 365 * 24 * 3600 * 1000; // se vuelve a preguntar al cabo de 12 meses

  function leer() {
    try {
      var v = JSON.parse(localStorage.getItem(CLAVE) || 'null');
      if (!v || v.version !== VERSION || Date.now() - v.fecha > VALIDEZ_MS) return null;
      return v;
    } catch (e) {
      return null;
    }
  }
  function guardar(analitica, marketing) {
    var v = { version: VERSION, fecha: Date.now(), analitica: !!analitica, marketing: !!marketing };
    try {
      localStorage.setItem(CLAVE, JSON.stringify(v));
    } catch (e) {}
    try {
      window.dispatchEvent(new CustomEvent('yococino-cookies', { detail: v }));
    } catch (e) {}
    return v;
  }

  window.yococinoCookies = {
    permitido: function (tipo) {
      var v = leer();
      return !!(v && v[tipo]);
    },
    configurar: function () {
      abrir(true);
    },
  };

  var raiz = (document.currentScript && document.currentScript.getAttribute('data-raiz')) || '';

  function abrir(detalle) {
    var previo = document.getElementById('aviso-cookies');
    if (previo) previo.remove();
    var actual = leer() || { analitica: false, marketing: false };
    var caja = document.createElement('div');
    caja.id = 'aviso-cookies';
    caja.className = 'aviso-cookies';
    caja.setAttribute('role', 'dialog');
    caja.setAttribute('aria-live', 'polite');
    caja.setAttribute('aria-label', 'Aviso de cookies');
    caja.innerHTML =
      '<div class="ac-texto"><b>🍪 Cookies</b>' +
      '<p>Usamos solo lo necesario para que la web funcione y recordar tu elección. No usamos cookies de publicidad ni de seguimiento. ' +
      'Si en el futuro añadimos estadísticas, solo se activarán si las aceptas. <a href="' + raiz + 'cookies.html">Política de cookies</a></p></div>' +
      '<div class="ac-opciones"' + (detalle ? '' : ' hidden') + '>' +
      '<label><input type="checkbox" checked disabled> <span><b>Necesarias</b> · siempre activas. Recuerdan tu elección.</span></label>' +
      '<label><input type="checkbox" id="ac-analitica"' + (actual.analitica ? ' checked' : '') + '> <span><b>Estadísticas</b> · para saber qué páginas se visitan (ahora no se usan).</span></label>' +
      '<label><input type="checkbox" id="ac-marketing"' + (actual.marketing ? ' checked' : '') + '> <span><b>Publicidad</b> · para medir campañas (ahora no se usan).</span></label>' +
      '</div>' +
      '<div class="ac-botones">' +
      '<button type="button" class="ac-boton" data-accion="rechazar">Rechazar</button>' +
      '<button type="button" class="ac-boton ac-enlace" data-accion="' + (detalle ? 'guardar' : 'configurar') + '">' + (detalle ? 'Guardar mi elección' : 'Configurar') + '</button>' +
      '<button type="button" class="ac-boton" data-accion="aceptar">Aceptar</button>' +
      '</div>';
    document.body.appendChild(caja);
    caja.addEventListener('click', function (ev) {
      var b = ev.target.closest && ev.target.closest('button[data-accion]');
      if (!b) return;
      var accion = b.getAttribute('data-accion');
      if (accion === 'configurar') return abrir(true);
      if (accion === 'aceptar') guardar(true, true);
      if (accion === 'rechazar') guardar(false, false);
      if (accion === 'guardar') guardar(document.getElementById('ac-analitica').checked, document.getElementById('ac-marketing').checked);
      caja.remove();
    });
  }

  function iniciar() {
    // Enlace «Cookies» del pie para cambiar la elección cuando se quiera.
    document.querySelectorAll('[data-cookies]').forEach(function (a) {
      a.addEventListener('click', function (ev) {
        ev.preventDefault();
        abrir(true);
      });
    });
    if (!leer()) abrir(false);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
