// Minúsculas, sin tildes ni signos. "Pimientos Rojos!" -> "pimientos rojos"
export const normalizar = (t: string) =>
  t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export const mayuscula = (t: string) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ¿Aparece el alimento en el texto como palabra entera, admitiendo plurales? "pimientos" encuentra "pimiento rojo".
export function contieneAlimento(texto: string, alimento: string): boolean {
  const t = normalizar(texto);
  const a = normalizar(alimento);
  const formas = new Set([a, a.replace(/es$/, ''), a.replace(/s$/, ''), a.replace(/ces$/, 'z')].filter((x) => x.length >= 3));
  return [...formas].some((f) => new RegExp(`(^| )${escapar(f)}(s|es)?( |$)`).test(t));
}
