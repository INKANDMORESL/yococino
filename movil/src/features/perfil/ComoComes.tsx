// «Cuéntanos cómo te gusta comer»: texto libre que adapta el menú dentro de las reglas de la app.
// Ejemplos: «me gusta desayunar pan», «no me gusta el pimiento», «quiero más recetas con pollo».
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Aviso, Boton, Tarjeta } from '../../components';
import { borrarCache } from '../../lib/cache';
import { colors, radius, space, type } from '../../theme';
import { ErrorMenu, guardarComoComes, type ResultadoPreferencias } from '../menu/api';

// alGuardar: lo que no quiere pasa a «no me gusta»; Perfil lo vuelve a leer para no pisarlo al guardar.
export function ComoComes({ inicial, alGuardar }: { inicial: string | null; alGuardar?: () => void }) {
  const [texto, setTexto] = useState(inicial ?? '');
  const [guardado, setGuardado] = useState(inicial ?? '');
  const [ocupado, setOcupado] = useState(false);
  const [resultado, setResultado] = useState<ResultadoPreferencias | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTexto(inicial ?? '');
    setGuardado(inicial ?? '');
  }, [inicial]);

  const guardar = async () => {
    setOcupado(true);
    setError(null);
    setResultado(null);
    try {
      const r = await guardarComoComes(texto.trim());
      setResultado(r);
      setGuardado(texto.trim());
      borrarCache('inicio');
      alGuardar?.();
    } catch (e) {
      setError(e instanceof ErrorMenu ? e.message : 'No hemos podido guardarlo.');
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Tarjeta style={{ gap: space.md }}>
      <Text style={type.heading}>Cuéntanos cómo te gusta comer</Text>
      <Text style={type.small}>Escríbelo con tus palabras y adaptamos tu menú, siempre con recetas sanas. Por ejemplo:</Text>
      <View style={{ gap: 2 }}>
        <Text style={s.ejemplo}>«Me gusta desayunar tostadas»</Text>
        <Text style={s.ejemplo}>«No me gusta el pimiento»</Text>
        <Text style={s.ejemplo}>«Quiero más recetas con pollo y legumbres»</Text>
      </View>
      <TextInput
        value={texto}
        onChangeText={setTexto}
        placeholder="Escribe aquí…"
        placeholderTextColor={colors.muted}
        multiline
        maxLength={500}
        style={s.campo}
        accessibilityLabel="Cómo te gusta comer"
      />
      <Text style={type.small}>No escribas datos de salud: para eso está «Tu salud».</Text>
      {error ? <Aviso tono="rosa" texto={error} /> : null}
      {resultado ? (
        <View style={{ gap: space.xs }}>
          {resultado.entendido.map((l) => (
            <Text key={l} style={[type.body, { color: colors.oliveInk }]}>
              ✓ {l}
            </Text>
          ))}
          {resultado.ignorado.map((l) => (
            <Text key={l} style={type.small}>
              ⓘ No lo hemos aplicado: {l}
            </Text>
          ))}
          {resultado.entendido.length ? (
            <Aviso
              tono="hoja"
              texto={
                resultado.quitadas
                  ? `Hemos cambiado solo ${resultado.quitadas === 1 ? '1 plato' : `${resultado.quitadas} platos`} que no encajaban; el resto de tu menú sigue igual. Ve a Inicio y se completará.`
                  : 'Lo tendremos en cuenta en los próximos días de tu menú.'
              }
            />
          ) : null}
        </View>
      ) : null}
      <Boton texto="Adaptar mi menú" variante="suave" cargando={ocupado} desactivado={texto.trim() === guardado.trim()} onPress={guardar} />
    </Tarjeta>
  );
}

const s = StyleSheet.create({
  ejemplo: { fontSize: 14, color: colors.ink2, fontStyle: 'italic' },
  campo: {
    minHeight: 96,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    padding: space.md,
    fontSize: 16,
    color: colors.ink,
    textAlignVertical: 'top',
  },
});
