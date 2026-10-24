// En la web no se reciben enlaces compartidos desde otras apps: el enlace llega pegándolo en Mis recetas.
export function useEnlaceCompartido(): { valores: string[]; limpiar: () => void } {
  return { valores: [], limpiar: () => {} };
}
