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
- Proyecto Supabase en la región eu-west-1 (Irlanda, UE). Las migraciones `20261021000000_inicio.sql` y `20261021200000_fecha_nacimiento.sql` se aplican a mano desde el SQL Editor: antes del próximo `supabase db push` desde GitHub hay que marcarlas como aplicadas con `supabase migration repair --status applied <versión>`. El secreto SUPABASE_DB_PASSWORD de GitHub falló al autenticar; revisarlo antes de usar el flujo `base-de-datos.yml`.
