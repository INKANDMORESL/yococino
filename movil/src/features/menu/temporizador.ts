// Detecta tiempos de espera en el texto de un paso ("Hornea 20 minutos", "cuece 8-10 min", "media hora").

export interface TiempoPaso {
  segundos: number;
  texto: string; // cómo se muestra en el botón: "20 min", "1 h 30 min"
}

const normalizar = (t: string) =>
  t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

const NUMEROS: Record<string, number> = { un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, quince: 15, veinte: 20, treinta: 30 };

export function textoTiempo(segundos: number): string {
  if (segundos < 60) return `${segundos} s`;
  const h = Math.floor(segundos / 3600);
  const m = Math.round((segundos % 3600) / 60);
  if (h && m) return `${h} h ${m} min`;
  if (h) return `${h} h`;
  return `${m} min`;
}

const valor = (v: string) => NUMEROS[v] ?? parseFloat(v.replace(',', '.'));

export function tiempoDelPaso(paso: string): TiempoPaso | null {
  const t = normalizar(paso);
  let segundos = 0;

  // Expresiones habituales.
  if (/hora y media/.test(t)) segundos = 90 * 60;
  else if (/media hora/.test(t)) segundos = 30 * 60;
  else if (/(un )?cuarto de hora/.test(t)) segundos = 15 * 60;
  else {
    // "20 minutos", "8-10 min", "8 a 10 minutos", "1 hora", "2 h", "30 segundos". En un rango se toma el mayor.
    // El número tiene que ser una palabra entera («unos minutos» no es «uno» + «s»). Si un paso tiene varios
    // tiempos («Deja templar unos minutos… cocínalo 5 minutos»), se usa el primero que tenga un número de verdad.
    const num = '(\\d+(?:[.,]\\d+)?|un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|quince|veinte|treinta)';
    const re = new RegExp(`(?:^|[^a-z0-9])${num}(?:\\s*(?:-|–|a|o)\\s*${num})?\\s*(horas?|h|minutos?|min|segundos?|seg|s)(?![a-z])`, 'g');
    for (const m of t.matchAll(re)) {
      const cantidad = Math.max(valor(m[1]), m[2] ? valor(m[2]) : 0);
      if (!Number.isFinite(cantidad) || cantidad <= 0) continue;
      const unidad = m[3];
      // Una «s» suelta solo cuenta como segundos detrás de una cifra («30 s»), no de una palabra.
      if (unidad === 's' && !/^\d/.test(m[1])) continue;
      const por = unidad.startsWith('h') ? 3600 : unidad.startsWith('m') ? 60 : 1;
      let s = Math.round(cantidad * por);
      // "1 hora y 15 minutos"
      if (por === 3600) {
        const extra = t.slice((m.index ?? 0) + m[0].length).match(/^\s*y\s*(\d+)\s*(minutos?|min)/);
        if (extra) s += Number(extra[1]) * 60;
      }
      if (s >= 10 && s <= 12 * 3600) {
        segundos = s;
        break;
      }
    }
    if (!segundos) return null;
  }
  if (segundos < 10 || segundos > 12 * 3600) return null;
  return { segundos, texto: textoTiempo(segundos) };
}

export const relojTexto = (segundos: number) => {
  const s = Math.max(0, Math.ceil(segundos));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
};
