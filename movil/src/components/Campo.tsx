import { useState } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { colors, radius, space, type } from '../theme';

// Campo de texto con etiqueta y unidad opcional (kg, cm, años).
export function Campo({ etiqueta, sufijo, grande = true, ...props }: TextInputProps & { etiqueta: string; sufijo?: string; grande?: boolean }) {
  const [foco, setFoco] = useState(false);
  return (
    <View style={{ flex: 1 }}>
      <Text style={[type.label, s.etiqueta]}>{etiqueta}</Text>
      <View style={[s.caja, foco && s.foco]}>
        <TextInput
          placeholderTextColor={colors.muted}
          accessibilityLabel={etiqueta}
          style={[s.input, !grande && s.inputNormal]}
          {...props}
          onFocus={(e) => {
            setFoco(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFoco(false);
            props.onBlur?.(e);
          }}
        />
        {sufijo ? <Text style={s.sufijo}>{sufijo}</Text> : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  etiqueta: { marginBottom: space.sm, marginLeft: space.xs },
  caja: { flexDirection: 'row', alignItems: 'center', minHeight: 56, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.surface, paddingHorizontal: space.lg },
  foco: { borderColor: colors.olive },
  input: { flex: 1, fontSize: 20, fontWeight: '600', color: colors.ink, paddingVertical: space.md },
  inputNormal: { fontSize: 17, fontWeight: '500' },
  sufijo: { fontSize: 16, color: colors.muted, fontWeight: '600' },
});
