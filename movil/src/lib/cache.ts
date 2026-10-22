// Memoria de la última carga de cada pantalla (solo mientras la app está abierta).
// Al volver a una pantalla se enseña al instante lo último que se vio y se actualiza por detrás.
const datos = new Map<string, unknown>();

export const leerCache = <T>(clave: string): T | undefined => datos.get(clave) as T | undefined;
export const guardarCache = <T>(clave: string, valor: T): T => {
  datos.set(clave, valor);
  return valor;
};
export const vaciarCache = () => datos.clear();
