// Recetas: arriba, una fila por tipo de comida que se desliza (Desayunos, Comidas, Cenas…);
// debajo, el recetario completo con buscador, filtros y «Ver más».
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Aparecer } from '../../src/components';
import { FilasRecetas } from '../../src/features/recetas/FilasRecetas';
import { Recetario } from '../../src/features/recetas/Recetario';
import { useSubirAlTocarPestana } from '../../src/lib/subirArriba';
import { colors, radius, space, type } from '../../src/theme';

export default function Recetas() {
  const arriba = useSubirAlTocarPestana();
  const { ver } = useLocalSearchParams<{ ver?: string }>();
  const [pedido, setPedido] = useState<{ filtro: string; vez: number } | undefined>(ver === 'mias' ? { filtro: 'mias', vez: 0 } : undefined);
  const yRecetario = useRef(0);

  // «Mis recetas»: se marca el filtro y se baja hasta el recetario.
  const verMias = () => {
    setPedido((p) => ({ filtro: 'mias', vez: (p?.vez ?? 0) + 1 }));
    setTimeout(() => arriba.current?.scrollTo({ y: Math.max(0, yRecetario.current - space.md), animated: true }), 50);
  };
  useEffect(() => {
    if (ver === 'mias') verMias();
  }, [ver]);

  return (
    <SafeAreaView style={s.pantalla} edges={['top']}>
      <ScrollView ref={arriba} contentContainerStyle={s.contenido} keyboardShouldPersistTaps="handled">
        <Aparecer>
          <Text style={type.display}>Recetas</Text>
          <Text style={[type.body, { marginTop: 2 }]}>Todas aptas para ti. Ábrelas y añádelas al día que quieras.</Text>
          <Pressable onPress={verMias} accessibilityRole="button" style={s.redes}>
            <Text style={{ fontSize: 26 }}>📥</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.redesTitulo}>¿Has visto una receta en TikTok?</Text>
              <Text style={type.small}>Guárdala en Mis recetas.</Text>
            </View>
            <Text style={s.redesFlecha}>›</Text>
          </Pressable>
        </Aparecer>

        <FilasRecetas />

        <View onLayout={(e) => (yRecetario.current = e.nativeEvent.layout.y)} style={{ gap: space.md }}>
          <View>
            <Text style={s.seccion}>📖 Recetario completo</Text>
            <Text style={type.small}>Busca por plato o ingrediente y filtra como quieras.</Text>
          </View>
          <Recetario pedido={pedido} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.bg },
  contenido: { padding: space.xl, gap: space.xl, paddingBottom: space.xxl },
  seccion: { fontSize: 22, fontWeight: '800', color: colors.ink },
  redes: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.md, backgroundColor: colors.lemonSoft, borderRadius: radius.lg, padding: space.md },
  redesTitulo: { fontSize: 15, fontWeight: '700', color: colors.ink },
  redesFlecha: { fontSize: 24, color: colors.muted },
});
