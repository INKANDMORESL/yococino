// Componentes visuales básicos de Yococino.
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import { colors, radius, shadow, space, type } from '../theme';

export function Boton({
  texto,
  onPress,
  variante = 'principal',
  desactivado = false,
}: {
  texto: string;
  onPress: () => void;
  variante?: 'principal' | 'suave' | 'linea';
  desactivado?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: desactivado }}
      disabled={desactivado}
      onPress={onPress}
      style={({ pressed }) => [
        s.boton,
        variante === 'principal' && s.botonPrincipal,
        variante === 'suave' && s.botonSuave,
        variante === 'linea' && s.botonLinea,
        desactivado && { opacity: 0.45 },
        pressed && { transform: [{ scale: 0.98 }] },
      ]}
    >
      <Text style={[s.botonTexto, variante !== 'principal' && { color: colors.oliveInk }]}>{texto}</Text>
    </Pressable>
  );
}

export function Tarjeta({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[s.tarjeta, style]}>{children}</View>;
}

export function Opcion({
  texto,
  detalle,
  elegida,
  onPress,
}: {
  texto: string;
  detalle?: string;
  elegida: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: elegida }}
      onPress={onPress}
      style={[s.opcion, elegida && s.opcionElegida]}
    >
      <View style={[s.radio, elegida && s.radioElegido]}>{elegida ? <View style={s.radioPunto} /> : null}</View>
      <View style={{ flex: 1 }}>
        <Text style={s.opcionTexto}>{texto}</Text>
        {detalle ? <Text style={s.opcionDetalle}>{detalle}</Text> : null}
      </View>
    </Pressable>
  );
}

export function Chip({ texto, elegido, onPress }: { texto: string; elegido: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: elegido }}
      onPress={onPress}
      style={[s.chip, elegido && s.chipElegido]}
    >
      <Text style={[s.chipTexto, elegido && { color: '#fff' }]}>{elegido ? `✓ ${texto}` : texto}</Text>
    </Pressable>
  );
}

export function Campo({ etiqueta, sufijo, ...props }: TextInputProps & { etiqueta: string; sufijo?: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={[type.label, { marginBottom: space.sm, marginLeft: space.xs }]}>{etiqueta}</Text>
      <View style={s.campo}>
        <TextInput placeholderTextColor={colors.muted} style={s.campoInput} accessibilityLabel={etiqueta} {...props} />
        {sufijo ? <Text style={s.campoSufijo}>{sufijo}</Text> : null}
      </View>
    </View>
  );
}

export function Aviso({ texto, tono = 'limon' }: { texto: string; tono?: 'limon' | 'mar' | 'rosa' }) {
  const bg = tono === 'mar' ? colors.seaSoft : tono === 'rosa' ? colors.roseSoft : colors.lemonSoft;
  return (
    <View style={[s.aviso, { backgroundColor: bg }]} accessibilityRole="alert">
      <Text style={[type.body, { color: colors.ink }]}>{texto}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  boton: {
    minHeight: 54,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xl,
  },
  botonPrincipal: { backgroundColor: colors.olive },
  botonSuave: { backgroundColor: colors.leaf },
  botonLinea: { borderWidth: 1.5, borderColor: colors.line, backgroundColor: 'transparent' },
  botonTexto: { color: '#fff', fontSize: 17, fontWeight: '700' },
  tarjeta: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg, ...shadow },
  opcion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.line,
  },
  opcionElegida: { borderColor: colors.olive, backgroundColor: colors.leafSoft },
  opcionTexto: { fontSize: 17, fontWeight: '600', color: colors.ink },
  opcionDetalle: { fontSize: 14, color: colors.muted, marginTop: 2 },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D5D2C6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioElegido: { borderColor: colors.olive },
  radioPunto: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.olive },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.line,
  },
  chipElegido: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipTexto: { fontSize: 15, fontWeight: '600', color: colors.ink2 },
  campo: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: space.lg,
  },
  campoInput: { flex: 1, fontSize: 20, fontWeight: '600', color: colors.ink, paddingVertical: space.md },
  campoSufijo: { fontSize: 16, color: colors.muted, fontWeight: '600' },
  aviso: { borderRadius: radius.md, padding: space.lg },
});
