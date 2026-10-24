// Prueba manual: qué deja leer Instagram de un reel. Uso: deno run -A supabase/pruebas/instagram.ts <codigo>
const codigo = Deno.args[0];
const ua = 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)';
for (const u of [`https://www.instagram.com/reel/${codigo}/embed/captioned/`, `https://www.instagram.com/reel/${codigo}/`]) {
  const r = await fetch(u, { headers: { 'user-agent': ua } });
  const h = await r.text();
  console.log('URL', u, h.length, 'TITLE', h.match(/<title[^>]*>([^<]{0,200})/)?.[1]);
  for (const k of ['edge_media_to_caption', '"caption"', 'Caption', 'og:', 'display_url', 'thumbnail', 'ingredient', 'Ingred', 'username', 'login']) {
    const i = h.indexOf(k);
    console.log('  ', k, i, i >= 0 ? JSON.stringify(h.slice(Math.max(0, i - 60), i + 220)) : '');
  }
}
