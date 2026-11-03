# Próxima versión de la app (Android e iPhone)

Lanzarla cuando Apple y Google hayan aprobado la 1.0 (no antes: cualquier cambio reinicia la revisión).
Nada de actualizaciones rápidas (OTA) mientras haya una versión en revisión: llegarían también a los revisores.

Cambios ya hechos y comprobados, pendientes de llegar a los móviles:
- Receta: no se pierde lo marcado (ingredientes y pasos) ni los temporizadores al salir o abrir otra receta.
- Temporizador: el aviso de «¡Tiempo!» suena y se ve también con la app abierta en otra pantalla o receta.
- Inicio: apartado «🍰 Dale un toque dulce a tu vida» (2 dulces y «Ver todas»); aviso de dulce en la ficha.
- Paquete react-native-safe-area-context actualizado a ~5.11.1 (pieza nativa: necesita versión nueva, no OTA).

Al lanzarla:
1. «App Android» y «App iPhone» en GitHub Actions (subir número de versión si la tienda lo pide).
2. Android: Producción → nueva versión con el .aab nuevo. iPhone: nueva versión en App Store Connect con la compilación nueva.
