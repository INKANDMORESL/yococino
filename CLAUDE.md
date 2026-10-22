# Yococino: notas para Claude

- El dueño del proyecto no programa. Explica en español, con pasos sencillos, y no le pidas usar la terminal.
- Nunca pidas contraseñas ni claves en el chat: van en los secretos de GitHub, Supabase o Expo.
- App: `movil/`, Expo SDK 58, expo-router, TypeScript estricto. Versiones según `expo install`.
- Servidor: Supabase, región eu-west-1 Irlanda (UE). Migraciones en `supabase/migrations/`. Todas las tablas con RLS.
- Datos de salud (alergias, condiciones, peso): consentimiento explícito, nunca en logs ni en analítica.
- Seguridad de los menús (no negociable): solo mayores de 18; objetivo de peso con IMC >= 18,5; déficit moderado con mínimo de calorías fijado por un dietista; alergias excluidas siempre; embarazo, diabetes, renal, tiroides o TCA → no se genera menú y se recomienda un profesional. La versión Peques nunca es una dieta.
- Precios: gratis = solo el recetario del mes, sin cambios; suscripción 39,99 €/año; complemento Peques +9,99 €/año.
- Menú continuo: cada día se añade un día nuevo, siempre 30 días por delante.
- En esta sesión de Claude no hay acceso al registro de npm: la comprobación real la hace GitHub Actions (`.github/workflows/comprobar.yml`).
- Proyecto Supabase en la región eu-west-1 (Irlanda, UE). Las migraciones se aplican desde GitHub (`.github/workflows/servidor.yml`) con la Management API y un token limitado (`SUPABASE_ACCESS_TOKEN`: Migrations RW + Edge Functions RW). Las aplicadas a mano están en `supabase/aplicadas-a-mano.txt` y se saltan. Escribe migraciones idempotentes (`if not exists`).
- Menú: Edge Function `preparar-menu` (Deno). Reglas puras en `supabase/functions/_shared/` con pruebas en `reglas_test.ts` (se ejecutan en GitHub con `deno test`). Recetas compartidas (ración estándar) + `comidas.factor` por persona. Secreto en Supabase: `ANTHROPIC_API_KEY`. A la IA no se envían datos personales.
- Límites nutricionales en la tabla `ajustes_nutricion` (pendientes de validar por un dietista-nutricionista).
- Fotos de los platos (pendiente): realistas, como cocinadas de verdad en casa, pero bonitas. Luz natural, textura real (dorados, salsa, migas, vapor), emplatado cuidado sin parecer de estudio ni artificial. Una foto por receta compartida, generada una sola vez.
- Por ahora todos los usuarios ven la versión premium completa (decisión del dueño). El plan gratuito y los pagos se harán más adelante.
