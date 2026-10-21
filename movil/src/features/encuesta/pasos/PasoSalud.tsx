import { useState } from 'react';
import { Text, View } from 'react-native';
import { Aparecer, Boton, Campo, Chip } from '../../../components';
import { space, type } from '../../../theme';
import { OPCIONES } from '../modelo';
import { ps } from './estilos';
import { alternar, type PasoProps } from './tipos';

export function PasoSalud({ e, cambiar }: PasoProps) {
  const [otra, setOtra] = useState('');
  const fijas = OPCIONES.alergias as readonly string[];
  const anadir = () => {
    const t = otra.trim();
    if (t && !e.alergias.some((a) => a.toLowerCase() === t.toLowerCase())) cambiar({ alergias: [...e.alergias, t] });
    setOtra('');
  };
  return (
    <View style={ps.columnaAmplia}>
      <Aparecer retraso={60} style={{ gap: space.md }}>
        <Text style={type.heading}>¿Tienes alguna alergia o intolerancia?</Text>
        <View style={ps.chips}>
          {fijas.map((a) => (
            <Chip key={a} texto={a} elegido={e.alergias.includes(a)} onPress={() => cambiar({ alergias: alternar(e.alergias, a) })} />
          ))}
          {e.alergias
            .filter((a) => !fijas.includes(a))
            .map((a) => (
              <Chip key={a} texto={a} elegido quitar onPress={() => cambiar({ alergias: alternar(e.alergias, a) })} />
            ))}
        </View>
        <Campo etiqueta="Otra alergia" grande={false} value={otra} onChangeText={setOtra} onSubmitEditing={anadir} returnKeyType="done" placeholder="Por ejemplo, mostaza" />
        {otra.trim() ? <Boton texto="Añadir alergia" variante="suave" onPress={anadir} /> : null}
      </Aparecer>

      <Aparecer retraso={140} style={{ gap: space.md }}>
        <Text style={type.heading}>¿Te encuentras en alguna de estas situaciones?</Text>
        <View style={ps.chips}>
          {OPCIONES.condiciones.map((c) => (
            <Chip key={c} texto={c} elegido={e.condiciones.includes(c)} onPress={() => cambiar({ condiciones: alternar(e.condiciones, c) })} />
          ))}
        </View>
        <Text style={type.small}>Si no marcas nada, entendemos que ninguna. Estos datos son privados y solo se usan para cuidarte.</Text>
      </Aparecer>
    </View>
  );
}
