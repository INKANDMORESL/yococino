import { Text, View } from 'react-native';
import { Aparecer, Campo, Opcion } from '../../../components';
import { space, type } from '../../../theme';
import { OPCIONES, numero, pesoMinimoSaludable, type Objetivo } from '../modelo';
import { ps } from './estilos';
import type { PasoProps } from './tipos';

export function PasoObjetivo({ e, cambiar }: PasoProps) {
  const minimo = pesoMinimoSaludable(numero(e.altura) ?? 170);
  return (
    <View style={ps.columna}>
      {OPCIONES.objetivo.map((o, i) => (
        <Aparecer key={o.valor} retraso={60 * (i + 1)}>
          <Opcion texto={o.texto} detalle={o.detalle} elegida={e.objetivo === o.valor} onPress={() => cambiar({ objetivo: o.valor as Objetivo })} />
        </Aparecer>
      ))}
      {e.objetivo === 'perder' ? (
        <Aparecer style={{ marginTop: space.md, gap: space.sm }}>
          <Campo etiqueta="¿A qué peso quieres llegar?" sufijo="kg" keyboardType="decimal-pad" value={e.pesoObjetivo} onChangeText={(t) => cambiar({ pesoObjetivo: t })} placeholder="75" maxLength={5} />
          <Text style={[type.small, { marginLeft: space.xs }]}>Para tu altura, el mínimo saludable es {String(minimo).replace('.', ',')} kg.</Text>
        </Aparecer>
      ) : null}
    </View>
  );
}
