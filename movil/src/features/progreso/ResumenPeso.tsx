// Resumen del peso para la pantalla Hoy: peso actual, avance hacia el objetivo y gráfica pequeña.
import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Tarjeta } from '../../components';
import { guardarCache, leerCache } from '../../lib/cache';
import { colors, radius, space, type } from '../../theme';
import { cargarProgreso, type PerfilPeso, type Peso } from './api';
import { kg, resumen } from './calculos';
import { Grafica } from './Grafica';

export function ResumenPeso() {
  const [datos, setDatos] = useState<{ pesos: Peso[]; perfil: PerfilPeso | null } | null>(leerCache('resumen-peso') ?? null);

  useFocusEffect(
    useCallback(() => {
      // Se carga un poco después para no frenar la animación al cambiar de pestaña.
      const t = setTimeout(() => {
        cargarProgreso(null)
          .then((d) => setDatos(guardarCache('resumen-peso', { pesos: d.pesos, perfil: d.perfil })))
          .catch(() => {});
      }, 300);
      return () => clearTimeout(t);
    }, []),
  );

  if (!datos) return null;
  const { pesos, perfil } = datos;
  const quiereBajar = perfil?.objetivo === 'perder';
  const inicial = perfil?.peso_inicial_kg != null ? Number(perfil.peso_inicial_kg) : null;
  const objetivo = quiereBajar && perfil?.peso_objetivo_kg ? Number(perfil.peso_objetivo_kg) : null;
  const r = resumen(pesos, inicial, objetivo, quiereBajar);
  if (r.actual === null) return null;
  const ir = () => router.navigate('/progreso' as Href);

  return (
    <Pressable onPress={ir} accessibilityRole="button" accessibilityLabel="Ver mi progreso">
      <Tarjeta style={{ gap: space.md }}>
        <View style={s.fila}>
          <View>
            <Text style={type.small}>{pesos.length ? 'Tu peso' : 'Peso de partida'}</Text>
            <Text style={s.peso}>
              {kg(r.actual)} <Text style={s.unidad}>kg</Text>
            </Text>
          </View>
          {r.porcentaje !== null ? (
            <View style={s.pastilla}>
              <Text style={s.pastillaTexto}>{Math.round(r.porcentaje)}% del objetivo</Text>
            </View>
          ) : quiereBajar && r.perdido > 0 ? (
            <View style={s.pastilla}>
              <Text style={s.pastillaTexto}>−{kg(r.perdido)} kg</Text>
            </View>
          ) : null}
        </View>
        {r.porcentaje !== null ? (
          <View>
            <View style={s.barra}>
              <View style={[s.relleno, { width: `${Math.max(r.porcentaje, 2)}%` as const }]} />
            </View>
            <View style={[s.fila, { marginTop: space.xs }]}>
              <Text style={type.small}>{kg(inicial, 0)} kg</Text>
              <Text style={type.small}>{kg(objetivo, 0)} kg</Text>
            </View>
          </View>
        ) : null}
        {pesos.length > 1 ? <Grafica pesos={pesos.slice(-30)} objetivo={objetivo} alto={120} /> : null}
        <Text style={s.enlace}>{pesos.length ? 'Anotar el peso o ver más ›' : 'Anota tu primer peso ›'}</Text>
      </Tarjeta>
    </Pressable>
  );
}

const s = StyleSheet.create({
  fila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  peso: { fontSize: 34, fontWeight: '800', color: colors.ink, letterSpacing: -0.8 },
  unidad: { fontSize: 17, fontWeight: '700', color: colors.ink2 },
  pastilla: { backgroundColor: colors.lemonSoft, borderRadius: radius.pill, paddingVertical: 7, paddingHorizontal: 12 },
  pastillaTexto: { fontWeight: '700', color: colors.ink, fontSize: 14 },
  barra: { height: 10, borderRadius: radius.pill, backgroundColor: '#EFEDE4', overflow: 'hidden' },
  relleno: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.lemon },
  enlace: { fontWeight: '700', fontSize: 15, color: colors.olive },
});
