import { Text, View } from 'react-native';
import { Aparecer, Campo, Chip } from '../../../components';
import { space, type } from '../../../theme';
import { OPCIONES, type Sexo } from '../modelo';
import { ps } from './estilos';
import type { PasoProps } from './tipos';

export function PasoSobreTi({ e, cambiar }: PasoProps) {
  return (
    <View style={ps.columnaAmplia}>
      <Aparecer retraso={60} style={ps.fila}>
        <Campo etiqueta="Edad" sufijo="años" keyboardType="number-pad" value={e.edad} onChangeText={(t) => cambiar({ edad: t })} placeholder="35" maxLength={3} />
        <Campo etiqueta="Altura" sufijo="cm" keyboardType="number-pad" value={e.altura} onChangeText={(t) => cambiar({ altura: t })} placeholder="175" maxLength={3} />
      </Aparecer>
      <Aparecer retraso={120}>
        <Campo etiqueta="Peso actual" sufijo="kg" keyboardType="decimal-pad" value={e.peso} onChangeText={(t) => cambiar({ peso: t })} placeholder="82,5" maxLength={5} />
      </Aparecer>
      <Aparecer retraso={180} style={{ gap: space.sm }}>
        <Text style={[type.label, { marginLeft: space.xs }]}>Sexo</Text>
        <View style={ps.chips}>
          {OPCIONES.sexo.map((o) => (
            <Chip key={o.valor} texto={o.texto} elegido={e.sexo === o.valor} onPress={() => cambiar({ sexo: o.valor as Sexo })} />
          ))}
        </View>
      </Aparecer>
    </View>
  );
}
