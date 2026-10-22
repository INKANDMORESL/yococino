const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const DIAS_CORTOS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const dos = (n: number) => String(n).padStart(2, '0');

export const aISO = (d: Date) => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
export const deISO = (s: string) => {
  const [a, m, d] = s.split('-').map(Number);
  return new Date(a, m - 1, d);
};
export const hoyISO = () => aISO(new Date());
export const sumarDias = (s: string, n: number) => {
  const d = deISO(s);
  d.setDate(d.getDate() + n);
  return aISO(d);
};

export const diaCorto = (s: string) => DIAS_CORTOS[deISO(s).getDay()];
export const numeroDia = (s: string) => deISO(s).getDate();

export function nombreDia(s: string): string {
  const hoy = hoyISO();
  if (s === hoy) return 'Hoy';
  if (s === sumarDias(hoy, 1)) return 'Mañana';
  const d = deISO(s);
  const dia = DIAS[d.getDay()];
  return `${dia.charAt(0).toUpperCase()}${dia.slice(1)} ${d.getDate()}`;
}

export function fechaLarga(s: string): string {
  const d = deISO(s);
  return `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`;
}
