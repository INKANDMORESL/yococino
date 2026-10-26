// Encuesta inicial: un paso cada vez, con transición animada entre pasos.
import { router } from 'expo-router';
import { useRef, useState, type ComponentRef } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Aparecer, Aviso, BarraProgreso, Boton, useSacudida } from '../src/components';
import { PASOS, erroresPaso } from '../src/features/encuesta/modelo';
import { COMPONENTES_PASO } from '../src/features/encuesta/pasos';
import { useEncuesta } from '../src/features/encuesta/store';
import { colors, space, type } from '../src/theme';

export default function EncuestaPantalla() {
  const { encuesta, cambiar } = useEncuesta();
  const [paso, setPaso] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const { x, sacudir } = useSacudida();

  const total = PASOS.length;
  const info = PASOS[paso];
  const Paso = COMPONENTES_PASO[paso];

  const irA = (n: number) => {
    setError(null);
    setPaso(n);
    scroll.current?.scrollTo({ y: 0, animated: false });
  };

  const siguiente = () => {
    const err = erroresPaso(paso, encuesta);
    if (err) {
      setError(err);
      sacudir();
      return;
    }
    if (paso < total - 1) irA(paso + 1);
    else router.push('/resultado');
  };

  const atras = () => (paso === 0 ? router.back() : irA(paso - 1));

  return (
    <SafeAreaView style={s.pantalla}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <View style={s.cabecera}>
          <Pressable onPress={atras} accessibilityRole="button" accessibilityLabel="Volver" style={s.volver}>
            <Text style={s.flecha}>‹</Text>
          </Pressable>
          <BarraProgreso actual={paso + 1} total={total} />
          <Text style={[type.small, { minWidth: 28, textAlign: 'right' }]}>
            {paso + 1}/{total}
          </Text>
        </View>

        <ScrollView ref={scroll} contentContainerStyle={s.contenido} keyboardShouldPersistTaps="handled">
          {/* key={paso}: al cambiar de paso, todo el contenido vuelve a entrar animado */}
          <View key={paso}>
            <Aparecer desde={20}>
              <Text style={type.title}>{info.titulo}</Text>
              <Text style={[type.body, s.subtitulo]}>{info.subtitulo}</Text>
            </Aparecer>
            <Paso e={encuesta} cambiar={cambiar} />
          </View>
          {error ? (
            <View style={{ marginTop: space.xl }}>
              <Aviso texto={error} tono="rosa" x={x} />
            </View>
          ) : null}
        </ScrollView>

        <View style={s.pie}>
          <Boton texto={paso === total - 1 ? 'Ver mi plan' : 'Continuar'} onPress={siguiente} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.bg },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.xl, paddingTop: space.sm },
  volver: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line },
  flecha: { fontSize: 26, lineHeight: 28, color: colors.ink, marginTop: -2 },
  contenido: { padding: space.xl, paddingBottom: space.xxl },
  subtitulo: { marginTop: space.xs, marginBottom: space.xl },
  pie: { padding: space.xl, paddingTop: space.md, backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.line },
});
