// Lo que la persona lleva hecho en cada receta (ingredientes y pasos marcados y temporizadores),
// para que no se pierda al salir de la receta, abrir otra o cerrar la app. Se guarda en el móvil
// y se olvida a las 12 horas sin tocar la receta.
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface TemporizadorGuardado {
  total: number; // segundos
  fin: number | null; // marca de tiempo en ms; null si está en pausa
  restante: number; // segundos que quedaban al pausar
  terminado: boolean;
}

export interface Cocinando {
  ingredientes: number[];
  pasos: number[];
  temporizadores: [number, TemporizadorGuardado][];
  cambiado: number; // ms
}

const CLAVE = 'cocinando';
const CADUCA_MS = 12 * 60 * 60 * 1000;
const memoria = new Map<number, Cocinando>();
let cargado: Promise<void> | null = null;

function cargarDelMovil(): Promise<void> {
  cargado ??= (async () => {
    try {
      const texto = await AsyncStorage.getItem(CLAVE);
      const datos = texto ? (JSON.parse(texto) as Record<string, Cocinando>) : {};
      for (const [id, c] of Object.entries(datos)) if (!memoria.has(Number(id))) memoria.set(Number(id), c);
    } catch {
      // Sin almacenamiento: se guarda solo mientras la app está abierta.
    }
  })();
  return cargado;
}
void cargarDelMovil();

function vigente(c: Cocinando | undefined): Cocinando | null {
  if (!c) return null;
  const enMarcha = c.temporizadores.some(([, t]) => !t.terminado);
  return enMarcha || Date.now() - c.cambiado < CADUCA_MS ? c : null;
}

// Lo guardado de una receta, al momento si ya está en memoria.
export function cocinandoAhora(recetaId: number): Cocinando | null {
  return vigente(memoria.get(recetaId));
}

// Lo guardado de una receta, esperando a leer el móvil (al abrir la app de cero).
export async function cocinandoGuardado(recetaId: number): Promise<Cocinando | null> {
  await cargarDelMovil();
  return vigente(memoria.get(recetaId));
}

export function guardarCocinando(recetaId: number, c: Omit<Cocinando, 'cambiado'>) {
  const vacio = !c.ingredientes.length && !c.pasos.length && !c.temporizadores.length;
  if (vacio) memoria.delete(recetaId);
  else memoria.set(recetaId, { ...c, cambiado: Date.now() });
  const datos: Record<string, Cocinando> = {};
  for (const [id, valor] of memoria) if (vigente(valor)) datos[id] = valor;
  AsyncStorage.setItem(CLAVE, JSON.stringify(datos)).catch(() => {});
}
