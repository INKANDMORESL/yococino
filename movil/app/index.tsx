// Pantalla de bienvenida.
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Boton } from '../src/components/ui';
import { colors, radius, space, type } from '../src/theme';

export default function Bienvenida() {
  return (
    <SafeAreaView style={s.pantalla}>
      <View style={s.arriba}>
        <View style={s.logo} accessibilityLabel="Logotipo de Yococino">
          <View style={s.cuenco} />
          <View style={s.hoja} />
        </View>
        <Text style={[type.display, { marginTop: space.xl }]}>Yococino</Text>
        <Text style={[type.body, s.lema]}>Tu menú del mes, tus recetas paso a paso y tu lista de la compra. Sin complicarte.</Text>
      </View>

      <View style={s.puntos}>
        <Punto emoji="🗓️" texto="Siempre un mes de recetas por delante, pensado para tu objetivo" />
        <Punto emoji="👩‍🍳" texto="Recetas fáciles de seguir mientras cocinas" />
        <Punto emoji="🛒" texto="La lista de la compra se hace sola" />
      </View>

      <View style={{ gap: space.md }}>
        <Boton texto="Empezar" onPress={() => router.push('/encuesta')} />
        <Text style={[type.small, { textAlign: 'center' }]}>Una encuesta de 2 minutos para preparar tu menú.</Text>
      </View>
    </SafeAreaView>
  );
}

function Punto({ emoji, texto }: { emoji: string; texto: string }) {
  return (
    <View style={s.punto}>
      <View style={s.puntoIcono}>
        <Text style={{ fontSize: 20 }}>{emoji}</Text>
      </View>
      <Text style={[type.body, { flex: 1, color: colors.ink }]}>{texto}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.bg, padding: space.xl, justifyContent: 'space-between' },
  arriba: { marginTop: space.xxl },
  lema: { marginTop: space.sm, fontSize: 18, lineHeight: 26 },
  logo: { width: 76, height: 76, borderRadius: 22, backgroundColor: colors.olive, alignItems: 'center', justifyContent: 'center' },
  cuenco: { position: 'absolute', bottom: 18, width: 44, height: 22, borderBottomLeftRadius: 22, borderBottomRightRadius: 22, backgroundColor: colors.bg },
  hoja: { position: 'absolute', top: 16, right: 22, width: 16, height: 24, borderRadius: 12, backgroundColor: colors.lemon, transform: [{ rotate: '20deg' }] },
  puntos: { gap: space.lg },
  punto: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  puntoIcono: { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.leaf, alignItems: 'center', justifyContent: 'center' },
});
