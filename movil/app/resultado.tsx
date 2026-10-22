// Resultado de la encuesta: resumen del plan, o recomendación de un profesional.
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Aparecer, Aviso, Boton, Casilla, Saltar, Tarjeta } from '../src/components';
import { OPCIONES, evaluar } from '../src/features/encuesta/modelo';
import { useEncuesta } from '../src/features/encuesta/store';
import { useAuth } from '../src/lib/auth';
import { guardarEncuesta } from '../src/lib/perfil';
import { colors, space, type } from '../src/theme';

const texto = <T extends { valor: string; texto: string }>(lista: readonly T[], valor: string | null) =>
  lista.find((o) => o.valor === valor)?.texto ?? '—';

export default function Resultado() {
  const { encuesta: e, reiniciar } = useEncuesta();
  const { sesion } = useAuth();
  const [consentimiento, setConsentimiento] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const r = evaluar(e);

  // Si ya hay sesión (por ejemplo, entró con Google antes de hacer la encuesta), se guarda directamente.
  const guardar = async () => {
    if (!sesion) return;
    if (!consentimiento) {
      setError('Para preparar tu menú necesitamos tu permiso para usar tus datos de salud.');
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      await guardarEncuesta(sesion.user.id, e);
      router.replace('/inicio');
    } catch {
      setError('No hemos podido guardar tus respuestas. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  const alInicio = () => {
    reiniciar();
    router.replace('/');
  };

  if (r.tipo === 'menor') {
    return (
      <SafeAreaView style={s.pantalla}>
        <View style={s.centro}>
          <Saltar>
            <Text style={s.emoji}>🙂</Text>
          </Saltar>
          <Aparecer retraso={150}>
            <Text style={[type.title, s.centrado]}>Yococino es para mayores de 18 años</Text>
            <Text style={[type.body, s.centrado, { marginTop: space.sm }]}>
              Si quieres comer mejor, habla con tu familia y con tu médico o pediatra: ellos pueden ayudarte de verdad.
            </Text>
          </Aparecer>
        </View>
        <Boton texto="Volver al inicio" variante="linea" onPress={alInicio} />
      </SafeAreaView>
    );
  }

  if (r.tipo === 'profesional') {
    const tca = r.motivos.some((m) => m.startsWith('Trastorno'));
    return (
      <SafeAreaView style={s.pantalla}>
        <ScrollView contentContainerStyle={s.lista}>
          <Saltar>
            <Text style={s.emoji}>🩺</Text>
          </Saltar>
          <Aparecer retraso={120}>
            <Text style={type.title}>En tu caso, lo mejor es un profesional</Text>
          </Aparecer>
          <Aparecer retraso={200}>
            <Text style={type.body}>
              Por lo que nos has contado, un menú automático no es lo más seguro para ti. Un dietista-nutricionista o tu médico pueden
              preparar una pauta adaptada a tu situación.
            </Text>
          </Aparecer>
          {tca ? (
            <Aviso
              tono="mar"
              texto="Si estás pasando por un momento difícil con la comida, no tienes que hacerlo solo. Tu médico de cabecera puede orientarte y derivarte a un equipo especializado. Si en algún momento sientes que estás en peligro, llama al 024 o al 112."
            />
          ) : null}
          <Aparecer retraso={280}>
            <Tarjeta>
              <Text style={type.heading}>Puedes seguir usando Yococino</Text>
              <Text style={[type.body, { marginTop: space.xs }]}>
                Cuando tengas la pauta de tu profesional, podrás subirla y la app la convertirá en tu calendario, tus recetas y tu lista de
                la compra.
              </Text>
            </Tarjeta>
          </Aparecer>
        </ScrollView>
        <Boton texto="Volver al inicio" variante="linea" onPress={alInicio} />
      </SafeAreaView>
    );
  }

  const filas: [string, string][] = [
    ['Objetivo', texto(OPCIONES.objetivo, e.objetivo) + (e.objetivo === 'perder' ? ` (de ${e.peso} a ${e.pesoObjetivo} kg)` : '')],
    ['Actividad', texto(OPCIONES.actividad, e.actividad)],
    ['Cocina', `${texto(OPCIONES.nivel, e.nivel)}, ${e.comidas} comidas al día`],
    ['Alergias', e.alergias.length ? e.alergias.join(', ') : 'Ninguna'],
    ['No te gusta', e.noMeGusta.length ? e.noMeGusta.join(', ') : 'Nada en especial'],
    ['Peques', e.hayPeques ? `${e.numPeques === 4 ? '4 o más' : e.numPeques} en casa` : 'No'],
  ];

  return (
    <SafeAreaView style={s.pantalla}>
      <ScrollView contentContainerStyle={s.lista}>
        <Saltar>
          <Text style={s.emoji}>🎉</Text>
        </Saltar>
        <Aparecer retraso={120}>
          <Text style={type.title}>Tu plan está casi listo</Text>
          <Text style={[type.body, { marginTop: space.xs }]}>Con esto prepararemos tu primer mes de recetas. Siempre tendrás 30 días por delante.</Text>
        </Aparecer>
        <Tarjeta style={{ paddingVertical: space.sm }}>
          {filas.map(([k, v], i) => (
            <Aparecer key={k} retraso={220 + i * 70} desde={10}>
              <View style={[s.fila, i > 0 && s.separador]}>
                <Text style={[type.label, { width: 104 }]}>{k}</Text>
                <Text style={[type.body, { flex: 1, color: colors.ink }]}>{v}</Text>
              </View>
            </Aparecer>
          ))}
        </Tarjeta>
        <Aviso tono="mar" texto="Los menús de Yococino son orientativos y no sustituyen el consejo de un profesional sanitario." />
        {sesion ? (
          <Casilla marcada={consentimiento} onPress={() => setConsentimiento(!consentimiento)}>
            Doy mi permiso para que Yococino use mis datos de salud (peso, alergias y respuestas de la encuesta) solo para preparar mi menú.
          </Casilla>
        ) : null}
        {error ? <Aviso tono="rosa" texto={error} /> : null}
      </ScrollView>
      <Aparecer retraso={650} style={{ gap: space.md }}>
        {sesion ? (
          <Boton texto="Guardar mi plan" cargando={guardando} onPress={guardar} />
        ) : (
          <Boton texto="Crear mi cuenta" onPress={() => router.push('/registro')} />
        )}
        <Boton texto="Cambiar respuestas" variante="linea" onPress={() => router.back()} />
      </Aparecer>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.bg, padding: space.xl },
  lista: { gap: space.lg, paddingBottom: space.xxl },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.sm },
  centrado: { textAlign: 'center' },
  emoji: { fontSize: 48 },
  fila: { flexDirection: 'row', gap: space.md, paddingVertical: space.md },
  separador: { borderTopWidth: 1, borderTopColor: colors.line },
});
