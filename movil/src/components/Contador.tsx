import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, space, type } from '../theme';

// Selector − número + (comensales, raciones…).
export function Contador({ texto, valor, min, max, cambiar }: { texto: string; valor: number; min: number; max: number; cambiar: (v: number) => void }) {
  return (
    <View style={s.fila}>
      <Text style={[type.body, { flex: 1, color: colors.ink }]}>{texto}</Text>
      <Pressable
        onPress={() => valor > min && cambiar(valor - 1)}
        disabled={valor <= min}
        accessibilityRole="button"
        accessibilityLabel={`Quitar uno: ${texto}`}
        style={[s.boton, valor <= min && { opacity: 0.35 }]}
      >
        <Text style={s.botonTexto}>−</Text>
      </Pressable>
      <Text style={s.valor} accessibilityLiveRegion="polite">
        {valor}
      </Text>
      <Pressable
        onPress={() => valor < max && cambiar(valor + 1)}
        disabled={valor >= max}
        accessibilityRole="button"
        accessibilityLabel={`Añadir uno: ${texto}`}
        style={[s.boton, valor >= max && { opacity: 0.35 }]}
      >
        <Text style={s.botonTexto}>+</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  boton: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.leaf, alignItems: 'center', justifyContent: 'center' },
  botonTexto: { fontSize: 22, fontWeight: '700', color: colors.oliveInk, lineHeight: 24 },
  valor: { fontSize: 20, fontWeight: '800', color: colors.ink, minWidth: 28, textAlign: 'center' },
});
