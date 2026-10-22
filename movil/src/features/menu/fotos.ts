// Cola de fotos de platos para toda la app: una petición a la vez, nunca dos veces la misma receta
// por sesión, y si las fotos no están activadas en el servidor se deja de pedir. Así las pantallas no
// se llenan de peticiones repetidas que frenan la app.
import { fotoReceta, type FotoReceta } from './api';

const pedidas = new Map<number, Promise<FotoReceta | null>>();
let desactivadas = false;
let cola: Promise<unknown> = Promise.resolve();

export function pedirFoto(recetaId: number): Promise<FotoReceta | null> {
  if (desactivadas) return Promise.resolve(null);
  const previa = pedidas.get(recetaId);
  if (previa) return previa;
  const promesa = cola.then(async () => {
    if (desactivadas) return null;
    const r = await fotoReceta(recetaId).catch(() => null);
    if (r?.desactivadas) desactivadas = true;
    return r?.imagen ? r : null;
  });
  cola = promesa.catch(() => null);
  pedidas.set(recetaId, promesa);
  return promesa;
}

// ¿Hace falta pedirla? Si no tiene foto o le falta la miniatura ligera.
export const faltaFoto = (r: { imagen?: string | null; imagen_mini?: string | null } | null | undefined) => !!r && (!r.imagen || !r.imagen_mini);

// Foto para listas y tarjetas pequeñas: la miniatura si existe.
export const fotoPequena = (r: { imagen?: string | null; imagen_mini?: string | null } | null | undefined) => r?.imagen_mini ?? r?.imagen ?? null;
