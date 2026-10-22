// Aviso de progreso mientras se completan los 30 días.
import { StyleSheet, Text, View } from 'react-native';
import { BarraProgreso } from '../../components';
import { colors, radius, space } from '../../theme';

export function PreparandoMenu({ listos, total }: { listos: number; total: number }) {
  return (
    <View style={s.caja} accessibilityLiveRegion="polite">
      <View style={s.fila}>
        <Text style={s.titulo}>👩‍🍳 Preparando tu mes</Text>
        <Text style={s.cuenta}>
          {listos} de {total} días
        </Text>
      </View>
      <View style={{ flexDirection: 'row' }}>
        <BarraProgreso actual={Math.max(listos, 0.5)} total={total} />
      </View>
      <Text style={s.nota}>Puedes ir mirando los días que ya están listos.</Text>
    </View>
  );
}

const s = StyleSheet.create({
  caja: { backgroundColor: colors.leafSoft, borderRadius: radius.md, padding: space.lg, gap: space.sm },
  fila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  titulo: { fontSize: 15, fontWeight: '700', color: colors.ink },
  cuenta: { fontSize: 14, fontWeight: '600', color: colors.oliveInk },
  nota: { fontSize: 13, color: colors.ink2 },
});
