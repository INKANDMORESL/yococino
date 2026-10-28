// Pestañas principales: Inicio, Recetas, Compra, Progreso y Perfil. Solo con sesión iniciada.
import { Redirect, Tabs, router, usePathname, type Href } from 'expo-router';
import { Platform } from 'react-native';
import { useEffect, useRef, type ComponentProps } from 'react';
import { BarraPestanas, PESTANAS } from '../../src/components/BarraPestanas';
import { useAuth } from '../../src/lib/auth';
import { avisarPestanaRepetida } from '../../src/lib/subirArriba';
import { tutorialVisto } from '../../src/lib/tutorial';
import { colors } from '../../src/theme';

type PropsBarra = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

// La barra (dibujada en src/components/BarraPestanas.tsx). Al tocar la pestaña en la que ya estás,
// la pantalla sube arriba del todo (src/lib/subirArriba.ts). Desde una receta, vuelve a esa pestaña.
function Barra({ state }: PropsBarra) {
  // En una receta, el menú completo o un especial (pantallas sin pestaña propia) sigue marcada la pestaña de la que se viene.
  const ultima = useRef(0);
  const actual = PESTANAS.findIndex((p) => p.nombre === state.routes[state.index]?.name);
  if (actual >= 0) ultima.current = actual;
  return (
    <BarraPestanas
      activa={ultima.current}
      onPulsar={(nombre, yaActiva) => {
        if (yaActiva && actual >= 0) avisarPestanaRepetida();
        else router.navigate(`/${nombre}` as Href);
      }}
    />
  );
}

// En la web, el navegador (o el acceso directo de la pantalla de inicio del móvil) recuerda la última dirección,
// por ejemplo /perfil. Al abrir la app de cero se empieza siempre en Inicio.
let recienAbierta = Platform.OS === 'web';

export default function Pestanas() {
  const { sesion, cargando, recuperando } = useAuth();
  const ruta = usePathname();
  const empezarEnInicio = recienAbierta && ruta !== '/inicio';
  recienAbierta = false;

  // Paso a paso de la primera vez: en cuanto hay sesión, si en este dispositivo aún no se ha visto.
  const comprobado = useRef(false);
  useEffect(() => {
    if (!sesion || comprobado.current) return;
    comprobado.current = true;
    let t: ReturnType<typeof setTimeout> | undefined;
    tutorialVisto().then((visto) => {
      if (!visto) t = setTimeout(() => router.push('/tutorial'), 400);
    });
    return () => clearTimeout(t);
  }, [sesion]);

  if (!cargando && !sesion) return <Redirect href="/" />;
  if (sesion && recuperando) return <Redirect href="/nueva-contrasena" />;
  if (empezarEnInicio) return <Redirect href="/inicio" />;

  return (
    <Tabs tabBar={(props) => <Barra {...props} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}>
      <Tabs.Screen name="inicio" options={{ title: 'Inicio' }} />
      <Tabs.Screen name="recetas" options={{ title: 'Recetas' }} />
      <Tabs.Screen name="compra" options={{ title: 'Compra' }} />
      <Tabs.Screen name="progreso" options={{ title: 'Progreso' }} />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil' }} />
    </Tabs>
  );
}
