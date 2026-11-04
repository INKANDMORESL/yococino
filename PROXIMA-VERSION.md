# Próxima versión de la app (Android e iPhone)

Estado (4 nov 2026): Android 1.0 publicada en Google Play (sin estos cambios). iPhone 1.0 enviada otra vez a
revisión con una compilación que YA lleva todos estos cambios (menos el buscador de dulces, que irá en la siguiente).
Plan del dueño: cuando Apple apruebe el iPhone, subir la actualización de Android con estos cambios (las dos
quedan iguales). No antes.
Nada de actualizaciones rápidas (OTA) mientras haya una versión en revisión: llegarían también a los revisores.

Cambios ya hechos y comprobados, pendientes de llegar a los móviles:
- Receta: no se pierde lo marcado (ingredientes y pasos) ni los temporizadores al salir o abrir otra receta.
- Temporizador: el aviso de «¡Tiempo!» suena y se ve también con la app abierta en otra pantalla o receta.
- Inicio: apartado «🍰 Dale un toque dulce a tu vida» (2 dulces y «Ver todas»); aviso de dulce en la ficha.
- Registro: si faltan las casillas, el aviso sale justo debajo de Google y Apple (en la revisión de Apple parecía que los botones no hacían nada porque el aviso quedaba fuera de la pantalla).
- Email de confirmación: el enlace va a https://yococino.app/confirmar.html (funciona en cualquier dispositivo y ofrece abrir la app). Requiere esa dirección en Supabase → Authentication → URL Configuration → Redirect URLs.
- Dulces y especiales («Ver todas»): buscador por nombre (sin tildes).
- Paquete react-native-safe-area-context actualizado a ~5.11.1 (pieza nativa: necesita versión nueva, no OTA).

Al lanzarla:
1. «App Android» y «App iPhone» en GitHub Actions (subir número de versión si la tienda lo pide).
2. Android: Producción → nueva versión con el .aab nuevo. iPhone: nueva versión en App Store Connect con la compilación nueva.
