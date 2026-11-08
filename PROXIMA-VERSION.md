# Próxima versión de la app (Android e iPhone)

Versión 1.1.0 lanzada el 8/11/2026 (Android e iPhone) con todo lo que había aquí: receta que no pierde lo marcado,
alarma que suena con la app abierta, apartado de dulces y su buscador, aviso de las casillas en el registro,
enlace de confirmación por la web, idioma español en iPhone, paquete de pantalla actualizado y versión para tablet (columna centrada; iPad activado).

Pendiente para la siguiente versión:
- (nada todavía)

Al lanzarla:
1. Subir "version" en movil/app.json (la tienda pide un número mayor).
2. «App Android» y «App iPhone» en GitHub Actions.
3. Android: Producción → nueva versión con el .aab nuevo. iPhone: nueva versión en App Store Connect con la compilación nueva.
Nada de actualizaciones rápidas (OTA) mientras haya una versión en revisión: llegarían también a los revisores.
