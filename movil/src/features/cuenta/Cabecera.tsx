import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Aparecer } from '../../components';
import { colors, space, type } from '../../theme';

export function Cabecera({ titulo, subtitulo }: { titulo: string; subtitulo: string }) {
  return (
    <View style={{ gap: space.lg }}>
      <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Volver" style={s.volver}>
        <Text style={s.flecha}>‹</Text>
      </Pressable>
      <Aparecer desde={20}>
        <Text style={type.title}>{titulo}</Text>
        <Text style={[type.body, { marginTop: space.xs }]}>{subtitulo}</Text>
      </Aparecer>
    </View>
  );
}

const s = StyleSheet.create({
  volver: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line },
  flecha: { fontSize: 26, lineHeight: 28, color: colors.ink, marginTop: -2 },
});
