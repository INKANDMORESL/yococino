// Cuando alguien comparte un enlace con Yococino desde otra app (TikTok, Instagram…), el sistema abre la app
// con una dirección de «expo-sharing»: se lleva a la pantalla que guarda la receta.
export async function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    const url = new URL(path, 'yococino://app');
    if (url.hostname === 'expo-sharing') return '/importar';
    return path;
  } catch {
    return '/';
  }
}
