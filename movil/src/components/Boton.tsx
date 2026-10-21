import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, space } from '../theme';
import { usePulsacion } from './Animaciones';

type Variante = 'principal' | 'suave' | 'linea' | 'google';

export function Boton({
  texto,
  onPress,
  variante = 'principal',
  desactivado = false,
  cargando = false,
  icono,
}: {
  texto: string;
  onPress: () => void;
  variante?: Variante;
  desactivado?: boolean;
  cargando?: boolean;
  icono?: string;
}) {
  const { escala, entrar, salir } = usePulsacion();
  const bloqueado = desactivado || cargando;
  const colorTexto = variante === 'principal' ? '#fff' : variante === 'google' ? colors.ink : colors.oliveInk;
  return (
    <Animated.View style={{ transform: [{ scale: escala }] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={texto}
        accessibilityState={{ disabled: bloqueado, busy: cargando }}
        disabled={bloqueado}
        onPress={onPress}
        onPressIn={entrar}
        onPressOut={salir}
        style={[s.base, s[variante], bloqueado && { opacity: 0.5 }]}
      >
        {cargando ? (
          <ActivityIndicator color={colorTexto} />
        ) : (
          <View style={s.fila}>
            {icono ? <Text style={[s.icono, { color: colorTexto }]}>{icono}</Text> : null}
            <Text style={[s.texto, { color: colorTexto }]}>{texto}</Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  base: { minHeight: 54, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl },
  principal: { backgroundColor: colors.olive },
  suave: { backgroundColor: colors.leaf },
  linea: { borderWidth: 1.5, borderColor: colors.line, backgroundColor: 'transparent' },
  google: { borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.surface },
  fila: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  icono: { fontSize: 18, fontWeight: '800' },
  texto: { fontSize: 17, fontWeight: '700' },
});
