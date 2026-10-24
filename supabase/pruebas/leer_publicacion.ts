// Prueba manual: qué se puede leer de un TikTok. Uso: deno run -A supabase/pruebas/leer_publicacion.ts <enlace>
const enlace = Deno.args[0] ?? '';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const r1 = await fetch(enlace, { redirect: 'follow', headers: { 'user-agent': UA } });
const html1 = await r1.text();
const id = r1.url.match(/\/video\/(\d+)/)?.[1];
const mira = (nombre: string, h: string) => {
  const desc = [...h.matchAll(/"desc":"((?:[^"\\]|\\.){10,400})"/g)].map((m) => m[1]).slice(0, 2);
  const og = h.match(/property="og:description" content="([^"]{0,300})/)?.[1];
  const cover = h.match(/"(?:cover|originCover|dynamicCover)":"(https:[^"]{0,200})/)?.[1];
  console.log(nombre, h.length, 'DESC', JSON.stringify(desc), 'OG', og, 'COVER', cover ? 'sí' : 'no');
};
mira('PAGINA', html1);
for (const u of [`https://www.tiktok.com/embed/v2/${id}`, `https://www.tiktok.com/player/v1/${id}`]) {
  const r = await fetch(u, { headers: { 'user-agent': UA } });
  mira(u.split('/')[3] + '/' + u.split('/')[4], await r.text());
}
