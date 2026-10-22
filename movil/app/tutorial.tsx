// Paso a paso de la primera vez: lo que hace la app, en pocas pantallas y con "Omitir".
// Se enseña una vez (se recuerda en el dispositivo) y se puede volver a ver desde Perfil.
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Boton } from '../src/components';
import { marcarTutorialVisto } from '../src/lib/tutorial';
import { colors, radius, space, type } from '../src/theme';

const PASOS = [
  { emoji: '🍽️', fondo: colors.leaf, titulo: 'Tu menú, hecho para ti', texto: 'En Inicio ves la próxima comida y el menú de hoy. Con «Ver menú completo» tienes las semanas siguientes.' },
  { emoji: '👩‍🍳', fondo: colors.lemonSoft, titulo: 'Recetas paso a paso', texto: 'Cada plato con cantidades a tu medida, temporizadores y modo cocinar para que la pantalla no se apague.' },
  { emoji: '🔁', fondo: colors.seaSoft, titulo: 'Cámbialo a tu gusto', texto: '¿No te apetece? Cambia el plato o un ingrediente y la receta se adapta. Marca lo que no te gusta y no volverá.' },
  { emoji: '🧺', fondo: colors.roseSoft, titulo: 'Cocina con lo que tienes', texto: 'Dinos qué hay en tu nevera y te damos una receta. En Recetas buscas platos y los pones en el día que quieras.' },
  { emoji: '🛒', fondo: colors.leafSoft, titulo: 'La compra, sola', texto: 'La lista sale de tu menú, con las cantidades sumadas para todos los que coméis en casa.' },
  { emoji: '📈', fondo: colors.lemonSoft, titulo: 'Tu progreso', texto: 'Apunta tu peso y medidas y mira tu evolución semana a semana. También puedes añadir a tu familia.' },
];

export default function Tutorial() {
  const [paso, setPaso] = useState(0);
  const entrada = useRef(new Animated.Value(1)).current;
  const ultimo = paso === PASOS.length - 1;
  const p = PASOS[paso];

  const terminar = async () => {
    await marcarTutorialVisto();
    if (router.canGoBack()) router.back();
    else router.replace('/inicio');
  };

  const siguiente = () => {
    if (ultimo) return terminar();
    entrada.setValue(0);
    setPaso(paso + 1);
    Animated.timing(entrada, { toValue: 1, duration: 260, useNativeDriver: false }).start();
  };

  return (
    <SafeAreaView style={s.pantalla} edges={['top', 'bottom']}>
      <View style={s.arriba}>
        <Text style={type.small}>
          {paso + 1} de {PASOS.length}
        </Text>
        <Pressable onPress={terminar} accessibilityRole="button" hitSlop={10}>
          <Text style={s.omitir}>Omitir</Text>
        </Pressable>
      </View>

      <Animated.View style={[s.centro, { opacity: entrada, transform: [{ translateY: entrada.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }]}>
        <View style={[s.dibujo, { backgroundColor: p.fondo }]}>
          <Text style={{ fontSize: 84 }}>{p.emoji}</Text>
        </View>
        <Text style={[type.display, s.texto]}>{p.titulo}</Text>
        <Text style={[type.body, s.texto]}>{p.texto}</Text>
      </Animated.View>

      <View style={s.abajo}>
        <View style={s.puntos}>
          {PASOS.map((_, i) => (
            <View key={i} style={[s.punto, i === paso && s.puntoActivo]} />
          ))}
        </View>
        <Boton texto={ultimo ? 'Empezar' : 'Siguiente'} onPress={siguiente} />
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: space.xl },
  arriba: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: space.lg },
  omitir: { fontSize: 16, fontWeight: '700', color: colors.olive },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg },
  dibujo: { width: 200, height: 200, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center' },
  texto: { textAlign: 'center' },
  abajo: { gap: space.lg, paddingBottom: space.lg },
  puntos: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  punto: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#DAD7CC' },
  puntoActivo: { width: 22, backgroundColor: colors.olive },
});
