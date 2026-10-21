import { View } from 'react-native';
import { Aparecer, Opcion } from '../../../components';
import { OPCIONES, type Actividad } from '../modelo';
import { ps } from './estilos';
import type { PasoProps } from './tipos';

export function PasoActividad({ e, cambiar }: PasoProps) {
  return (
    <View style={ps.columna}>
      {OPCIONES.actividad.map((o, i) => (
        <Aparecer key={o.valor} retraso={60 * (i + 1)}>
          <Opcion texto={o.texto} detalle={o.detalle} elegida={e.actividad === o.valor} onPress={() => cambiar({ actividad: o.valor as Actividad })} />
        </Aparecer>
      ))}
    </View>
  );
}
