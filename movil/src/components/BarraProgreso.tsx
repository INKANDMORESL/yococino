import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { colors, radius } from '../theme';

// Barra que se rellena con animación al avanzar de paso.
export function BarraProgreso({ actual, total }: { actual: number; total: number }) {
  const v = useRef(new Animated.Value(actual / total)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: actual / total, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [actual, total, v]);
  return (
    <View
      style={s.barra}
      accessibilityRole="progressbar"
      accessibilityLabel={`Paso ${actual} de ${total}`}
      accessibilityValue={{ min: 0, max: total, now: actual }}
    >
      <Animated.View style={[s.relleno, { width: v.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
    </View>
  );
}

const s = StyleSheet.create({
  barra: { flex: 1, height: 8, borderRadius: radius.pill, backgroundColor: '#EFEDE4', overflow: 'hidden' },
  relleno: { height: '100%', backgroundColor: colors.olive, borderRadius: radius.pill },
});
