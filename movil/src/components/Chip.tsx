import { Animated, Pressable, StyleSheet, Text } from 'react-native';
import { colors, radius } from '../theme';
import { useLatido } from './Animaciones';

// Etiqueta seleccionable (selección múltiple).
export function Chip({ texto, elegido, onPress, quitar = false }: { texto: string; elegido: boolean; onPress: () => void; quitar?: boolean }) {
  const escala = useLatido(elegido);
  return (
    <Animated.View style={{ transform: [{ scale: escala }] }}>
      <Pressable
        accessibilityRole={quitar ? 'button' : 'checkbox'}
        accessibilityLabel={quitar ? `Quitar ${texto}` : texto}
        accessibilityState={quitar ? undefined : { checked: elegido }}
        onPress={onPress}
        style={[s.chip, elegido && s.elegido]}
      >
        <Text style={[s.texto, elegido && { color: '#fff' }]}>
          {elegido && !quitar ? '✓ ' : ''}
          {texto}
          {quitar ? '  ×' : ''}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  chip: { paddingVertical: 10, paddingHorizontal: 15, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.line },
  elegido: { backgroundColor: colors.ink, borderColor: colors.ink },
  texto: { fontSize: 15, fontWeight: '600', color: colors.ink2 },
});
