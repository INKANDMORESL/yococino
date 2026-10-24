// Reglas puras para guardar recetas desde redes sociales. Sin dependencias de Deno: se prueban en reglas_test.ts.

// Saca el primer enlace de un texto compartido ("Mira esta receta https://vm.tiktok.com/abc …").
export function extraerUrl(texto: string): string | null {
  const m = String(texto ?? '').match(/https?:\/\/[^\s<>"'«»]+/i);
  if (!m) return null;
  return m[0].replace(/[).,;!?]+$/, '');
}

// Solo enlaces públicos normales: https, con un dominio de verdad (nada de direcciones internas ni IPs).
export function urlPermitida(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
  if (u.username || u.password) return false;
  const h = u.hostname.toLowerCase();
  if (!h.includes('.') || h.endsWith('.local') || h.endsWith('.internal') || h === 'localhost') return false;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h) || h.includes(':') || h.startsWith('[')) return false;
  if (h.endsWith('supabase.co') || h.endsWith('supabase.in')) return false;
  if (u.port && !['80', '443'].includes(u.port)) return false;
  return true;
}

// Forma única de un enlace, para no analizar dos veces el mismo (sin parámetros de seguimiento).
export function normalizarUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = '';
    for (const p of [...u.searchParams.keys()]) {
      if (/^(utm_|igsh|igshid|si$|is_from_webapp|sender_device|sender_web_id|share_|_r$|_t$|feature$|fbclid|gclid)/i.test(p)) u.searchParams.delete(p);
    }
    u.hostname = u.hostname.toLowerCase().replace(/^(www\.|m\.)/, '');
    return u.toString().replace(/\/$/, '');
  } catch {
    return url.trim();
  }
}

export type Plataforma = 'tiktok' | 'instagram' | 'youtube' | 'facebook' | 'pinterest' | 'web';
export function plataformaDe(url: string): Plataforma {
  const h = (() => {
    try {
      return new URL(url).hostname.toLowerCase();
    } catch {
      return '';
    }
  })();
  if (/(^|\.)tiktok\.com$/.test(h)) return 'tiktok';
  if (/(^|\.)instagram\.com$/.test(h) || h === 'instagr.am') return 'instagram';
  if (/(^|\.)youtube\.com$/.test(h) || h === 'youtu.be') return 'youtube';
  if (/(^|\.)facebook\.com$/.test(h) || h === 'fb.watch') return 'facebook';
  if (/(^|\.)pinterest\.[a-z.]+$/.test(h) || h === 'pin.it') return 'pinterest';
  return 'web';
}

// Avisos de «alto contenido» por ración. Umbrales del semáforo nutricional de la FSA británica
// (rojo por ración = más del 30 % de la ingesta de referencia de un adulto). Pendientes de validar por un dietista.
export const UMBRALES_RACION = { kcal: 900, grasas: 21, grasas_saturadas: 6, azucares: 27, sal: 1.8 };

export interface NutricionImportada {
  kcal?: number | null;
  grasas?: number | null;
  grasas_saturadas?: number | null;
  azucares?: number | null;
  sal?: number | null;
}

export function avisosNutricion(n: NutricionImportada | null | undefined): string[] {
  if (!n) return [];
  const avisos: string[] = [];
  const v = (x: unknown) => (Number.isFinite(Number(x)) ? Number(x) : 0);
  if (v(n.kcal) > UMBRALES_RACION.kcal) avisos.push('muchas calorías');
  if (v(n.grasas) > UMBRALES_RACION.grasas) avisos.push('grasas');
  if (v(n.grasas_saturadas) > UMBRALES_RACION.grasas_saturadas) avisos.push('grasas saturadas');
  if (v(n.azucares) > UMBRALES_RACION.azucares) avisos.push('azúcar');
  if (v(n.sal) > UMBRALES_RACION.sal) avisos.push('sal');
  return avisos;
}

// "Tiene alto contenido en grasas y azúcar." / "Tiene muchas calorías y alto contenido en sal."
export function textoAvisos(avisos: string[]): string | null {
  if (!avisos.length) return null;
  const calorias = avisos.includes('muchas calorías');
  const resto = avisos.filter((a) => a !== 'muchas calorías');
  const lista = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`);
  if (calorias && resto.length) return `Tiene muchas calorías y alto contenido en ${lista(resto)}.`;
  if (calorias) return 'Tiene muchas calorías.';
  return `Tiene alto contenido en ${lista(resto)}.`;
}

export const MENSAJE_NO_VALIDA = 'La publicación que nos has enviado no está relacionada con alimentación o no comparte los valores de Yococino.';

// Dirección para enseñar el vídeo original dentro de la receta con el reproductor oficial de cada red
// (así el vídeo sigue siendo del creador y se ve con su nombre). null si no se puede.
export function embedDe(url: string, tiktokId?: string | null): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const p = plataformaDe(url);
  if (p === 'youtube') {
    const id = u.hostname === 'youtu.be' ? u.pathname.slice(1) : u.searchParams.get('v') ?? u.pathname.match(/\/(?:shorts|embed|live)\/([\w-]{6,})/)?.[1];
    return id && /^[\w-]{6,20}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  }
  if (p === 'tiktok') {
    const id = tiktokId ?? u.pathname.match(/\/video\/(\d{8,25})/)?.[1];
    return id && /^\d{8,25}$/.test(id) ? `https://www.tiktok.com/embed/v2/${id}` : null;
  }
  if (p === 'instagram') {
    const m = u.pathname.match(/\/(p|reel|reels|tv)\/([\w-]{5,40})/);
    return m ? `https://www.instagram.com/${m[1] === 'reels' ? 'reel' : m[1]}/${m[2]}/embed` : null;
  }
  return null;
}
