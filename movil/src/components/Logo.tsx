import { StyleSheet, View } from 'react-native';
import { colors } from '../theme';

// Logotipo de Yococino: un cuenco con una hoja, dibujado con formas.
export function Logo({ tamano = 76 }: { tamano?: number }) {
  const k = tamano / 76;
  return (
    <View accessibilityRole="image" accessibilityLabel="Logotipo de Yococino" style={[s.fondo, { width: tamano, height: tamano, borderRadius: 22 * k }]}>
      <View style={[s.cuenco, { bottom: 18 * k, width: 44 * k, height: 22 * k, borderBottomLeftRadius: 22 * k, borderBottomRightRadius: 22 * k }]} />
      <View style={[s.hoja, { top: 16 * k, right: 22 * k, width: 16 * k, height: 24 * k, borderRadius: 12 * k }]} />
    </View>
  );
}

const s = StyleSheet.create({
  fondo: { backgroundColor: colors.olive, alignItems: 'center', justifyContent: 'center' },
  cuenco: { position: 'absolute', backgroundColor: colors.bg },
  hoja: { position: 'absolute', backgroundColor: colors.lemon, transform: [{ rotate: '20deg' }] },
});
