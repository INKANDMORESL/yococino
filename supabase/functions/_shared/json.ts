// Utilidades de JSON sin dependencias (se prueban en reglas_test.ts).

// Arregla un JSON cortado: quita lo que sobra al final (espacios) o se queda con lo último que se cerró completo
// dentro de una lista y cierra lo que falte. Devuelve null si no se puede aprovechar nada.
export function repararJSON(texto: string): unknown | null {
  const t = texto.trimEnd();
  try {
    return JSON.parse(t);
  } catch {
    // sigue
  }
  const pila: string[] = [];
  let enCadena = false;
  let escape = false;
  let corte = -1;
  let cierre: string[] = [];
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (enCadena) {
      if (escape) escape = false;
      else if (ch === '\\') escape = true;
      else if (ch === '"') enCadena = false;
      continue;
    }
    if (ch === '"') enCadena = true;
    else if (ch === '{') pila.push('}');
    else if (ch === '[') pila.push(']');
    else if (ch === '}' || ch === ']') {
      pila.pop();
      if (pila.at(-1) === ']') {
        corte = i + 1;
        cierre = [...pila].reverse();
      }
    }
  }
  if (corte < 0) return null;
  try {
    return JSON.parse(t.slice(0, corte) + cierre.join(''));
  } catch {
    return null;
  }
}
