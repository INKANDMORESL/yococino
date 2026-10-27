// Pestañas principales: Inicio, Recetas, Compra, Progreso y Perfil. Solo con sesión iniciada.
import { Redirect, Tabs, router, type Href } from 'expo-router';
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

export default function Pestanas() {
  const { sesion, cargando, recuperando } = useAuth();

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

  return (
    <Tabs backBehavior="history" tabBar={(props) => <Barra {...props} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}>
      <Tabs.Screen name="inicio" options={{ title: 'Inicio' }} />
      <Tabs.Screen name="recetas" options={{ title: 'Recetas' }} />
      <Tabs.Screen name="compra" options={{ title: 'Compra' }} />
      <Tabs.Screen name="progreso" options={{ title: 'Progreso' }} />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil' }} />
      {/* Pantallas que se abren desde las pestañas: la barra de abajo se queda quieta (no se recarga). */}
      <Tabs.Screen name="receta/[id]" options={{ href: null }} />
      <Tabs.Screen name="menu" options={{ href: null }} />
      <Tabs.Screen name="especial" options={{ href: null }} />
    </Tabs>
  );
}
