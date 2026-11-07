// Enlaces a la app: en un iPhone o iPad llevan al App Store, en Android a Google Play y en el ordenador
// al apartado «Descarga Yococino» de la portada (con los dos botones).
(function () {
  var APP_STORE = 'https://apps.apple.com/es/app/id6828504877';
  var GOOGLE_PLAY = 'https://play.google.com/store/apps/details?id=app.yococino';
  var ua = navigator.userAgent || '';
  var ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  var android = /Android/.test(ua);
  var destino = ios ? APP_STORE : android ? GOOGLE_PLAY : null;
  if (!destino) return;
  document.querySelectorAll('a[data-app]').forEach(function (a) { a.href = destino; });
})();
