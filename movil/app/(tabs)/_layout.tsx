// Pestañas principales: Inicio, Recetas, Compra, Progreso y Perfil. Solo con sesión iniciada.
// Barra con el estilo de Mi Dieta (blanca, iconos de línea, verde oliva en la activa) y una píldora
// verde claro que se desliza hasta la pestaña activa.
import { Redirect, Tabs, router, type Href } from 'expo-router';
import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { useAuth } from '../../src/lib/auth';
import { tutorialVisto } from '../../src/lib/tutorial';
import { colors } from '../../src/theme';

type PropsBarra = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const PILDORA = 58;

// Iconos de línea (los mismos trazos que en Mi Dieta).
function Icono({ nombre, color }: { nombre: string; color: string }) {
  const p = { stroke: color, strokeWidth: 1.8, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
      {nombre === 'inicio' ? <Path {...p} d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /> : null}
      {nombre === 'recetas' ? <Path {...p} d="M12 6.5C10 5 7 4.5 3.5 5v14c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5zM12 6.5V20" /> : null}
      {nombre === 'compra' ? (
        <>
          <Path {...p} d="M3 4h2.2l2.3 10.6a1.2 1.2 0 0 0 1.2.9h8.6a1.2 1.2 0 0 0 1.2-.9L20.5 8H6.1" />
          <Circle {...p} cx={9.5} cy={19.5} r={1.4} />
          <Circle {...p} cx={17} cy={19.5} r={1.4} />
        </>
      ) : null}
      {nombre === 'progreso' ? (
        <>
          <Path {...p} d="M3.5 19.5h17M5 15l4.5-4.5 3.5 3L19.5 7" />
          <Path {...p} d="M15.5 7h4v4" />
        </>
      ) : null}
      {nombre === 'perfil' ? (
        <>
          <Circle {...p} cx={12} cy={8.5} r={3.8} />
          <Path {...p} d="M4.5 20.5c1.2-3.6 4.2-5.6 7.5-5.6s6.3 2 7.5 5.6" />
        </>
      ) : null}
    </Svg>
  );
}

function Barra({ state, descriptors }: PropsBarra) {
  const insets = useSafeAreaInsets();
  const [ancho, setAncho] = useState(0);
  const pos = useRef(new Animated.Value(state.index)).current;
  const n = state.routes.length;
  const hueco = ancho > 0 ? ancho / n : 0;

  useEffect(() => {
    Animated.timing(pos, { toValue: state.index, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [state.index, pos]);

  return (
    <View style={[s.barra, { paddingBottom: insets.bottom }]}>
      <View style={s.fila} onLayout={(e) => setAncho(e.nativeEvent.layout.width)} accessibilityRole="tablist">
        {hueco > 0 ? (
          <Animated.View
            style={[
              s.pildora,
              {
                pointerEvents: 'none',
                left: (hueco - PILDORA) / 2,
                transform: [{ translateX: pos.interpolate({ inputRange: [0, Math.max(n - 1, 1)], outputRange: [0, hueco * Math.max(n - 1, 1)] }) }],
              },
            ]}
          />
        ) : null}
        {state.routes.map((ruta, i) => {
          const activa = state.index === i;
          const { options } = descriptors[ruta.key];
          const texto = typeof options.title === 'string' ? options.title : ruta.name;
          const color = activa ? colors.olive : colors.muted;
          return (
            <Pressable
              key={ruta.key}
              onPress={() => {
                if (!activa) router.navigate(`/${ruta.name}` as Href);
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: activa }}
              accessibilityLabel={texto}
              style={s.pestana}
            >
              <View style={s.zonaIcono}>
                <Icono nombre={ruta.name} color={color} />
              </View>
              <Text style={[s.texto, { color }]} numberOfLines={1}>
                {texto}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
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

const s = StyleSheet.create({
  barra: { backgroundColor: 'rgba(255,255,255,0.97)', borderTopWidth: 1, borderTopColor: colors.line },
  fila: { flexDirection: 'row', height: 66 },
  pildora: { position: 'absolute', top: 7, width: PILDORA, height: 32, borderRadius: 16, backgroundColor: colors.leaf },
  pestana: { flex: 1, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 7, gap: 3 },
  zonaIcono: { height: 32, alignItems: 'center', justifyContent: 'center' },
  texto: { fontSize: 12, fontWeight: '600' },
});
