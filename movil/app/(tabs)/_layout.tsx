// Pestañas principales: Hoy, Compra, Progreso y Perfil. Solo con sesión iniciada.
// Barra propia: flotante, redondeada, solo texto, con una píldora que se desliza hasta la pestaña activa.
import { Redirect, Tabs, router, type Href } from 'expo-router';
import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/lib/auth';
import { colors, radius } from '../../src/theme';

type PropsBarra = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

function Barra({ state, descriptors }: PropsBarra) {
  const insets = useSafeAreaInsets();
  const [ancho, setAncho] = useState(0);
  const pos = useRef(new Animated.Value(state.index)).current;
  const n = state.routes.length;
  const hueco = ancho > 0 ? (ancho - RELLENO * 2) / n : 0;

  useEffect(() => {
    Animated.spring(pos, { toValue: state.index, useNativeDriver: true, speed: 18, bounciness: 6 }).start();
  }, [state.index, pos]);

  return (
    <View style={[s.fondo, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={s.barra} onLayout={(e) => setAncho(e.nativeEvent.layout.width)} accessibilityRole="tablist">
        {hueco > 0 ? (
          <Animated.View
            style={[
              s.pildora,
              {
                pointerEvents: 'none',
                width: hueco,
                transform: [{ translateX: pos.interpolate({ inputRange: [0, Math.max(n - 1, 1)], outputRange: [0, hueco * Math.max(n - 1, 1)] }) }],
              },
            ]}
          />
        ) : null}
        {state.routes.map((ruta, i) => {
          const activa = state.index === i;
          const { options } = descriptors[ruta.key];
          const texto = typeof options.title === 'string' ? options.title : ruta.name;
          const pulsar = () => {
            if (!activa) router.navigate(`/${ruta.name}` as Href);
          };
          return (
            <Pressable
              key={ruta.key}
              onPress={pulsar}
              accessibilityRole="tab"
              accessibilityState={{ selected: activa }}
              accessibilityLabel={texto}
              style={s.pestana}
            >
              <Text style={[s.texto, activa && s.textoActivo]} numberOfLines={1}>
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
  const { sesion, cargando } = useAuth();
  if (!cargando && !sesion) return <Redirect href="/" />;

  return (
    <Tabs tabBar={(props) => <Barra {...props} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}>
      <Tabs.Screen name="inicio" options={{ title: 'Hoy' }} />
      <Tabs.Screen name="compra" options={{ title: 'Compra' }} />
      <Tabs.Screen name="progreso" options={{ title: 'Progreso' }} />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil' }} />
    </Tabs>
  );
}

const RELLENO = 6;

const s = StyleSheet.create({
  fondo: { backgroundColor: colors.bg, paddingHorizontal: 16, paddingTop: 8 },
  barra: {
    flexDirection: 'row',
    height: 60,
    padding: RELLENO,
    borderRadius: radius.pill,
    backgroundColor: colors.ink,
    shadowColor: '#1D2A23',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  pildora: { position: 'absolute', top: RELLENO, bottom: RELLENO, left: RELLENO, borderRadius: radius.pill, backgroundColor: colors.lemon },
  pestana: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  texto: { fontSize: 15, fontWeight: '700', color: 'rgba(255,255,255,0.72)', letterSpacing: 0.2 },
  textoActivo: { color: colors.ink },
});
