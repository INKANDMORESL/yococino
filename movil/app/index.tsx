// Bienvenida.
import { Redirect, router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Aparecer, Boton, Flotar, Logo } from '../src/components';
import { useAuth } from '../src/lib/auth';
import { colors, radius, space, type } from '../src/theme';

const PUNTOS = [
  { emoji: '🗓️', texto: 'Siempre un mes de recetas por delante, pensado para tu objetivo' },
  { emoji: '👩‍🍳', texto: 'Recetas fáciles de seguir mientras cocinas' },
  { emoji: '🛒', texto: 'La lista de la compra se hace sola' },
];

export default function Bienvenida() {
  const { sesion, cargando } = useAuth();
  if (!cargando && sesion) return <Redirect href="/inicio" />;

  return (
    <SafeAreaView style={s.pantalla}>
      <View style={s.arriba}>
        <Aparecer desde={24}>
          <Flotar>
            <Logo />
          </Flotar>
        </Aparecer>
        <Aparecer retraso={120} desde={20}>
          <Text style={[type.display, { marginTop: space.xl }]}>Yococino</Text>
        </Aparecer>
        <Aparecer retraso={220} desde={20}>
          <Text style={[type.body, s.lema]}>Tu menú del mes, tus recetas paso a paso y tu lista de la compra. Sin complicarte.</Text>
        </Aparecer>
      </View>

      <View style={s.puntos}>
        {PUNTOS.map((p, i) => (
          <Aparecer key={p.emoji} retraso={380 + i * 110}>
            <View style={s.punto}>
              <View style={s.puntoIcono}>
                <Text style={{ fontSize: 20 }}>{p.emoji}</Text>
              </View>
              <Text style={[type.body, { flex: 1, color: colors.ink }]}>{p.texto}</Text>
            </View>
          </Aparecer>
        ))}
      </View>

      <Aparecer retraso={760} style={{ gap: space.md }}>
        <Boton texto="Empezar" onPress={() => router.push('/encuesta')} />
        <Text style={[type.small, { textAlign: 'center' }]}>Una encuesta de 2 minutos para preparar tu menú.</Text>
        <Pressable accessibilityRole="link" onPress={() => router.push('/entrar')} style={s.enlace}>
          <Text style={s.enlaceTexto}>Ya tengo cuenta</Text>
        </Pressable>
      </Aparecer>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.bg, padding: space.xl, justifyContent: 'space-between' },
  arriba: { marginTop: space.xxl },
  lema: { marginTop: space.sm, fontSize: 18, lineHeight: 26 },
  puntos: { gap: space.lg },
  punto: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  puntoIcono: { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.leaf, alignItems: 'center', justifyContent: 'center' },
  enlace: { alignSelf: 'center', paddingVertical: space.sm, paddingHorizontal: space.lg },
  enlaceTexto: { fontSize: 16, fontWeight: '700', color: colors.olive },
});
