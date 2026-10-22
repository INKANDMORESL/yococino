// Receta paso a paso, con las cantidades ajustadas a la ración de la persona.
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Aparecer, Aviso, Boton, Saltar } from '../../src/components';
import { useLatido } from '../../src/components/Animaciones';
import { ErrorMenu, cargarComidas, cargarReceta, marcarHecha } from '../../src/features/menu/api';
import { cantidadTexto } from '../../src/features/menu/cantidades';
import { hoyISO, sumarDias } from '../../src/features/menu/fechas';
import { NIVEL, NOMBRE_ALERGENO, TIPOS, type Comida, type Receta } from '../../src/features/menu/tipos';
import { colors, radius, shadow, space, type } from '../../src/theme';

function Marca({ hecha }: { hecha: boolean }) {
  const escala = useLatido(hecha);
  return (
    <Animated.View style={[s.marca, hecha && s.marcaHecha, { transform: [{ scale: escala }] }]}>
      {hecha ? <Text style={s.marcaTexto}>✓</Text> : null}
    </Animated.View>
  );
}

export default function RecetaPantalla() {
  const { id, comida: comidaParam } = useLocalSearchParams<{ id: string; comida?: string }>();
  const [receta, setReceta] = useState<Receta | null>(null);
  const [comida, setComida] = useState<Comida | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ingHechos, setIngHechos] = useState<Set<number>>(new Set());
  const [pasosHechos, setPasosHechos] = useState<Set<number>>(new Set());

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const r = await cargarReceta(Number(id));
        if (!vivo) return;
        setReceta(r);
        if (comidaParam) {
          const hoy = hoyISO();
          const lista = await cargarComidas(sumarDias(hoy, -1), sumarDias(hoy, 31));
          if (vivo) setComida(lista.find((c) => c.id === Number(comidaParam)) ?? null);
        }
      } catch (e) {
        if (vivo) setError(e instanceof ErrorMenu ? e.message : 'No hemos podido cargar la receta.');
      }
    })();
    return () => {
      vivo = false;
    };
  }, [id, comidaParam]);

  const factor = comida?.factor ?? 1;
  const nutricion = useMemo(() => {
    const n = receta?.nutricion;
    if (!n) return [];
    const f = (v?: number | null) => (v ? Math.round(v * factor) : null);
    return [
      ['kcal', f(n.kcal), ''],
      ['proteína', f(n.proteinas), 'g'],
      ['hidratos', f(n.hidratos), 'g'],
      ['grasa', f(n.grasas), 'g'],
      ['fibra', f(n.fibra), 'g'],
    ].filter(([, v]) => v !== null) as [string, number, string][];
  }, [receta, factor]);

  const alternar = (conjunto: Set<number>, i: number, set: (s: Set<number>) => void) => {
    const nuevo = new Set(conjunto);
    if (nuevo.has(i)) nuevo.delete(i);
    else nuevo.add(i);
    set(nuevo);
  };

  const marcarComida = async () => {
    if (!comida) return;
    const nuevo = !comida.hecha;
    setComida({ ...comida, hecha: nuevo });
    try {
      await marcarHecha(comida.id, nuevo);
    } catch (e) {
      setComida({ ...comida, hecha: !nuevo });
      setError(e instanceof Error ? e.message : 'No se ha podido guardar.');
    }
  };

  if (error && !receta) {
    return (
      <SafeAreaView style={s.centro}>
        <Aviso tono="rosa" texto={error} />
        <Boton texto="Volver" variante="linea" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }
  if (!receta) {
    return (
      <SafeAreaView style={s.centro}>
        <ActivityIndicator size="large" color={colors.olive} />
      </SafeAreaView>
    );
  }

  const t = TIPOS[receta.tipo_comida] ?? TIPOS.otro;
  const meta = [t.texto, receta.minutos ? `${receta.minutos} min` : null, NIVEL[receta.nivel], nutricion[0] ? `${nutricion[0][1]} kcal` : null].filter(
    Boolean,
  ) as string[];

  return (
    <View style={s.pantalla}>
      <ScrollView contentContainerStyle={{ paddingBottom: comida ? 120 : space.xxl }}>
        <View style={[s.portada, { backgroundColor: t.fondo }]}>
          <SafeAreaView edges={['top']} style={s.barra}>
            <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Volver" style={s.volver}>
              <Text style={s.flecha}>‹</Text>
            </Pressable>
          </SafeAreaView>
          <Saltar>
            <Text style={s.emoji}>{t.emoji}</Text>
          </Saltar>
        </View>

        <View style={s.hoja}>
          <Aparecer>
            <Text style={s.titulo}>{receta.nombre}</Text>
            {receta.descripcion ? <Text style={[type.body, { marginTop: space.sm }]}>{receta.descripcion}</Text> : null}
            <View style={s.chips}>
              {meta.map((m) => (
                <View key={m} style={s.chip}>
                  <Text style={s.chipTexto}>{m}</Text>
                </View>
              ))}
            </View>
            {factor !== 1 ? <Text style={[type.small, { marginTop: space.sm }]}>Cantidades ajustadas a tu plan.</Text> : null}
          </Aparecer>

          <Aparecer retraso={80}>
            <Text style={s.seccion}>Ingredientes</Text>
            <View style={s.caja}>
              {receta.ingredientes.map((ing, i) => {
                const hecho = ingHechos.has(i);
                return (
                  <Pressable
                    key={`${ing.nombre}-${i}`}
                    onPress={() => alternar(ingHechos, i, setIngHechos)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: hecho }}
                    style={[s.ingrediente, i > 0 && s.separador]}
                  >
                    <Marca hecha={hecho} />
                    <Text style={[s.ingNombre, hecho && s.tachado]}>
                      {ing.nombre.charAt(0).toUpperCase() + ing.nombre.slice(1)}
                      {ing.nota ? <Text style={s.ingNota}> ({ing.nota})</Text> : null}
                    </Text>
                    <Text style={[s.ingCantidad, hecho && s.tachado]}>{cantidadTexto(ing.cantidad, ing.unidad, factor)}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Aparecer>

          <Aparecer retraso={140}>
            <Text style={s.seccion}>Preparación</Text>
            <View style={{ gap: space.md }}>
              {receta.pasos.map((paso, i) => {
                const hecho = pasosHechos.has(i);
                return (
                  <Pressable
                    key={i}
                    onPress={() => alternar(pasosHechos, i, setPasosHechos)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: hecho }}
                    style={[s.paso, hecho && { opacity: 0.55 }]}
                  >
                    <View>
                      <Text style={s.pasoEtiqueta}>Paso</Text>
                      <Text style={s.pasoNumero}>{i + 1}</Text>
                    </View>
                    <Text style={s.pasoTexto}>{paso}</Text>
                    <Marca hecha={hecho} />
                  </Pressable>
                );
              })}
            </View>
          </Aparecer>

          {receta.consejos?.length ? (
            <View>
              <Text style={s.seccion}>Consejos</Text>
              <View style={{ gap: space.sm }}>
                {receta.consejos.map((c) => (
                  <View key={c} style={[s.nota, { backgroundColor: colors.lemonSoft }]}>
                    <Text style={[type.body, { color: colors.ink }]}>💡 {c}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {receta.sustituciones?.length ? (
            <View>
              <Text style={s.seccion}>Si no tienes algo</Text>
              <View style={{ gap: space.sm }}>
                {receta.sustituciones.map((c) => (
                  <View key={c} style={[s.nota, { backgroundColor: colors.seaSoft }]}>
                    <Text style={[type.body, { color: colors.ink }]}>🔁 {c}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {nutricion.length ? (
            <View>
              <Text style={s.seccion}>Información nutricional</Text>
              <View style={s.nutricion}>
                {nutricion.map(([nombre, valor, unidad]) => (
                  <View key={nombre} style={s.dato}>
                    <Text style={s.datoValor}>
                      {valor}
                      {unidad}
                    </Text>
                    <Text style={s.datoNombre}>{nombre}</Text>
                  </View>
                ))}
              </View>
              <Text style={[type.small, { marginTop: space.sm }]}>Por ración, valores aproximados.</Text>
            </View>
          ) : null}

          <View style={[s.nota, { backgroundColor: colors.leafSoft, marginTop: space.xl }]}>
            <Text style={[type.small, { color: colors.ink2 }]}>
              {receta.alergenos?.length
                ? `Contiene: ${receta.alergenos.map((a) => NOMBRE_ALERGENO[a] ?? a).join(', ')}. `
                : 'Sin alérgenos declarados. '}
              Revisa siempre el etiquetado de los productos: pueden contener trazas.
            </Text>
          </View>
          {error ? <Aviso tono="rosa" texto={error} /> : null}
        </View>
      </ScrollView>

      {comida ? (
        <SafeAreaView edges={['bottom']} style={s.pie}>
          <Boton texto={comida.hecha ? '✓ Hecha' : 'Marcar como hecha'} variante={comida.hecha ? 'suave' : 'principal'} onPress={marcarComida} />
        </SafeAreaView>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.bg },
  centro: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.lg },
  portada: { height: 260, alignItems: 'center', justifyContent: 'center' },
  barra: { position: 'absolute', top: 0, left: 0, right: 0, padding: space.lg },
  volver: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', ...shadow },
  flecha: { fontSize: 28, lineHeight: 30, color: colors.ink, marginTop: -2 },
  emoji: { fontSize: 96 },
  hoja: { backgroundColor: colors.bg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, marginTop: -28, padding: space.xl, gap: space.sm },
  titulo: { fontSize: 28, fontWeight: '700', letterSpacing: -0.4, color: colors.ink, lineHeight: 33 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md },
  chip: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.surface },
  chipTexto: { fontSize: 14, fontWeight: '600', color: colors.ink2 },
  seccion: { fontSize: 21, fontWeight: '700', color: colors.ink, marginTop: space.xl, marginBottom: space.md },
  caja: { backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: space.lg, ...shadow },
  ingrediente: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 14 },
  separador: { borderTopWidth: 1, borderTopColor: colors.line },
  ingNombre: { flex: 1, fontSize: 17, color: colors.ink, lineHeight: 22 },
  ingNota: { fontSize: 14, color: colors.muted },
  ingCantidad: { fontSize: 16, fontWeight: '700', color: colors.ink },
  tachado: { color: colors.muted, textDecorationLine: 'line-through' },
  marca: { width: 28, height: 28, borderRadius: 9, borderWidth: 2, borderColor: '#D5D2C6', alignItems: 'center', justifyContent: 'center' },
  marcaHecha: { backgroundColor: colors.olive, borderColor: colors.olive },
  marcaTexto: { color: '#fff', fontWeight: '800', fontSize: 15 },
  paso: { flexDirection: 'row', gap: space.lg, alignItems: 'flex-start', backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg, ...shadow },
  pasoEtiqueta: { fontSize: 13, fontWeight: '700', color: colors.olive },
  pasoNumero: { fontSize: 32, fontWeight: '800', color: colors.ink, lineHeight: 36 },
  pasoTexto: { flex: 1, fontSize: 19, lineHeight: 27, color: colors.ink },
  nota: { borderRadius: radius.md, padding: space.lg },
  nutricion: { flexDirection: 'row', gap: space.sm },
  dato: { flex: 1, alignItems: 'center', paddingVertical: space.md, borderRadius: radius.sm, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.surface },
  datoValor: { fontSize: 17, fontWeight: '700', color: colors.ink },
  datoNombre: { fontSize: 11.5, color: colors.muted, marginTop: 2 },
  pie: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.xl, paddingTop: space.md, paddingBottom: space.md, backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.line },
});
