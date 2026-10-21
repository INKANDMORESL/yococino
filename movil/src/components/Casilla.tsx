import type { ReactNode } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, space, type } from '../theme';
import { useLatido } from './Animaciones';

// Casilla de verificación con texto (para consentimientos).
export function Casilla({ marcada, onPress, children }: { marcada: boolean; onPress: () => void; children: ReactNode }) {
  const escala = useLatido(marcada);
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: marcada }} onPress={onPress} style={s.fila}>
      <Animated.View style={[s.caja, marcada && s.marcada, { transform: [{ scale: escala }] }]}>
        {marcada ? <Text style={s.check}>✓</Text> : null}
      </Animated.View>
      <View style={{ flex: 1 }}>
        <Text style={[type.body, { color: colors.ink }]}>{children}</Text>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  fila: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  caja: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: '#D5D2C6', alignItems: 'center', justifyContent: 'center', marginTop: 1, backgroundColor: colors.surface },
  marcada: { backgroundColor: colors.olive, borderColor: colors.olive },
  check: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
