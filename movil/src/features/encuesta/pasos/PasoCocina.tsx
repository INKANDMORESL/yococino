import { Text, View } from 'react-native';
import { Aparecer, Chip, Opcion } from '../../../components';
import { space, type } from '../../../theme';
import { OPCIONES, type Aparato, type Nivel } from '../modelo';
import { ps } from './estilos';
import type { PasoProps } from './tipos';

export function PasoCocina({ e, cambiar }: PasoProps) {
  return (
    <View style={ps.columna}>
      {OPCIONES.nivel.map((o, i) => (
        <Aparecer key={o.valor} retraso={60 * (i + 1)}>
          <Opcion texto={o.texto} detalle={o.detalle} elegida={e.nivel === o.valor} onPress={() => cambiar({ nivel: o.valor as Nivel })} />
        </Aparecer>
      ))}
      <Aparecer retraso={260} style={{ gap: space.md, marginTop: space.lg }}>
        <Text style={type.heading}>¿Qué tienes en tu cocina?</Text>
        <Text style={type.small}>Marca todo lo que tengas. Si tienes airfryer, también te pondremos recetas para ella.</Text>
        <View style={ps.chips}>
          {OPCIONES.aparatos.map((o) => {
            // Encuestas a medias guardadas antes de esta pregunta no traen la lista.
            const lista = e.aparatos ?? [];
            const tiene = lista.includes(o.valor);
            return (
              <Chip
                key={o.valor}
                texto={o.texto}
                elegido={tiene}
                onPress={() => cambiar({ aparatos: tiene ? lista.filter((a) => a !== o.valor) : [...lista, o.valor as Aparato] })}
              />
            );
          })}
        </View>
      </Aparecer>
      <Aparecer retraso={320} style={{ gap: space.md, marginTop: space.lg }}>
        <Text style={type.heading}>¿Cuántas comidas haces al día?</Text>
        <View style={ps.chips}>
          {OPCIONES.comidas.map((n) => (
            <Chip key={n} texto={`${n} comidas`} elegido={e.comidas === n} onPress={() => cambiar({ comidas: n })} />
          ))}
        </View>
      </Aparecer>
    </View>
  );
}
