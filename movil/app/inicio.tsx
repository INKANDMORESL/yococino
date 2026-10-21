// Inicio tras entrar. De momento confirma la cuenta; el menú llega en el siguiente paso.
import { Redirect } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Easing, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Aparecer, Boton, Saltar, Tarjeta } from '../src/components';
import { useAuth } from '../src/lib/auth';
import { colors, radius, space, type } from '../src/theme';

const saludo = () => {
  const h = new Date().getHours();
  return h < 13 ? 'Buenos días' : h < 21 ? 'Buenas tardes' : 'Buenas noches';
};

function Preparando() {
  // Tres puntos que laten en secuencia mientras se prepara el menú.
  const vs = useRef([0, 1, 2].map(() => new Animated.Value(0.3))).current;
  useEffect(() => {
    const animaciones = vs.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 180),
          Animated.timing(v, { toValue: 1, duration: 400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(v, { toValue: 0.3, duration: 400, useNativeDriver: true }),
          Animated.delay((2 - i) * 180),
        ]),
      ),
    );
    animaciones.forEach((a) => a.start());
    return () => animaciones.forEach((a) => a.stop());
  }, [vs]);
  return (
    <View style={s.puntos} accessibilityLabel="Preparando">
      {vs.map((v, i) => (
        <Animated.View key={i} style={[s.punto, { opacity: v, transform: [{ scale: v }] }]} />
      ))}
    </View>
  );
}

export default function Inicio() {
  const { sesion, cargando, salir } = useAuth();
  if (!cargando && !sesion) return <Redirect href="/" />;
  const email = sesion?.user.email ?? '';

  return (
    <SafeAreaView style={s.pantalla}>
      <ScrollView contentContainerStyle={{ gap: space.xl }}>
        <Aparecer>
          <Text style={type.display}>{saludo()}</Text>
          <Text style={[type.body, { marginTop: space.xs }]}>{email}</Text>
        </Aparecer>

        <Aparecer retraso={120}>
          <Tarjeta style={{ alignItems: 'center', gap: space.md, paddingVertical: space.xxl }}>
            <Saltar retraso={200}>
              <Text style={{ fontSize: 52 }}>🥗</Text>
            </Saltar>
            <Text style={[type.title, { textAlign: 'center' }]}>Estamos preparando tu menú</Text>
            <Text style={[type.body, { textAlign: 'center' }]}>
              Tu cuenta está lista y tus respuestas guardadas. Muy pronto verás aquí qué comer hoy y tus próximos 30 días de recetas.
            </Text>
            <Preparando />
          </Tarjeta>
        </Aparecer>

        <Aparecer retraso={240}>
          <View style={s.pista}>
            <Text style={[type.body, { color: colors.ink }]}>💡 Mientras tanto, puedes añadir Yococino a tu pantalla de inicio para abrirla como una app.</Text>
          </View>
        </Aparecer>
      </ScrollView>
      <Boton texto="Cerrar sesión" variante="linea" onPress={salir} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.bg, padding: space.xl, justifyContent: 'space-between' },
  puntos: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  punto: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.olive },
  pista: { backgroundColor: colors.lemonSoft, borderRadius: radius.md, padding: space.lg },
});
