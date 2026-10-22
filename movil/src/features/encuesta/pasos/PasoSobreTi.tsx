import { useRef } from 'react';
import { Text, View } from 'react-native';
import { Aparecer, Campo, Chip, type CampoRef } from '../../../components';
import { space, type } from '../../../theme';
import { OPCIONES, type Sexo } from '../modelo';
import { ps } from './estilos';
import type { PasoProps } from './tipos';

export function PasoSobreTi({ e, cambiar }: PasoProps) {
  const mesRef = useRef<CampoRef>(null);
  const anoRef = useRef<CampoRef>(null);
  const fecha = (parcial: Partial<PasoProps['e']['nacimiento']>) => cambiar({ nacimiento: { ...e.nacimiento, ...parcial } });
  const soloNumeros = (t: string) => t.replace(/\D/g, '');

  return (
    <View style={ps.columnaAmplia}>
      <Aparecer retraso={30}>
        <Campo
          etiqueta="¿Cómo te llamas?"
          grande={false}
          value={e.nombre}
          onChangeText={(t) => cambiar({ nombre: t })}
          placeholder="Tu nombre"
          autoCapitalize="words"
          autoComplete="given-name"
          maxLength={40}
        />
      </Aparecer>
      <Aparecer retraso={60} style={{ gap: space.sm }}>
        <Text style={[type.label, { marginLeft: space.xs }]}>Fecha de nacimiento</Text>
        <View style={ps.fila}>
          <Campo
            etiqueta="Día"
            keyboardType="number-pad"
            value={e.nacimiento.dia}
            placeholder="15"
            maxLength={2}
            onChangeText={(t) => {
              const v = soloNumeros(t);
              fecha({ dia: v });
              if (v.length === 2) mesRef.current?.focus();
            }}
          />
          <Campo
            ref={mesRef}
            etiqueta="Mes"
            keyboardType="number-pad"
            value={e.nacimiento.mes}
            placeholder="03"
            maxLength={2}
            onChangeText={(t) => {
              const v = soloNumeros(t);
              fecha({ mes: v });
              if (v.length === 2) anoRef.current?.focus();
            }}
          />
          <View style={{ flex: 1.4 }}>
            <Campo ref={anoRef} etiqueta="Año" keyboardType="number-pad" value={e.nacimiento.ano} placeholder="1988" maxLength={4} onChangeText={(t) => fecha({ ano: soloNumeros(t) })} />
          </View>
        </View>
      </Aparecer>
      <Aparecer retraso={120} style={ps.fila}>
        <Campo etiqueta="Altura" sufijo="cm" keyboardType="number-pad" value={e.altura} onChangeText={(t) => cambiar({ altura: t })} placeholder="175" maxLength={3} />
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
