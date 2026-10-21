import { useState } from 'react';
import { Text, View } from 'react-native';
import { Aparecer, Boton, Campo, Chip } from '../../../components';
import { type } from '../../../theme';
import { ps } from './estilos';
import type { PasoProps } from './tipos';

export function PasoGustos({ e, cambiar }: PasoProps) {
  const [nuevo, setNuevo] = useState('');
  const anadir = () => {
    const t = nuevo.trim();
    if (t && !e.noMeGusta.some((x) => x.toLowerCase() === t.toLowerCase())) cambiar({ noMeGusta: [...e.noMeGusta, t] });
    setNuevo('');
  };
  return (
    <Aparecer retraso={60} style={ps.columnaAmplia}>
      <Campo etiqueta="Alimentos que no te gustan" grande={false} value={nuevo} onChangeText={setNuevo} onSubmitEditing={anadir} returnKeyType="done" placeholder="Por ejemplo, coliflor" />
      {nuevo.trim() ? <Boton texto="Añadir" variante="suave" onPress={anadir} /> : null}
      {e.noMeGusta.length > 0 ? (
        <View style={ps.chips}>
          {e.noMeGusta.map((a) => (
            <Chip key={a} texto={a} elegido={false} quitar onPress={() => cambiar({ noMeGusta: e.noMeGusta.filter((x) => x !== a) })} />
          ))}
        </View>
      ) : (
        <Text style={type.small}>Puedes dejarlo vacío. Más adelante podrás añadir alimentos desde cualquier receta con el botón «No me gusta».</Text>
      )}
    </Aparecer>
  );
}
