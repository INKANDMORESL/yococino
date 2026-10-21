import { Animated, StyleSheet, Text } from 'react-native';
import { colors, radius, space, type } from '../theme';
import { Aparecer } from './Animaciones';

// Mensaje destacado. Con `x` (de useSacudida) se agita para señalar un error.
export function Aviso({ texto, tono = 'limon', x }: { texto: string; tono?: 'limon' | 'mar' | 'rosa' | 'hoja'; x?: Animated.Value }) {
  const bg = { limon: colors.lemonSoft, mar: colors.seaSoft, rosa: colors.roseSoft, hoja: colors.leafSoft }[tono];
  return (
    <Aparecer desde={8} duracion={260}>
      <Animated.View style={[s.aviso, { backgroundColor: bg }, x ? { transform: [{ translateX: x }] } : null]} accessibilityRole="alert" accessibilityLiveRegion="polite">
        <Text style={[type.body, { color: colors.ink }]}>{texto}</Text>
      </Animated.View>
    </Aparecer>
  );
}

const s = StyleSheet.create({
  aviso: { borderRadius: radius.md, padding: space.lg },
});
