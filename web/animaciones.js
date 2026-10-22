// Animaciones suaves de la web: aparición al hacer scroll, cabecera al desplazarse y menú en el móvil.
// Respeta la opción del sistema "reducir movimiento".
(function () {
  'use strict';
  var reducir = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Todo lo que aparece al entrar en pantalla.
  var selectores = '.aparece, .titulo, .funcion, .paso, .plan, details, .receta-tarjeta, .seguridad li, .edad, .contacto .contenedor > *';
  var elementos = Array.prototype.slice.call(document.querySelectorAll(selectores));
  // Retraso escalonado dentro de cada grupo.
  document.querySelectorAll('.escalonado, .recetas-rejilla, .precios, .preguntas, .seguridad ul').forEach(function (grupo) {
    Array.prototype.forEach.call(grupo.children, function (hijo, i) {
      hijo.style.setProperty('--retraso', Math.min(i, 6) * 80 + 'ms');
    });
  });
  if (reducir || !('IntersectionObserver' in window)) {
    elementos.forEach(function (e) { e.classList.add('visible'); });
  } else {
    document.documentElement.classList.add('con-animaciones');
    var obs = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add('visible');
          obs.unobserve(en.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    elementos.forEach(function (e) { obs.observe(e); });
  }

  // Sombra en la cabecera al bajar.
  var cabecera = document.querySelector('header');
  var alDesplazar = function () { if (cabecera) cabecera.classList.toggle('con-sombra', window.scrollY > 8); };
  window.addEventListener('scroll', alDesplazar, { passive: true });
  alDesplazar();

  // Menú del móvil.
  var boton = document.querySelector('.abrir-menu');
  var menu = document.getElementById('menu-principal');
  if (boton && menu) {
    boton.addEventListener('click', function () {
      var abierto = menu.classList.toggle('abierto');
      boton.setAttribute('aria-expanded', abierto ? 'true' : 'false');
      boton.classList.toggle('abierto', abierto);
    });
    menu.addEventListener('click', function (ev) {
      if (ev.target.tagName === 'A') { menu.classList.remove('abierto'); boton.classList.remove('abierto'); boton.setAttribute('aria-expanded', 'false'); }
    });
  }
})();
