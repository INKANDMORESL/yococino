import { Text, View } from 'react-native';
import { Aparecer, Aviso, Chip } from '../../../components';
import { space, type } from '../../../theme';
import { OPCIONES, type FranjaPeques } from '../modelo';
import { ps } from './estilos';
import { alternar, type PasoProps } from './tipos';

export function PasoCasa({ e, cambiar }: PasoProps) {
  return (
    <View style={ps.columna}>
      <Aparecer retraso={60} style={{ gap: space.md }}>
        <Text style={type.heading}>¿Hay niños en casa?</Text>
        <View style={ps.chips}>
          <Chip texto="Sí" elegido={e.hayPeques === true} onPress={() => cambiar({ hayPeques: true })} />
          <Chip texto="No" elegido={e.hayPeques === false} onPress={() => cambiar({ hayPeques: false, franjasPeques: [] })} />
        </View>
      </Aparecer>
      {e.hayPeques ? (
        <Aparecer style={{ gap: space.md, marginTop: space.md }}>
          <Text style={type.heading}>¿Cuántos?</Text>
          <View style={ps.chips}>
            {[1, 2, 3, 4].map((n) => (
              <Chip key={n} texto={n === 4 ? '4 o más' : String(n)} elegido={e.numPeques === n} onPress={() => cambiar({ numPeques: n })} />
            ))}
          </View>
          <Text style={type.heading}>¿Qué edades tienen?</Text>
          <View style={ps.chips}>
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
        </Aparecer>
      ) : null}
    </View>
  );
}
