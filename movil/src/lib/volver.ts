// Volver atrás de forma segura: si no hay pantalla anterior (por ejemplo, al recargar la web), va a Inicio.
import { router, type Href } from 'expo-router';

export function volver(destino: Href = '/inicio') {
  if (router.canGoBack()) router.back();
  else router.replace(destino);
}
