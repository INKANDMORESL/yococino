// Franja de la prueba gratis en Inicio: días que quedan o prueba terminada, con acceso a la suscripción.
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, space } from '../../theme';
import { diasRestantes, type Plan } from './plan';

export function AvisoPlan({ plan }: { plan: Plan | null }) {
  if (!plan || plan.estado === 'premium') return null;
  const quedan = diasRestantes(plan);
  const terminada = plan.estado === 'caducada';
  return (
    <Pressable onPress={() => router.push('/suscripcion')} accessibilityRole="button" style={[s.caja, terminada && s.terminada]}>
      <Text style={{ fontSize: 26 }}>{terminada ? '🔒' : '✨'}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[s.titulo, terminada && { color: '#fff' }]}>
          {terminada ? 'Tu prueba gratis ha terminado' : `Prueba gratis: ${quedan === 1 ? 'queda 1 día' : `quedan ${quedan} días`}`}
        </Text>
        <Text style={[s.texto, terminada && { color: 'rgba(255,255,255,0.85)' }]}>
          {terminada ? 'Suscríbete para seguir con tu menú de cada mes.' : 'Tu menú de prueba es de 7 días. Con la suscripción, siempre 30 días por delante.'}
        </Text>
      </View>
      <Text style={[s.flecha, terminada && { color: colors.lemon }]}>›</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  caja: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.lemonSoft, borderRadius: radius.lg, padding: space.lg },
  terminada: { backgroundColor: colors.ink },
  titulo: { fontSize: 16, fontWeight: '700', color: colors.ink },
  texto: { fontSize: 14, color: colors.ink2, marginTop: 2 },
  flecha: { fontSize: 26, color: colors.olive },
});
