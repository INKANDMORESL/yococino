// Suscripción: qué incluye y cuánto cuesta. Los pagos (App Store / Google Play) se conectarán más adelante.
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Aparecer, Aviso, Boton } from '../src/components';
import { diasRestantes, usePlan } from '../src/features/plan/plan';
import { volver } from '../src/lib/volver';
import { colors, radius, shadow, space, type } from '../src/theme';

const PLANES = [
  { clave: 'anual', nombre: 'Anual', precio: '39,99 €', periodo: 'al año', detalle: 'Menos de 3,40 € al mes', etiqueta: 'Ahorra un 44 %' },
  { clave: 'mensual', nombre: 'Mensual', precio: '5,99 €', periodo: 'al mes', detalle: 'Sin compromiso', etiqueta: null },
] as const;

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
  const [elegido, setElegido] = useState<'anual' | 'mensual'>('anual');
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

        <View style={{ gap: space.md }}>
          {PLANES.map((p) => {
            const activo = elegido === p.clave;
            return (
              <Pressable
                key={p.clave}
                onPress={() => setElegido(p.clave)}
                accessibilityRole="radio"
                accessibilityState={{ checked: activo }}
                style={[s.plan, activo && s.planActivo]}
              >
                <View style={[s.radio, activo && s.radioActivo]}>{activo ? <View style={s.punto} /> : null}</View>
                <View style={{ flex: 1 }}>
                  <View style={s.planFila}>
                    <Text style={s.planNombre}>{p.nombre}</Text>
                    {p.etiqueta ? (
                      <View style={s.etiqueta}>
                        <Text style={s.etiquetaTexto}>{p.etiqueta}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={type.small}>{p.detalle}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={s.planPrecio}>{p.precio}</Text>
                  <Text style={type.small}>{p.periodo}</Text>
                </View>
              </Pressable>
            );
          })}
          <Text style={[type.small, { textAlign: 'center' }]}>
            Complemento Peques (versión para niños de cada receta): +1,49 € al mes o +9,99 € al año. Cancela cuando quieras.
          </Text>
        </View>

        {aviso ? <Aviso tono="hoja" texto={aviso} /> : null}
        {plan?.estado !== 'premium' ? (
          <Boton
            texto={elegido === 'anual' ? 'Suscribirme por 39,99 € al año' : 'Suscribirme por 5,99 € al mes'}
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
  plan: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg, borderWidth: 2, borderColor: colors.line },
  planActivo: { borderColor: colors.olive, backgroundColor: colors.leafSoft },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#D5D2C6', alignItems: 'center', justifyContent: 'center' },
  radioActivo: { borderColor: colors.olive },
  punto: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.olive },
  planFila: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
  planNombre: { fontSize: 18, fontWeight: '800', color: colors.ink },
  planPrecio: { fontSize: 22, fontWeight: '800', color: colors.ink },
  etiqueta: { backgroundColor: colors.lemon, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  etiquetaTexto: { fontSize: 12, fontWeight: '800', color: colors.ink },
  enlace: { alignSelf: 'center', padding: space.md },
  enlaceTexto: { color: colors.muted, fontWeight: '700', fontSize: 15 },
});
