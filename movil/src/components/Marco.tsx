// En tablet (y en la web en el ordenador) la app se ve en una columna centrada del ancho de un móvil grande,
// en lugar de estirarse a toda la pantalla: así los textos, las fotos y la barra de abajo mantienen su tamaño.
import type { ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { colors } from '../theme';

export const ANCHO_MAXIMO = 680;

export function Marco({ children }: { children: ReactNode }) {
  const { width } = useWindowDimensions();
  if (width <= ANCHO_MAXIMO + 40) return <View style={s.lleno}>{children}</View>;
  return (
    <View style={s.fondo}>
      <View style={s.columna}>{children}</View>
    </View>
  );
}

const s = StyleSheet.create({
  lleno: { flex: 1 },
  fondo: { flex: 1, backgroundColor: '#EDE6D8', alignItems: 'center' },
  columna: {
    flex: 1,
    width: '100%',
    maxWidth: ANCHO_MAXIMO,
    backgroundColor: colors.bg,
    overflow: 'hidden',
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.08)',
  },
});
