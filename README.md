# Yococino

App de Android e iOS que prepara cada mes un menú equilibrado según tu objetivo, con recetas paso a paso y lista de la compra.

El documento maestro del producto está en Claude, en el proyecto *App recetas*.

## Qué hay en este repositorio

| Carpeta | Qué contiene |
| --- | --- |
| `movil/` | La app (React Native con Expo SDK 58) |
| `movil/app/` | Las pantallas: bienvenida, encuesta y resultado |
| `movil/src/` | Estilo, componentes y reglas de la encuesta |
| `supabase/migrations/` | La estructura de la base de datos en Supabase |
| `.github/workflows/` | Comprobaciones automáticas en cada cambio |

## Estado

- [x] Bienvenida y encuesta inicial de 7 pasos, con las reglas de seguridad.
- [ ] Registro de usuarios con Supabase.
- [ ] Menú de 30 días generado con IA.
- [ ] Recetas, lista de la compra y progreso.

## Comprobaciones automáticas

Cada vez que se sube un cambio, GitHub instala la app, comprueba el código y genera una versión web de prueba (pestaña **Actions**).

Si existe el secreto `EXPO_TOKEN`, además publica una vista previa para abrirla en el móvil con **Expo Go**.
