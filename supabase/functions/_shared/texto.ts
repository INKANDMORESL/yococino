// Utilidades de texto compartidas. Sin dependencias: se usan en el servidor y en las pruebas.

// Minúsculas, sin tildes ni signos, con espacios simples. "Pimientos Rojos!" -> "pimientos rojos"
export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ¿Aparece la palabra (o expresión) en el texto, como palabra entera y admitiendo plural?
// "pan" coincide con "pan integral" y "panes", pero no con "panceta".
export function contienePalabra(texto: string, palabra: string): boolean {
  const t = normalizar(texto);
  const p = normalizar(palabra);
  if (!p) return false;
  return new RegExp(`(^| )${escapar(p)}(s|es)?( |$)`).test(t);
}

// Formas posibles en singular de lo que escribe el usuario: "coliflores" -> coliflores, coliflore, coliflor.
// Junto con contienePalabra (que admite plurales), así "aguacates", "nueces" o "pimientos" encuentran su ingrediente.
export function variantes(palabra: string): string[] {
  const p = normalizar(palabra);
  const v = new Set<string>([p]);
  if (p.endsWith('ces') && p.length > 4) v.add(p.slice(0, -3) + 'z');
  if (p.endsWith('es') && p.length > 4) v.add(p.slice(0, -2));
  if (p.endsWith('s') && p.length > 3) v.add(p.slice(0, -1));
  return [...v].filter((x) => x.length >= 3);
}

// ¿Aparece en el texto alguna de las formas de la palabra del usuario?
export function contieneAlimento(texto: string, palabraUsuario: string): boolean {
  return variantes(palabraUsuario).some((v) => contienePalabra(texto, v));
}

// Nombre de plato limpio para enseñar: quita las notas internas entre paréntesis que a veces añade la IA
// o el sistema, como "(sin pescado)", "(sin gluten)" o "(variante 2)". "Pollo al horno (sin pescado)" -> "Pollo al horno"
export function limpiarNombre(nombre: string): string {
  return nombre
    .replace(/\s*\((?:sin|apt[oa]s?|variante|version|versión|para)\b[^)]*\)/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
