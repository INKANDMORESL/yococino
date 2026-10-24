// Prueba manual: qué lee el servidor de una publicación. Uso: deno run -A supabase/pruebas/leer_publicacion.ts <enlace>
import { leerPublicacion } from '../functions/_shared/publicacion.ts';
const enlace = Deno.args[0] ?? '';
const r1 = await fetch(enlace, { redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 (compatible; YococinoBot/1.0; +https://yococino.app)' } });
console.log('FINAL', r1.status, r1.url);
await r1.body?.cancel();
const id = r1.url.match(/\/video\/(\d+)/)?.[1];
for (const u of [r1.url.split('?')[0], `https://www.tiktok.com/@x/video/${id}`]) {
  const o = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(u)}`);
  console.log('OEMBED', o.status, (await o.text()).slice(0, 400));
}
const r = await leerPublicacion(enlace);
console.log('RESULTADO', JSON.stringify(r ? { ...r, texto: r.texto.slice(0, 600) } : null));
