// Prueba manual: qué deja leer Instagram de un reel. Uso: deno run -A supabase/pruebas/instagram.ts <codigo>
const codigo = Deno.args[0];
const UAS = {
  navegador: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
  facebook: 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
};
for (const u of [`https://www.instagram.com/reel/${codigo}/embed/captioned/`, `https://www.instagram.com/p/${codigo}/embed/captioned/`, `https://www.instagram.com/reel/${codigo}/`]) {
  for (const [n, ua] of Object.entries(UAS)) {
    const r = await fetch(u, { headers: { 'user-agent': ua, 'accept-language': 'es-ES,es;q=0.9' } });
    const h = await r.text();
    const cap = h.match(/class="Caption"[^>]*>([\s\S]{0,600})/)?.[1]?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    const og = h.match(/property="og:description" content="([^"]{0,300})/)?.[1];
    const img = h.match(/class="EmbeddedMediaImage"[^>]*src="([^"]{0,80})/)?.[1] ?? h.match(/property="og:image" content="([^"]{0,80})/)?.[1];
    const json = h.match(/"caption":\{[^}]{0,50}"text":"([^"]{0,200})/)?.[1] ?? h.match(/\\"caption\\":\\"([^\\]{0,200})/)?.[1];
    console.log(u.split('instagram.com')[1], n, r.status, h.length, 'CAP', cap?.slice(0, 250), 'OG', og?.slice(0, 150), 'JSON', json?.slice(0, 150), 'IMG', img ? 'sí' : 'no');
  }
}
