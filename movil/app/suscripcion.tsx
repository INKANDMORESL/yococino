// Suscripción: qué incluye y cuánto cuesta. Los pagos (App Store / Google Play) se conectarán más adelante.
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Aparecer, Aviso, Boton } from '../src/components';
import { diasRestantes, usePlan } from '../src/features/plan/plan';
import { volver } from '../src/lib/volver';
import { colors, radius, shadow, space, type } from '../src/theme';

const INCLUYE = [
  ['📅', 'Tu menú siempre 30 días por delante, hecho para ti'],
  ['🔁', 'Cambia platos e ingredientes cuando quieras'],
  ['🧺', 'Cocina con lo que tienes en la nevera'],
  ['🛒', 'Lista de la compra automática para toda la casa'],
  ['📈', 'Tu progreso y el de tu familia'],
  ['📖', 'Todo el recetario, siempre adaptado a tus alergias'],
];

export default function Suscripcion() {
  const plan = usePlan();
  const [aviso, setAviso] = useState<string | null>(null);
  const quedan = diasRestantes(plan);

  return (
    <SafeAreaView style={s.pantalla} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={s.contenido}>
        <Pressable onPress={() => volver()} accessibilityRole="button" accessibilityLabel="Volver" hitSlop={8} style={s.volver}>
          <Text style={s.flecha}>‹</Text>
        </Pressable>

        <Aparecer>
          <Text style={type.display}>Yococino completo</Text>
          <Text style={[type.body, { marginTop: space.xs }]}>
            {plan?.estado === 'premium'
              ? 'Ya tienes la suscripción. ¡Gracias!'
              : plan?.estado === 'caducada'
                ? 'Tu prueba gratis ha terminado. Suscríbete para seguir con tu menú.'
                : `Estás en la prueba gratis${quedan ? ` (${quedan === 1 ? 'queda 1 día' : `quedan ${quedan} días`})` : ''}.`}
          </Text>
        </Aparecer>

        <View style={s.caja}>
          {INCLUYE.map(([emoji, texto]) => (
            <View key={texto} style={s.fila}>
              <Text style={{ fontSize: 22 }}>{emoji}</Text>
              <Text style={[type.body, { flex: 1, color: colors.ink }]}>{texto}</Text>
            </View>
          ))}
        </View>

        <View style={s.precio}>
          <Text style={s.precioGrande}>39,99 €</Text>
          <Text style={type.body}>al año · menos de 3,40 € al mes</Text>
          <Text style={[type.small, { marginTop: space.sm }]}>Complemento Peques: +9,99 € al año (versión para niños de cada receta).</Text>
        </View>

        {aviso ? <Aviso tono="hoja" texto={aviso} /> : null}
        {plan?.estado !== 'premium' ? (
          <Boton
            texto="Suscribirme"
            onPress={() => setAviso('Muy pronto podrás suscribirte desde la app. Te avisaremos en cuanto esté disponible.')}
          />
        ) : null}
        <Pressable onPress={() => router.navigate('/inicio')} accessibilityRole="button" style={s.enlace}>
          <Text style={s.enlaceTexto}>Ahora no</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.bg },
  contenido: { padding: space.xl, gap: space.xl, paddingBottom: space.xxl },
  volver: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  flecha: { fontSize: 28, lineHeight: 30, color: colors.ink, marginTop: -2 },
  caja: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg, gap: space.md, ...shadow },
  fila: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  precio: { alignItems: 'center', backgroundColor: colors.leafSoft, borderRadius: radius.lg, padding: space.xl },
  precioGrande: { fontSize: 44, fontWeight: '800', color: colors.ink, letterSpacing: -1 },
  enlace: { alignSelf: 'center', padding: space.md },
  enlaceTexto: { color: colors.muted, fontWeight: '700', fontSize: 15 },
});
