// Panel «Equivalente» de un artículo de la lista: «no hay merluza → rosada». Cambia ese ingrediente en las
// recetas de esos días (sin crear recetas nuevas) y la lista se rehace sola.
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import { Aviso, Boton, Chip } from '../../components';
import { colors, radius, space, type } from '../../theme';
import { ErrorMenu, cambiarEquivalente, sugerirEquivalente } from '../menu/api';

export function Equivalente({ ingrediente, desde, hasta, cerrar, listo }: { ingrediente: string; desde: string; hasta: string; cerrar: () => void; listo: (n: number) => void }) {
  const [opciones, setOpciones] = useState<string[] | null>(null);
  const [propio, setPropio] = useState('');
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    sugerirEquivalente(ingrediente)
      .then(setOpciones)
      .catch((e) => {
        setOpciones([]);
        setError(e instanceof ErrorMenu ? e.message : 'No hemos podido buscar equivalentes.');
      });
  }, [ingrediente]);

  const elegir = async (nuevo: string) => {
    if (!nuevo.trim() || ocupado) return;
    setOcupado(nuevo);
    setError(null);
    try {
      listo(await cambiarEquivalente(ingrediente, nuevo.trim(), desde, hasta));
    } catch (e) {
      if (e instanceof ErrorMenu && e.codigo === 'ingrediente_no_valido') {
        setError(e.message);
        if (e.detalle) setOpciones(e.detalle.split('|').filter(Boolean));
      } else setError(e instanceof ErrorMenu ? e.message : 'No hemos podido cambiarlo.');
    } finally {
      setOcupado(null);
    }
  };

  return (
    <View style={s.panel}>
      <Text style={type.label}>¿No hay {ingrediente.toLowerCase()}? Cámbialo por:</Text>
      {opciones === null ? (
        <ActivityIndicator color={colors.olive} />
      ) : opciones.length ? (
        <View style={s.chips}>
          {opciones.map((o) => (
            <Chip key={o} texto={ocupado === o ? 'Cambiando…' : o} elegido={false} onPress={() => elegir(o)} />
          ))}
        </View>
      ) : null}
      <TextInput
        value={propio}
        onChangeText={setPropio}
        placeholder="U otro que tengas…"
        placeholderTextColor={colors.muted}
        style={s.campo}
        maxLength={60}
        returnKeyType="done"
        onSubmitEditing={() => elegir(propio)}
      />
      {error ? <Aviso tono="rosa" texto={error} /> : null}
      <View style={s.botones}>
        {propio.trim() ? <Boton texto="Usar este" variante="suave" cargando={ocupado === propio.trim()} onPress={() => elegir(propio)} /> : null}
        <Boton texto="Cancelar" variante="linea" onPress={cerrar} />
      </View>
      <Text style={type.small}>Se cambia en las recetas de estos días, con la misma cantidad.</Text>
    </View>
  );
}

const s = StyleSheet.create({
  panel: { gap: space.sm, paddingBottom: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  campo: { borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.bg, paddingHorizontal: space.md, paddingVertical: 10, fontSize: 16, color: colors.ink },
  botones: { gap: space.sm },
});
