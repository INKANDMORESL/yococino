// Barra inferior de la app (Inicio, Recetas, Compra, Progreso, Perfil). La usan las pestañas y también las
// pantallas que se abren encima (receta, menú, especial) para que el menú de abajo esté siempre a mano.
// Estilo de Mi Dieta: blanca, iconos de línea, verde oliva en la activa y una píldora verde claro.
import { useNavigation, router, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors } from '../theme';

export const PESTANAS = [
  { nombre: 'inicio', titulo: 'Inicio' },
  { nombre: 'recetas', titulo: 'Recetas' },
  { nombre: 'compra', titulo: 'Compra' },
  { nombre: 'progreso', titulo: 'Progreso' },
  { nombre: 'perfil', titulo: 'Perfil' },
] as const;

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

// activa: índice de la pestaña marcada (-1 = ninguna). onPulsar recibe el nombre de la pestaña.
export function BarraPestanas({ activa, onPulsar }: { activa: number; onPulsar: (nombre: string, yaActiva: boolean) => void }) {
  const insets = useSafeAreaInsets();
  const [ancho, setAncho] = useState(0);
  const pos = useRef(new Animated.Value(Math.max(activa, 0))).current;
  const n = PESTANAS.length;
  const hueco = ancho > 0 ? ancho / n : 0;

  useEffect(() => {
    if (activa < 0) return;
    Animated.timing(pos, { toValue: activa, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [activa, pos]);

  return (
    <View style={[s.barra, { paddingBottom: insets.bottom }]}>
      <View style={s.fila} onLayout={(e) => setAncho(e.nativeEvent.layout.width)} accessibilityRole="tablist">
        {hueco > 0 && activa >= 0 ? (
          <Animated.View
            style={[
              s.pildora,
              {
                pointerEvents: 'none',
                left: (hueco - PILDORA) / 2,
                transform: [{ translateX: pos.interpolate({ inputRange: [0, n - 1], outputRange: [0, hueco * (n - 1)] }) }],
              },
            ]}
          />
        ) : null}
        {PESTANAS.map((p, i) => {
          const esActiva = activa === i;
          const color = esActiva ? colors.olive : colors.muted;
          return (
            <Pressable
              key={p.nombre}
              onPress={() => onPulsar(p.nombre, esActiva)}
              accessibilityRole="tab"
              accessibilityState={{ selected: esActiva }}
              accessibilityLabel={p.titulo}
              style={s.pestana}
            >
              <View style={s.zonaIcono}>
                <Icono nombre={p.nombre} color={color} />
              </View>
              <Text style={[s.texto, { color }]} numberOfLines={1}>
                {p.titulo}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// Para las pantallas que se abren encima de las pestañas: marca la pestaña de la que se viene y,
// al pulsar cualquiera, vuelve a las pestañas en esa.
export function BarraPestanasSuelta() {
  const navigation = useNavigation();
  let activa = -1;
  try {
    const estado = navigation.getState();
    const pestanas = estado?.routes.find((r) => r.name === '(tabs)') as { state?: { index?: number; routes?: { name: string }[] } } | undefined;
    const ruta = pestanas?.state?.routes?.[pestanas.state.index ?? 0]?.name;
    activa = ruta ? PESTANAS.findIndex((p) => p.nombre === ruta) : -1;
  } catch {
    activa = -1;
  }
  return <BarraPestanas activa={activa} onPulsar={(nombre) => router.navigate(`/${nombre}` as Href)} />;
}

const s = StyleSheet.create({
  barra: { backgroundColor: 'rgba(255,255,255,0.97)', borderTopWidth: 1, borderTopColor: colors.line },
  fila: { flexDirection: 'row', height: 66 },
  pildora: { position: 'absolute', top: 7, width: PILDORA, height: 32, borderRadius: 16, backgroundColor: colors.leaf },
  pestana: { flex: 1, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 7, gap: 3 },
  zonaIcono: { height: 32, alignItems: 'center', justifyContent: 'center' },
  texto: { fontSize: 12, fontWeight: '600' },
});
