// Una comida del día: tipo, plato, tiempo y casilla de "hecha".
import { router } from 'expo-router';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLatido } from '../../components/Animaciones';
import { colors, radius, shadow, space } from '../../theme';
import { kcalTexto } from './cantidades';
import { TIPOS, type Comida } from './tipos';

export function TarjetaComida({ comida, onMarcar, siguiente }: { comida: Comida; onMarcar: () => void; siguiente?: boolean }) {
  const t = TIPOS[comida.tipo_comida] ?? TIPOS.otro;
  const escala = useLatido(comida.hecha);
  const abrir = () => {
    if (comida.receta_id) router.push({ pathname: '/receta/[id]', params: { id: String(comida.receta_id), comida: String(comida.id) } });
  };
  const detalles = [comida.receta?.minutos ? `${comida.receta.minutos} min` : null, kcalTexto(comida.kcal)].filter(Boolean).join(' · ');

  return (
    <View style={[s.tarjeta, siguiente && s.siguiente]}>
      <Pressable onPress={abrir} style={s.zona} accessibilityRole="button" accessibilityLabel={`${t.texto}: ${comida.receta?.nombre ?? ''}. Ver receta`}>
        <View style={[s.icono, { backgroundColor: t.fondo }]}>
          <Text style={{ fontSize: 26 }}>{t.emoji}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.tipo, siguiente && { color: colors.olive }]}>
            {t.texto}
            {siguiente ? ' · ahora' : ''}
          </Text>
          <Text style={[s.plato, comida.hecha && s.platoHecho]} numberOfLines={2}>
            {comida.receta?.nombre ?? 'Plato sin receta'}
          </Text>
          {detalles ? <Text style={s.detalles}>{detalles}</Text> : null}
        </View>
      </Pressable>
      <Animated.View style={{ transform: [{ scale: escala }] }}>
        <Pressable
          onPress={onMarcar}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: comida.hecha }}
          accessibilityLabel={comida.hecha ? 'Marcar como no hecha' : 'Marcar como hecha'}
          hitSlop={10}
          style={[s.check, comida.hecha && s.checkHecho]}
        >
          {comida.hecha ? <Text style={s.checkTexto}>✓</Text> : null}
        </Pressable>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  tarjeta: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.md, paddingRight: space.lg, ...shadow },
  siguiente: { borderWidth: 2, borderColor: colors.olive },
  zona: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md },
  icono: { width: 58, height: 58, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  tipo: { fontSize: 13, fontWeight: '700', color: colors.muted },
  plato: { fontSize: 17, fontWeight: '600', color: colors.ink, lineHeight: 22, marginTop: 1 },
  platoHecho: { color: colors.muted },
  detalles: { fontSize: 13, color: colors.muted, marginTop: 3 },
  check: { width: 38, height: 38, borderRadius: 19, borderWidth: 2, borderColor: '#DAD7CC', alignItems: 'center', justifyContent: 'center' },
  checkHecho: { backgroundColor: colors.olive, borderColor: colors.olive },
  checkTexto: { color: '#fff', fontSize: 18, fontWeight: '800' },
});
