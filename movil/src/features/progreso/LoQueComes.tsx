// «Lo que comes»: kcal y macros de cada día (lo marcado como hecho frente a lo que tenía el menú)
// y las kcal de los últimos 7 días. Solo informa: sin avisos de «te has pasado».
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Aparecer, Tarjeta } from '../../components';
import { guardarCache, leerCache } from '../../lib/cache';
import { colors, radius, space, type } from '../../theme';
import { diaCorto, fechaLarga, hoyISO, nombreDia, sumarDias } from '../menu/fechas';
import { cargarNutricion, type DiaNutricion } from './api';

const DIAS_ATRAS = 13;
const redondo = (n: number) => Math.round(n).toLocaleString('es-ES');

const MACROS = [
  { clave: 'proteinas', texto: 'Proteínas', color: colors.sea },
  { clave: 'hidratos', texto: 'Hidratos', color: colors.lemon },
  { clave: 'grasas', texto: 'Grasas', color: colors.olive },
] as const;

export function LoQueComes() {
  const hoy = hoyISO();
  type Datos = { dias: DiaNutricion[]; kcalObjetivo: number | null };
  const [datos, setDatos] = useState<Datos | null>(leerCache<Datos>('progreso:nutricion'));
  const [dia, setDia] = useState(hoy);

  useFocusEffect(
    useCallback(() => {
      cargarNutricion(sumarDias(hoyISO(), -DIAS_ATRAS), hoyISO())
        .then((d) => {
          guardarCache('progreso:nutricion', d);
          setDatos(d);
        })
        .catch(() => {});
    }, []),
  );

  if (!datos) return null;
  const vacio: DiaNutricion = { fecha: dia, kcal: 0, proteinas: 0, hidratos: 0, grasas: 0, kcalPlan: 0, proteinasPlan: 0, hidratosPlan: 0, grasasPlan: 0, hechas: 0, total: 0 };
  const d = datos.dias.find((x) => x.fecha === dia) ?? vacio;
  const meta = datos.kcalObjetivo ?? (d.kcalPlan || null);
  const pct = meta ? Math.min(100, (d.kcal / meta) * 100) : 0;
  const semana = Array.from({ length: 7 }, (_, i) => sumarDias(hoy, i - 6)).map((f) => datos.dias.find((x) => x.fecha === f) ?? { ...vacio, fecha: f });
  const maxBarra = Math.max(meta ?? 0, ...semana.map((x) => Math.max(x.kcal, x.kcalPlan)), 1);
  const conDatos = semana.filter((x) => x.hechas > 0);
  const media = conDatos.length ? conDatos.reduce((s, x) => s + x.kcal, 0) / conDatos.length : null;

  return (
    <Aparecer retraso={90}>
      <Tarjeta style={{ gap: space.md }}>
        <View style={s.fila}>
          <Text style={type.heading}>Lo que comes</Text>
          <View style={s.flechas}>
            <Pressable
              onPress={() => setDia(sumarDias(dia, -1))}
              disabled={dia <= sumarDias(hoy, -DIAS_ATRAS)}
              accessibilityRole="button"
              accessibilityLabel="Día anterior"
              hitSlop={8}
              style={[s.flecha, dia <= sumarDias(hoy, -DIAS_ATRAS) && { opacity: 0.3 }]}
            >
              <Text style={s.flechaTexto}>‹</Text>
            </Pressable>
            <Text style={[type.label, { minWidth: 92, textAlign: 'center' }]}>{dia === sumarDias(hoy, -1) ? 'Ayer' : nombreDia(dia)}</Text>
            <Pressable
              onPress={() => setDia(sumarDias(dia, 1))}
              disabled={dia >= hoy}
              accessibilityRole="button"
              accessibilityLabel="Día siguiente"
              hitSlop={8}
              style={[s.flecha, dia >= hoy && { opacity: 0.3 }]}
            >
              <Text style={s.flechaTexto}>›</Text>
            </Pressable>
          </View>
        </View>

        <View>
          <Text style={s.grande}>
            {redondo(d.kcal)} <Text style={s.unidad}>{meta ? `de ${redondo(meta)} kcal` : 'kcal'}</Text>
          </Text>
          <View style={[s.barra, { marginTop: space.sm }]}>
            <View style={[s.relleno, { width: `${Math.max(pct, d.kcal > 0 ? 3 : 0)}%` as const }]} />
          </View>
          <Text style={[type.small, { marginTop: space.xs }]}>
            {d.total
              ? `${d.hechas} de ${d.total} comidas marcadas como hechas · Menú del día: ${redondo(d.kcalPlan)} kcal`
              : 'Este día no tiene menú.'}
          </Text>
        </View>

        <View style={s.macros}>
          {MACROS.map((m) => {
            const valor = d[m.clave];
            const plan = d[`${m.clave}Plan` as const];
            return (
              <View key={m.clave} style={s.macro}>
                <Text style={s.macroValor}>
                  {redondo(valor)} <Text style={s.macroUnidad}>g</Text>
                </Text>
                <Text style={s.macroTexto}>{m.texto}</Text>
                <View style={[s.barra, s.barraFina]}>
                  <View style={[s.relleno, { backgroundColor: m.color, width: `${plan ? Math.min(100, (valor / plan) * 100) : 0}%` as const }]} />
                </View>
                <Text style={s.macroPlan}>de {redondo(plan)} g</Text>
              </View>
            );
          })}
        </View>

        <View style={{ gap: space.sm }}>
          <Text style={type.label}>Últimos 7 días</Text>
          <View style={s.grafica}>
            {meta ? <View style={[s.lineaMeta, { bottom: 22 + (meta / maxBarra) * 96 }]} /> : null}
            {semana.map((x) => (
              <Pressable key={x.fecha} onPress={() => setDia(x.fecha)} style={s.columna} accessibilityRole="button" accessibilityLabel={`${fechaLarga(x.fecha)}: ${redondo(x.kcal)} kcal`}>
                <View style={s.hueco}>
                  <View style={[s.barraPlan, { height: (x.kcalPlan / maxBarra) * 96 }]} />
                  <View style={[s.barraComido, { height: (x.kcal / maxBarra) * 96 }, x.fecha === dia && { backgroundColor: colors.oliveInk }]} />
                </View>
                <Text style={[type.small, x.fecha === dia && { color: colors.ink, fontWeight: '700' }]}>{diaCorto(x.fecha)}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={type.small}>
            <Text style={{ color: colors.olive, fontWeight: '800' }}>■</Text> Comido{'   '}
            <Text style={{ color: colors.leaf, fontWeight: '800' }}>■</Text> Menú{meta ? '   ┅ Tu energía diaria' : ''}
            {media !== null ? `\nMedia de los días con comidas marcadas: ${redondo(media)} kcal` : ''}
          </Text>
        </View>
        <Text style={type.small}>Se cuenta lo que marcas como «Hecha» en tu menú. Son valores aproximados por ración.</Text>
      </Tarjeta>
    </Aparecer>
  );
}

const s = StyleSheet.create({
  fila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
  flechas: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  flecha: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.leafSoft, alignItems: 'center', justifyContent: 'center' },
  flechaTexto: { fontSize: 22, lineHeight: 24, color: colors.ink, marginTop: -2 },
  grande: { fontSize: 34, fontWeight: '800', color: colors.ink, letterSpacing: -0.8 },
  unidad: { fontSize: 16, fontWeight: '600', color: colors.ink2, letterSpacing: 0 },
  barra: { height: 12, borderRadius: radius.pill, backgroundColor: '#EFEDE4', overflow: 'hidden' },
  barraFina: { height: 6, marginTop: 6 },
  relleno: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.olive },
  macros: { flexDirection: 'row', gap: space.sm },
  macro: { flex: 1, backgroundColor: colors.leafSoft, borderRadius: radius.sm, padding: space.md },
  macroValor: { fontSize: 20, fontWeight: '800', color: colors.ink },
  macroUnidad: { fontSize: 14, fontWeight: '600', color: colors.ink2 },
  macroTexto: { fontSize: 13, color: colors.ink2 },
  macroPlan: { fontSize: 12, color: colors.muted, marginTop: 4 },
  grafica: { flexDirection: 'row', alignItems: 'flex-end', height: 120, gap: 6, position: 'relative' },
  lineaMeta: { position: 'absolute', left: 0, right: 0, borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: colors.muted },
  columna: { flex: 1, alignItems: 'center', gap: 4 },
  hueco: { height: 96, width: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  barraPlan: { position: 'absolute', bottom: 0, width: '70%', borderRadius: 6, backgroundColor: colors.leaf },
  barraComido: { width: '70%', borderRadius: 6, backgroundColor: colors.olive },
});
