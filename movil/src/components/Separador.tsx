import { StyleSheet, Text, View } from 'react-native';
import { colors, space, type } from '../theme';

// Línea con texto en medio, por ejemplo "o".
export function Separador({ texto }: { texto: string }) {
  return (
    <View style={s.fila}>
      <View style={s.linea} />
      <Text style={type.small}>{texto}</Text>
      <View style={s.linea} />
    </View>
  );
}

const s = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  linea: { flex: 1, height: 1, backgroundColor: colors.line },
});
