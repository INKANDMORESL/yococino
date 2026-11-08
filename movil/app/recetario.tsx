// Recetario de un tipo de comida (Desayunos, Comidas, Cenas…), con buscador, filtros y «Ver más».
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Aparecer } from '../src/components';
import { BarraPestanasSuelta } from '../src/components/BarraPestanas';
import { TIPOS, type TipoComida } from '../src/features/menu/tipos';
import { FILAS } from '../src/features/recetas/FilasRecetas';
import { Recetario } from '../src/features/recetas/Recetario';
import { colors, space, type } from '../src/theme';

export default function RecetarioTipo() {
  const { tipo: pedido } = useLocalSearchParams<{ tipo?: string }>();
  const tipo: TipoComida = pedido && pedido in TIPOS ? (pedido as TipoComida) : 'almuerzo';
  const titulo = FILAS.find((f) => f.tipo === tipo)?.titulo ?? `${TIPOS[tipo].emoji} ${TIPOS[tipo].texto}`;
  return (
    <SafeAreaView style={s.pantalla} edges={['top']}>
      <ScrollView contentContainerStyle={s.contenido} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.navigate('/recetas'))} accessibilityRole="button" accessibilityLabel="Volver" style={s.volver}>
          <Text style={s.flecha}>‹</Text>
        </Pressable>
        <Aparecer>
          <Text style={type.display}>{titulo}</Text>
          <Text style={[type.body, { marginTop: 2 }]}>Todas aptas para ti. Ábrelas y añádelas al día que quieras.</Text>
        </Aparecer>
        {/* Se vuelve a montar al cambiar de tipo */}
        <Recetario key={tipo} tipoFijo={tipo} />
      </ScrollView>
      <BarraPestanasSuelta />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.bg },
  contenido: { padding: space.xl, gap: space.lg, paddingBottom: space.xxl },
  volver: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line },
  flecha: { fontSize: 26, lineHeight: 28, color: colors.ink, marginTop: -2 },
});
