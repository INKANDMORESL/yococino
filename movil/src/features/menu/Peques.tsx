// Versión Peques de una receta: cómo hacerla para los niños de casa con los mismos ingredientes.
// Nunca es una dieta: no se muestran calorías ni cantidades para "comer menos".
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Aparecer, Aviso } from '../../components';
import { colors, radius, shadow, space, type } from '../../theme';
import { ErrorMenu, versionPeques, type VersionPeques } from './api';

const NOMBRE_FRANJA: Record<string, string> = { '1-3': 'De 1 a 3 años', '4-8': 'De 4 a 8 años', '9-13': 'De 9 a 13 años', '14-17': 'De 14 a 17 años' };

function Lista({ titulo, items, simbolo }: { titulo: string; items: string[]; simbolo: string }) {
  if (!items.length) return null;
  return (
    <View style={{ gap: space.xs }}>
      <Text style={s.subtitulo}>{titulo}</Text>
      {items.map((t) => (
        <View key={t} style={s.linea}>
          <Text style={s.simbolo}>{simbolo}</Text>
          <Text style={[type.body, { flex: 1, color: colors.ink }]}>{t}</Text>
        </View>
      ))}
    </View>
  );
}

export function Peques({ recetaId, franjas }: { recetaId: number; franjas: string[] }) {
  const [abierta, setAbierta] = useState(false);
  const [datos, setDatos] = useState<VersionPeques | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abrir = async () => {
    const nueva = !abierta;
    setAbierta(nueva);
    if (!nueva || datos || cargando) return;
    setCargando(true);
    setError(null);
    try {
      setDatos(await versionPeques(recetaId));
    } catch (e) {
      setError(e instanceof ErrorMenu ? e.message : 'No hemos podido preparar la versión Peques.');
    } finally {
      setCargando(false);
    }
  };

  const porEdad = datos ? datos.por_edad.filter((p) => !franjas.length || franjas.includes(p.franja)) : [];

  return (
    <View style={s.caja}>
      <Pressable onPress={abrir} accessibilityRole="button" accessibilityState={{ expanded: abierta }} style={s.cabecera}>
        <Text style={{ fontSize: 26 }}>🧒</Text>
        <View style={{ flex: 1 }}>
          <Text style={s.titulo}>Versión Peques</Text>
          <Text style={type.small}>El mismo plato, adaptado a los niños de casa</Text>
        </View>
        <Text style={s.mas}>{abierta ? '−' : '+'}</Text>
      </Pressable>
      {abierta ? (
        <View style={s.cuerpo}>
          {cargando ? (
            <View style={s.cargando}>
              <ActivityIndicator color={colors.olive} />
              <Text style={type.small}>Preparando la versión Peques… (la primera vez tarda unos segundos)</Text>
            </View>
          ) : null}
          {error ? <Aviso tono="rosa" texto={error} /> : null}
          {datos ? (
            <Aparecer style={{ gap: space.lg }}>
              {datos.resumen ? <Text style={[type.body, { color: colors.ink }]}>{datos.resumen}</Text> : null}
              <Lista titulo="Qué hacer distinto" items={datos.cambios} simbolo="•" />
              {porEdad.length ? (
                <View style={{ gap: space.sm }}>
                  <Text style={s.subtitulo}>Según la edad</Text>
                  {porEdad.map((p) => (
                    <View key={p.franja} style={s.edad}>
                      <Text style={s.edadTitulo}>{NOMBRE_FRANJA[p.franja] ?? p.franja}</Text>
                      <Text style={[type.body, { color: colors.ink }]}>{p.consejo}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
              <Lista titulo="Para que les apetezca" items={datos.presentacion} simbolo="✨" />
              {datos.alternativas.length ? (
                <View style={{ gap: space.sm }}>
                  <Text style={s.subtitulo}>Otra forma de servirlo</Text>
                  {datos.alternativas.map((a) => (
                    <View key={a.nombre} style={s.alternativa}>
                      <Text style={s.edadTitulo}>{a.nombre}</Text>
                      <Text style={[type.body, { color: colors.ink }]}>{a.descripcion}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
              {datos.seguridad.length ? (
                <View style={s.seguridad}>
                  <Lista titulo="Ojo con" items={datos.seguridad} simbolo="⚠️" />
                </View>
              ) : null}
              <Text style={type.small}>
                Las cantidades, según su hambre: no es una dieta. Si algún peque tiene alergias o una necesidad especial, consulta con su pediatra.
              </Text>
            </Aparecer>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  caja: { backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden', ...shadow },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  titulo: { fontSize: 17, fontWeight: '700', color: colors.ink },
  mas: { fontSize: 24, color: colors.muted },
  cuerpo: { paddingHorizontal: space.lg, paddingBottom: space.lg, gap: space.md },
  cargando: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  subtitulo: { fontSize: 15, fontWeight: '700', color: colors.oliveInk },
  linea: { flexDirection: 'row', gap: space.sm },
  simbolo: { fontSize: 15, lineHeight: 23, color: colors.olive },
  edad: { backgroundColor: colors.lemonSoft, borderRadius: radius.md, padding: space.md, gap: 2 },
  alternativa: { backgroundColor: colors.leafSoft, borderRadius: radius.md, padding: space.md, gap: 2 },
  edadTitulo: { fontSize: 15, fontWeight: '700', color: colors.ink },
  seguridad: { backgroundColor: colors.roseSoft, borderRadius: radius.md, padding: space.md },
});
