import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, space } from '../theme';
import { useLatido } from './Animaciones';

// Opción de respuesta única (como un botón de radio grande).
export function Opcion({ texto, detalle, elegida, onPress }: { texto: string; detalle?: string; elegida: boolean; onPress: () => void }) {
  const escala = useLatido(elegida);
  return (
    <Animated.View style={{ transform: [{ scale: escala }] }}>
      <Pressable
        accessibilityRole="radio"
        accessibilityState={{ selected: elegida }}
        onPress={onPress}
        style={[s.opcion, elegida && s.elegida]}
      >
        <View style={[s.radio, elegida && s.radioElegido]}>{elegida ? <View style={s.punto} /> : null}</View>
        <View style={{ flex: 1 }}>
          <Text style={s.texto}>{texto}</Text>
          {detalle ? <Text style={s.detalle}>{detalle}</Text> : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  opcion: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.line },
  elegida: { borderColor: colors.olive, backgroundColor: colors.leafSoft },
  texto: { fontSize: 17, fontWeight: '600', color: colors.ink },
  detalle: { fontSize: 14, color: colors.muted, marginTop: 2 },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#D5D2C6', alignItems: 'center', justifyContent: 'center' },
  radioElegido: { borderColor: colors.olive },
  punto: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.olive },
});
