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
// la pantalla sube arriba del todo (src/lib/subirArriba.ts).
function Barra({ state }: PropsBarra) {
  const actual = state.routes[state.index]?.name;
  return (
    <BarraPestanas
      activa={PESTANAS.findIndex((p) => p.nombre === actual)}
      onPulsar={(nombre, yaActiva) => {
        if (yaActiva) avisarPestanaRepetida();
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
    <Tabs tabBar={(props) => <Barra {...props} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}>
      <Tabs.Screen name="inicio" options={{ title: 'Inicio' }} />
      <Tabs.Screen name="recetas" options={{ title: 'Recetas' }} />
      <Tabs.Screen name="compra" options={{ title: 'Compra' }} />
      <Tabs.Screen name="progreso" options={{ title: 'Progreso' }} />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil' }} />
    </Tabs>
  );
}
