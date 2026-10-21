// Encuesta inicial en 7 pasos cortos.
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Aviso, Boton, Campo, Chip, Opcion } from '../src/components/ui';
import {
  OPCIONES,
  PASOS,
  erroresPaso,
  numero,
  pesoMinimoSaludable,
  type Actividad,
  type FranjaPeques,
  type Nivel,
  type Objetivo,
  type Sexo,
} from '../src/encuesta';
import { useEncuesta } from '../src/store';
import { colors, radius, space, type } from '../src/theme';

const alternar = <T,>(lista: readonly T[], valor: T): T[] =>
  lista.includes(valor) ? lista.filter((x) => x !== valor) : [...lista, valor];

export default function EncuestaPantalla() {
  const { encuesta: e, cambiar } = useEncuesta();
  const [paso, setPaso] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [nuevoAlimento, setNuevoAlimento] = useState('');
  const [otraAlergia, setOtraAlergia] = useState('');

  const total = PASOS.length;
  const info = PASOS[paso];

  const siguiente = () => {
    const err = erroresPaso(paso, e);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    if (paso < total - 1) setPaso(paso + 1);
    else router.replace('/listo');
  };

  const atras = () => {
    setError(null);
    if (paso === 0) router.back();
    else setPaso(paso - 1);
  };

  const anadirAlimento = () => {
    const t = nuevoAlimento.trim();
    if (t && !e.noMeGusta.some((x) => x.toLowerCase() === t.toLowerCase())) cambiar({ noMeGusta: [...e.noMeGusta, t] });
    setNuevoAlimento('');
  };

  const anadirAlergia = () => {
    const t = otraAlergia.trim();
    if (t && !e.alergias.includes(t)) cambiar({ alergias: [...e.alergias, t] });
    setOtraAlergia('');
  };

  const minimo = pesoMinimoSaludable(numero(e.altura) ?? 170);

  return (
    <SafeAreaView style={s.pantalla}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.cabecera}>
          <Pressable onPress={atras} accessibilityRole="button" accessibilityLabel="Volver" style={s.volver}>
            <Text style={{ fontSize: 22, color: colors.ink }}>‹</Text>
          </Pressable>
          <View style={s.barra} accessibilityLabel={`Paso ${paso + 1} de ${total}`}>
            <View style={[s.barraRelleno, { width: `${((paso + 1) / total) * 100}%` as const }]} />
          </View>
          <Text style={type.small}>
            {paso + 1}/{total}
          </Text>
        </View>

        <ScrollView contentContainerStyle={s.contenido} keyboardShouldPersistTaps="handled">
          <Text style={type.title}>{info.titulo}</Text>
          <Text style={[type.body, { marginTop: space.xs, marginBottom: space.xl }]}>{info.subtitulo}</Text>

          {paso === 0 && (
            <View style={{ gap: space.lg }}>
              <View style={s.fila}>
                <Campo etiqueta="Edad" sufijo="años" keyboardType="number-pad" value={e.edad} onChangeText={(t) => cambiar({ edad: t })} placeholder="35" />
                <Campo etiqueta="Altura" sufijo="cm" keyboardType="number-pad" value={e.altura} onChangeText={(t) => cambiar({ altura: t })} placeholder="175" />
              </View>
              <Campo etiqueta="Peso actual" sufijo="kg" keyboardType="decimal-pad" value={e.peso} onChangeText={(t) => cambiar({ peso: t })} placeholder="82,5" />
              <Text style={[type.label, { marginLeft: space.xs }]}>Sexo</Text>
              <View style={s.chips}>
                {OPCIONES.sexo.map((o) => (
                  <Chip key={o.valor} texto={o.texto} elegido={e.sexo === o.valor} onPress={() => cambiar({ sexo: o.valor as Sexo })} />
                ))}
              </View>
            </View>
          )}

          {paso === 1 && (
            <View style={{ gap: space.md }}>
              {OPCIONES.objetivo.map((o) => (
                <Opcion key={o.valor} texto={o.texto} detalle={o.detalle} elegida={e.objetivo === o.valor} onPress={() => cambiar({ objetivo: o.valor as Objetivo })} />
              ))}
              {e.objetivo === 'perder' && (
                <View style={{ marginTop: space.md, gap: space.sm }}>
                  <Campo etiqueta="¿A qué peso quieres llegar?" sufijo="kg" keyboardType="decimal-pad" value={e.pesoObjetivo} onChangeText={(t) => cambiar({ pesoObjetivo: t })} placeholder="75" />
                  <Text style={[type.small, { marginLeft: space.xs }]}>
                    Para tu altura, el mínimo saludable es {String(minimo).replace('.', ',')} kg.
                  </Text>
                </View>
              )}
            </View>
          )}

          {paso === 2 && (
            <View style={{ gap: space.md }}>
              {OPCIONES.actividad.map((o) => (
                <Opcion key={o.valor} texto={o.texto} detalle={o.detalle} elegida={e.actividad === o.valor} onPress={() => cambiar({ actividad: o.valor as Actividad })} />
              ))}
            </View>
          )}

          {paso === 3 && (
            <View style={{ gap: space.lg }}>
              <Text style={type.heading}>¿Tienes alguna alergia o intolerancia?</Text>
              <View style={s.chips}>
                {OPCIONES.alergias.map((a) => (
                  <Chip key={a} texto={a} elegido={e.alergias.includes(a)} onPress={() => cambiar({ alergias: alternar(e.alergias, a) })} />
                ))}
                {e.alergias
                  .filter((a) => !(OPCIONES.alergias as readonly string[]).includes(a))
                  .map((a) => (
                    <Chip key={a} texto={a} elegido onPress={() => cambiar({ alergias: alternar(e.alergias, a) })} />
                  ))}
              </View>
              <View style={s.fila}>
                <Campo etiqueta="Otra alergia" value={otraAlergia} onChangeText={setOtraAlergia} onSubmitEditing={anadirAlergia} returnKeyType="done" placeholder="Por ejemplo, mostaza" />
              </View>
              {otraAlergia.trim() ? <Boton texto="Añadir alergia" variante="suave" onPress={anadirAlergia} /> : null}

              <Text style={[type.heading, { marginTop: space.md }]}>¿Te encuentras en alguna de estas situaciones?</Text>
              <View style={s.chips}>
                {OPCIONES.condiciones.map((c) => (
                  <Chip key={c} texto={c} elegido={e.condiciones.includes(c)} onPress={() => cambiar({ condiciones: alternar(e.condiciones, c) })} />
                ))}
              </View>
              <Text style={type.small}>Si no marcas nada, entendemos que ninguna. Estos datos son privados y solo se usan para cuidarte.</Text>
            </View>
          )}

          {paso === 4 && (
            <View style={{ gap: space.lg }}>
              <Campo etiqueta="Alimentos que no te gustan" value={nuevoAlimento} onChangeText={setNuevoAlimento} onSubmitEditing={anadirAlimento} returnKeyType="done" placeholder="Por ejemplo, coliflor" />
              {nuevoAlimento.trim() ? <Boton texto="Añadir" variante="suave" onPress={anadirAlimento} /> : null}
              {e.noMeGusta.length > 0 ? (
                <View style={s.chips}>
                  {e.noMeGusta.map((a) => (
                    <Chip key={a} texto={`${a}  ×`} elegido={false} onPress={() => cambiar({ noMeGusta: e.noMeGusta.filter((x) => x !== a) })} />
                  ))}
                </View>
              ) : (
                <Text style={type.small}>Puedes dejarlo vacío. Más adelante podrás añadir alimentos desde cualquier receta con el botón «No me gusta».</Text>
              )}
            </View>
          )}

          {paso === 5 && (
            <View style={{ gap: space.md }}>
              {OPCIONES.nivel.map((o) => (
                <Opcion key={o.valor} texto={o.texto} detalle={o.detalle} elegida={e.nivel === o.valor} onPress={() => cambiar({ nivel: o.valor as Nivel })} />
              ))}
              <Text style={[type.heading, { marginTop: space.lg }]}>¿Cuántas comidas haces al día?</Text>
              <View style={s.chips}>
                {OPCIONES.comidas.map((n) => (
                  <Chip key={n} texto={`${n} comidas`} elegido={e.comidas === n} onPress={() => cambiar({ comidas: n })} />
                ))}
              </View>
            </View>
          )}

          {paso === 6 && (
            <View style={{ gap: space.md }}>
              <Text style={type.heading}>¿Hay niños en casa?</Text>
              <View style={s.chips}>
                <Chip texto="Sí" elegido={e.hayPeques === true} onPress={() => cambiar({ hayPeques: true })} />
                <Chip texto="No" elegido={e.hayPeques === false} onPress={() => cambiar({ hayPeques: false, franjasPeques: [] })} />
              </View>
              {e.hayPeques && (
                <View style={{ gap: space.md, marginTop: space.md }}>
                  <Text style={type.heading}>¿Cuántos?</Text>
                  <View style={s.chips}>
                    {[1, 2, 3, 4].map((n) => (
                      <Chip key={n} texto={n === 4 ? '4 o más' : String(n)} elegido={e.numPeques === n} onPress={() => cambiar({ numPeques: n })} />
                    ))}
                  </View>
                  <Text style={type.heading}>¿Qué edades tienen?</Text>
                  <View style={s.chips}>
                    {OPCIONES.franjasPeques.map((f) => (
                      <Chip
                        key={f.valor}
                        texto={f.texto}
                        elegido={e.franjasPeques.includes(f.valor as FranjaPeques)}
                        onPress={() => cambiar({ franjasPeques: alternar(e.franjasPeques, f.valor as FranjaPeques) })}
                      />
                    ))}
                  </View>
                  <Aviso tono="mar" texto="Con el complemento Peques, cada receta tendrá una versión para niños con los mismos ingredientes. Nunca es una dieta: sin restricción de calorías y con raciones según la edad." />
                </View>
              )}
            </View>
          )}

          {error ? (
            <View style={{ marginTop: space.xl }}>
              <Aviso texto={error} tono="rosa" />
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
  barra: { flex: 1, height: 8, borderRadius: radius.pill, backgroundColor: '#EFEDE4', overflow: 'hidden' },
  barraRelleno: { height: '100%', backgroundColor: colors.olive, borderRadius: radius.pill },
  contenido: { padding: space.xl, paddingBottom: 140 },
  fila: { flexDirection: 'row', gap: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  pie: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: space.xl, paddingTop: space.md, backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.line },
});
