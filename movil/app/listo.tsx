// Resultado de la encuesta: resumen del plan, o recomendación de un profesional.
import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Aviso, Boton, Tarjeta } from '../src/components/ui';
import { OPCIONES, evaluar, numero } from '../src/encuesta';
import { useEncuesta } from '../src/store';
import { colors, space, type } from '../src/theme';

const texto = <T extends { valor: string; texto: string }>(lista: readonly T[], valor: string | null) =>
  lista.find((o) => o.valor === valor)?.texto ?? '—';

export default function Listo() {
  const { encuesta: e, reiniciar } = useEncuesta();
  const r = evaluar(e);

  const empezarDeNuevo = () => {
    reiniciar();
    router.replace('/');
  };

  if (r.tipo === 'menor') {
    return (
      <SafeAreaView style={s.pantalla}>
        <View style={s.centro}>
          <Text style={s.emoji}>🙂</Text>
          <Text style={[type.title, s.centrado]}>Yococino es para mayores de 18 años</Text>
          <Text style={[type.body, s.centrado, { marginTop: space.sm }]}>
            Si quieres comer mejor, habla con tu familia y con tu médico o pediatra: ellos pueden ayudarte de verdad.
          </Text>
        </View>
        <Boton texto="Volver al inicio" variante="linea" onPress={empezarDeNuevo} />
      </SafeAreaView>
    );
  }

  if (r.tipo === 'profesional') {
    const tca = r.motivos.some((m) => m.startsWith('Trastorno'));
    return (
      <SafeAreaView style={s.pantalla}>
        <ScrollView contentContainerStyle={{ gap: space.lg, paddingBottom: space.xxl }}>
          <Text style={s.emoji}>🩺</Text>
          <Text style={type.title}>En tu caso, lo mejor es un profesional</Text>
          <Text style={type.body}>
            Por lo que nos has contado, un menú automático no es lo más seguro para ti. Un dietista-nutricionista o tu médico
            pueden preparar una pauta adaptada a tu situación.
          </Text>
          {tca ? (
            <Aviso
              tono="mar"
              texto="Si estás pasando por un momento difícil con la comida, no tienes que hacerlo solo. Tu médico de cabecera puede orientarte y derivarte a un equipo especializado. Si en algún momento sientes que estás en peligro, llama al 024 o al 112."
            />
          ) : null}
          <Tarjeta>
            <Text style={type.heading}>Puedes seguir usando Yococino</Text>
            <Text style={[type.body, { marginTop: space.xs }]}>
              Cuando tengas la pauta de tu profesional, podrás subirla y la app la convertirá en tu calendario, tus recetas y tu
              lista de la compra.
            </Text>
          </Tarjeta>
        </ScrollView>
        <Boton texto="Volver al inicio" variante="linea" onPress={empezarDeNuevo} />
      </SafeAreaView>
    );
  }

  const peso = numero(e.peso);
  const obj = numero(e.pesoObjetivo);
  const filas: [string, string][] = [
    ['Objetivo', texto(OPCIONES.objetivo, e.objetivo) + (e.objetivo === 'perder' && peso && obj ? ` (de ${e.peso} a ${e.pesoObjetivo} kg)` : '')],
    ['Actividad', texto(OPCIONES.actividad, e.actividad)],
    ['Cocina', `${texto(OPCIONES.nivel, e.nivel)}, ${e.comidas} comidas al día`],
    ['Alergias', e.alergias.length ? e.alergias.join(', ') : 'Ninguna'],
    ['No te gusta', e.noMeGusta.length ? e.noMeGusta.join(', ') : 'Nada en especial'],
    ['Peques', e.hayPeques ? `${e.numPeques === 4 ? '4 o más' : e.numPeques} en casa` : 'No'],
  ];

  return (
    <SafeAreaView style={s.pantalla}>
      <ScrollView contentContainerStyle={{ gap: space.lg, paddingBottom: space.xxl }}>
        <Text style={s.emoji}>🎉</Text>
        <Text style={type.title}>Tu plan está casi listo</Text>
        <Text style={type.body}>Con esto prepararemos tu primer mes de recetas. Siempre tendrás 30 días por delante.</Text>
        <Tarjeta style={{ paddingVertical: space.sm }}>
          {filas.map(([k, v], i) => (
            <View key={k} style={[s.fila, i > 0 && s.separador]}>
              <Text style={[type.label, { width: 104 }]}>{k}</Text>
              <Text style={[type.body, { flex: 1, color: colors.ink }]}>{v}</Text>
            </View>
          ))}
        </Tarjeta>
        <Aviso tono="mar" texto="Los menús de Yococino son orientativos y no sustituyen el consejo de un profesional sanitario." />
      </ScrollView>
      <View style={{ gap: space.md }}>
        <Boton texto="Crear mi cuenta" onPress={() => {}} desactivado />
        <Text style={[type.small, s.centrado]}>El registro y el menú llegan en la próxima versión.</Text>
        <Boton texto="Cambiar respuestas" variante="linea" onPress={() => router.replace('/encuesta')} />
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.bg, padding: space.xl },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.sm },
  centrado: { textAlign: 'center' },
  emoji: { fontSize: 44 },
  fila: { flexDirection: 'row', gap: space.md, paddingVertical: space.md },
  separador: { borderTopWidth: 1, borderTopColor: colors.line },
});
