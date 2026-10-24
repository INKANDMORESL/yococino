// Prueba manual: qué lee el servidor de una publicación. Uso: deno run -A supabase/pruebas/leer_publicacion.ts <enlace>
import { leerPublicacion } from '../functions/_shared/publicacion.ts';
const r = await leerPublicacion(Deno.args[0] ?? '');
console.log(JSON.stringify(r ? { ...r, texto: r.texto.slice(0, 900) } : null));
