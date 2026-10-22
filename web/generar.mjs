// Genera la web pública con recetas reales (lo ejecuta GitHub cada día y en cada cambio de la web).
// 1. Pide a Supabase que publique la receta del día (como mucho una al día).
// 2. Construye en ../publicar/web: portada con fotos de recetas, /recetas/ con todas las publicadas,
//    una página por receta pensada para Google, sitemap.xml y robots.txt.
// Las páginas no dan la receta al 100 %: ingredientes sin cantidades y los primeros pasos; el resto, en la app.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const SALIDA = join(AQUI, '..', 'publicar', 'web');
const DOMINIO = 'https://yococino.app';
const ENLACE_APP = 'https://yococino.expo.app';
const URL = process.env.SUPABASE_URL;
const CLAVE = process.env.SUPABASE_ANON_KEY;

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const NIVEL = { facil: 'Fácil', medio: 'Media', elaborado: 'Elaborada' };
const fechaLarga = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

async function llamar(accion) {
  const r = await fetch(`${URL}/functions/v1/web-recetas`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${CLAVE}`, apikey: CLAVE, 'Content-Type': 'application/json' },
    body: JSON.stringify({ accion }),
  });
  const datos = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`web-recetas ${accion}: ${r.status} ${JSON.stringify(datos).slice(0, 200)}`);
  return datos;
}

const cabecera = (raiz) => `
  <header>
    <div class="contenedor">
      <a class="marca" href="${raiz}"><img src="${raiz}icono.png" alt=""><span><span class="yo">yo</span><span class="cocino">cocino</span></span></a>
      <button class="abrir-menu" aria-label="Abrir el menú" aria-expanded="false" aria-controls="menu-principal"><span></span><span></span><span></span></button>
      <nav class="menu" id="menu-principal" aria-label="Principal">
        <a href="${raiz}#funciones">Qué hace</a>
        <a href="${raiz}#peques">Peques</a>
        <a href="${raiz}recetas/">Recetas</a>
        <a href="${raiz}#precios">Precios</a>
        <a class="boton" href="${ENLACE_APP}">Pruébala gratis</a>
      </nav>
    </div>
  </header>`;

const pie = (raiz) => `
  <footer>
    <div class="contenedor">
      <div>© ${new Date().getFullYear()} Yococino. Menús orientativos: no sustituyen el consejo de un profesional sanitario.</div>
      <div><a href="${raiz}recetas/">Recetas</a><a href="${raiz}privacidad.html">Privacidad</a><a href="${raiz}condiciones.html">Condiciones</a><a href="mailto:info@yococino.app">Contacto</a></div>
    </div>
  </footer>`;

const pagina = ({ titulo, descripcion, url, imagen, raiz, cuerpo, datos }) => `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(titulo)}</title>
  <meta name="description" content="${esc(descripcion)}">
  <link rel="canonical" href="${esc(url)}">
  <meta property="og:type" content="article">
  <meta property="og:title" content="${esc(titulo)}">
  <meta property="og:description" content="${esc(descripcion)}">
  <meta property="og:url" content="${esc(url)}">
  ${imagen ? `<meta property="og:image" content="${esc(imagen)}">` : ''}
  <meta name="twitter:card" content="summary_large_image">
  <meta name="theme-color" content="#FBFAF6">
  <link rel="icon" href="${raiz}favicon.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500..800&family=Figtree:wght@400..800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="${raiz}estilo.css?v=3">
  ${datos ? `<script type="application/ld+json">${JSON.stringify(datos).replace(/</g, '\\u003c')}</script>` : ''}
</head>
<body>
${cabecera(raiz)}
  <main>${cuerpo}</main>
${pie(raiz)}
  <script src="${raiz}animaciones.js?v=1" defer></script>
</body>
</html>
`;

const tarjeta = (r, raiz) => {
  const enlace = r.slug ? `${raiz}recetas/${r.slug}.html` : ENLACE_APP;
  return `<a class="receta-tarjeta" href="${esc(enlace)}">
          <img src="${esc(r.imagen_mini || r.imagen)}" alt="${esc(r.nombre)}" loading="lazy" width="400" height="300">
          <div class="cuerpo"><span class="tipo">${esc(r.tipo)}</span><h3>${esc(r.nombre)}</h3>
          <span class="datos">${[r.minutos ? `${r.minutos} min` : null, NIVEL[r.nivel], r.kcal ? `${r.kcal} kcal` : null].filter(Boolean).join(' · ')}</span></div>
        </a>`;
};

function paginaReceta(a) {
  const r = a.receta;
  const url = `${DOMINIO}/recetas/${a.slug}.html`;
  const c = a.contenido || {};
  const quedan = Math.max(0, r.pasos_total - r.pasos_visibles.length);
  const datos = {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: r.nombre,
    description: a.meta,
    image: r.imagen ? [r.imagen] : undefined,
    author: { '@type': 'Organization', name: 'Yococino' },
    datePublished: a.publicada_el,
    totalTime: r.minutos ? `PT${r.minutos}M` : undefined,
    recipeCategory: r.tipo,
    recipeCuisine: 'Mediterránea',
    keywords: (c.palabras_clave || []).join(', '),
    recipeYield: '1 ración',
    nutrition: r.kcal ? { '@type': 'NutritionInformation', calories: `${r.kcal} kcal` } : undefined,
    recipeIngredient: r.ingredientes,
    recipeInstructions: r.pasos_visibles.map((p) => ({ '@type': 'HowToStep', text: p })),
  };
  const faq = (c.preguntas || []).length
    ? { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: c.preguntas.map((p) => ({ '@type': 'Question', name: p.pregunta, acceptedAnswer: { '@type': 'Answer', text: p.respuesta } })) }
    : null;
  const cuerpo = `
    <article class="receta-pagina">
      <nav class="migas" aria-label="Estás en"><a href="../">Inicio</a> › <a href="./">Recetas</a> › ${esc(r.nombre)}</nav>
      <h1>${esc(a.titulo)}</h1>
      <p class="lead">${esc(r.descripcion || a.meta)}</p>
      ${r.imagen ? `<img class="foto-grande" src="${esc(r.imagen)}" alt="${esc(r.nombre)}, receta casera" width="1024" height="640">` : ''}
      <div class="ficha">
        ${r.minutos ? `<span>⏱ ${r.minutos} min</span>` : ''}
        <span>👩‍🍳 ${esc(NIVEL[r.nivel] || r.nivel)}</span>
        ${r.kcal ? `<span>🔥 ${r.kcal} kcal por ración</span>` : ''}
        <span>🍽 ${esc(r.tipo)}</span>
        ${(r.etiquetas || []).slice(0, 3).map((e) => `<span>${esc(e)}</span>`).join('')}
      </div>
      ${(c.intro || []).map((p) => `<p>${esc(p)}</p>`).join('')}

      <h2>Ingredientes</h2>
      <ul class="ingredientes">${r.ingredientes.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>
      <p><b>Las cantidades exactas, ajustadas a tu ración y a los que coméis en casa, están en la app.</b></p>

      <h2>Cómo hacer ${esc(r.nombre.toLowerCase())}</h2>
      <ol class="pasos-lista">${r.pasos_visibles.map((p) => `<li>${esc(p)}</li>`).join('')}</ol>
      ${quedan ? `<div class="mas-pasos">
        <p class="borroso" aria-hidden="true">Continúa la preparación con el siguiente paso, controlando el tiempo y el punto de cocción hasta que quede perfecto para servir.</p>
        <h3>Faltan ${quedan} ${quedan === 1 ? 'paso' : 'pasos'} para terminarla</h3>
        <p>Sigue la receta completa en Yococino, con temporizadores, modo cocinar y las cantidades para ti.</p>
        <a class="boton" href="${ENLACE_APP}">Ver la receta completa gratis</a>
      </div>` : ''}

      ${(c.beneficios || []).length ? `<h2>Por qué es una buena opción</h2><ul>${c.beneficios.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}
      ${(c.consejos || []).length ? `<h2>Consejos para que salga perfecta</h2><ul>${c.consejos.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}
      ${(r.alergenos || []).length ? `<p class="peq">Contiene: ${esc(r.alergenos.join(', '))}. Revisa siempre el etiquetado de los productos.</p>` : ''}

      ${(c.preguntas || []).length ? `<h2>Preguntas frecuentes</h2><div class="preguntas" style="margin:0">${c.preguntas.map((p) => `<details><summary>${esc(p.pregunta)}</summary><p>${esc(p.respuesta)}</p></details>`).join('')}</div>` : ''}

      <div class="cta">
        <h2 style="margin:0;color:#fff">Tu menú de todo el mes, con recetas como esta</h2>
        <p>Yococino prepara lo que vas a comer cada día según tu objetivo, tus gustos y tus alergias, con la lista de la compra hecha. Pruébala gratis 7 días.</p>
        <a class="boton" href="${ENLACE_APP}">Empezar gratis</a>
      </div>
      <p class="peq muted">Publicada el ${fechaLarga(a.publicada_el)}.</p>
    </article>`;
  return pagina({ titulo: `${a.titulo} | Yococino`, descripcion: a.meta, url, imagen: r.imagen, raiz: '../', cuerpo, datos: faq ? [datos, faq] : datos });
}

function paginaListado(articulos) {
  const cuerpo = `
    <section>
      <div class="contenedor">
        <nav class="migas" aria-label="Estás en"><a href="../">Inicio</a> › Recetas</nav>
        <div class="titulo" style="text-align:left;margin:0 0 32px;max-width:none">
          <h1 style="font-size:clamp(34px,5vw,52px)">Recetas caseras y saludables</h1>
          <p>Platos mediterráneos, fáciles y de temporada. Cada día, una receta nueva. En la app tienes cientos más, con tu menú de todo el mes.</p>
        </div>
        ${articulos.length ? `<div class="recetas-rejilla">${articulos.map((a) => tarjeta({ ...a.receta, slug: a.slug }, '../')).join('')}</div>` : '<p>Muy pronto, nuestras primeras recetas.</p>'}
        <div class="cta">
          <h2 style="margin:0;color:#fff">¿Quieres tu menú hecho cada día?</h2>
          <p>Prueba Yococino gratis 7 días: menú, recetas paso a paso y lista de la compra.</p>
          <a class="boton" href="${ENLACE_APP}">Empezar gratis</a>
        </div>
      </div>
    </section>`;
  return pagina({
    titulo: 'Recetas caseras, saludables y fáciles | Yococino',
    descripcion: 'Recetas caseras de cocina mediterránea, fáciles, saludables y de temporada. Una receta nueva cada día y tu menú del mes en la app Yococino.',
    url: `${DOMINIO}/recetas/`,
    imagen: articulos[0]?.receta.imagen,
    raiz: '../',
    cuerpo,
  });
}

function portada(plantilla, destacadas) {
  let html = plantilla;
  const p = destacadas[0];
  if (p) {
    html = html.replace(/<!--FOTO_PORTADA-->[\s\S]*?<!--\/FOTO_PORTADA-->/, `<div class="foto"><img src="${esc(p.imagen_mini || p.imagen)}" alt="${esc(p.nombre)}"></div>`);
    html = html.replace(/<!--NOMBRE_PORTADA-->[\s\S]*?<!--\/NOMBRE_PORTADA-->/, esc(p.nombre));
  }
  const seccion = destacadas.length
    ? `<section id="recetas">
      <div class="contenedor">
        <div class="titulo"><span class="antetitulo">Recetas</span><h2>Conoce nuestras recetas</h2><p>Caseras, de temporada y pensadas para tu día a día. Así son algunos de los platos de tu menú.</p></div>
        <div class="recetas-rejilla">
        ${destacadas.map((r) => tarjeta(r, '')).join('\n        ')}
        </div>
        <p class="ver-todas"><a class="boton claro" href="recetas/">Ver todas las recetas</a></p>
      </div>
    </section>`
    : '';
  html = html.replace('<!--RECETAS-->', seccion);
  const datos = [
    { '@context': 'https://schema.org', '@type': 'Organization', name: 'Yococino', url: DOMINIO, logo: `${DOMINIO}/logo.png`, email: 'info@yococino.app' },
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Yococino',
      applicationCategory: 'LifestyleApplication',
      operatingSystem: 'iOS, Android, Web',
      description: 'Menú personalizado de 30 días, recetas paso a paso y lista de la compra automática.',
      offers: { '@type': 'Offer', price: '39.99', priceCurrency: 'EUR' },
    },
  ];
  return html.replace('<!--DATOS_ESTRUCTURADOS-->', `<script type="application/ld+json">${JSON.stringify(datos)}</script>`);
}

async function principal() {
  rmSync(join(AQUI, '..', 'publicar'), { recursive: true, force: true });
  mkdirSync(SALIDA, { recursive: true });
  cpSync(AQUI, SALIDA, { recursive: true, filter: (f) => !f.endsWith('generar.mjs') });

  let datos = { articulos: [], destacadas: [] };
  if (URL && CLAVE) {
    try {
      const r = await llamar('publicar');
      console.log(r.publicada ? `Receta del día publicada: ${r.receta}` : `Sin receta nueva hoy (${r.motivo}).`);
    } catch (e) {
      console.log(`::warning title=Web::No se pudo publicar la receta del día: ${e.message}`);
    }
    try {
      datos = await llamar('listar');
    } catch (e) {
      console.log(`::warning title=Web::No se pudieron leer las recetas: ${e.message}`);
    }
  }
  const articulos = datos.articulos || [];
  const destacadas = (datos.destacadas || []).filter((r) => r.imagen);

  writeFileSync(join(SALIDA, 'index.html'), portada(readFileSync(join(AQUI, 'index.html'), 'utf8'), destacadas));
  mkdirSync(join(SALIDA, 'recetas'), { recursive: true });
  writeFileSync(join(SALIDA, 'recetas', 'index.html'), paginaListado(articulos));
  for (const a of articulos) writeFileSync(join(SALIDA, 'recetas', `${a.slug}.html`), paginaReceta(a));

  const urls = [
    { loc: `${DOMINIO}/`, prioridad: '1.0' },
    { loc: `${DOMINIO}/recetas/`, prioridad: '0.9' },
    ...articulos.map((a) => ({ loc: `${DOMINIO}/recetas/${a.slug}.html`, fecha: a.publicada_el, prioridad: '0.7' })),
    { loc: `${DOMINIO}/privacidad.html`, prioridad: '0.2' },
    { loc: `${DOMINIO}/condiciones.html`, prioridad: '0.2' },
  ];
  writeFileSync(
    join(SALIDA, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
      .map((u) => `  <url><loc>${u.loc}</loc>${u.fecha ? `<lastmod>${u.fecha}</lastmod>` : ''}<priority>${u.prioridad}</priority></url>`)
      .join('\n')}\n</urlset>\n`,
  );
  writeFileSync(join(SALIDA, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${DOMINIO}/sitemap.xml\n`);
  console.log(`Web generada: ${articulos.length} recetas publicadas, ${destacadas.length} destacadas.`);
}

principal().catch((e) => {
  console.error(e);
  process.exit(1);
});
