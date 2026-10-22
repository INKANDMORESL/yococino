// Lista de la compra a partir del menú: hoy, próximos 3 días o la semana.
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Aparecer, Aviso, BarraProgreso, Chip, Tarjeta } from '../../src/components';
import { borrarMarcas, cargarIngredientes, cargarMarcas, guardarMarca } from '../../src/features/compra/api';
import { SECCIONES, agruparCompra, cantidadCompra, type Articulo } from '../../src/features/compra/lista';
import { hoyISO, sumarDias } from '../../src/features/menu/fechas';
import { useAuth } from '../../src/lib/auth';
import { colors, radius, shadow, space, type } from '../../src/theme';

const RANGOS = [
  { clave: 'hoy', texto: 'Hoy', dias: 1 },
  { clave: '3d', texto: 'Próximos 3 días', dias: 3 },
  { clave: 'semana', texto: 'Esta semana', dias: 7 },
] as const;

export default function Compra() {
  const { sesion } = useAuth();
  const [rango, setRango] = useState<(typeof RANGOS)[number]['clave']>('3d');
  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [marcas, setMarcas] = useState<Set<string>>(new Set());
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const dias = RANGOS.find((r) => r.clave === rango)?.dias ?? 3;

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const hoy = hoyISO();
      const [comidas, m] = await Promise.all([cargarIngredientes(hoy, sumarDias(hoy, dias - 1)), cargarMarcas()]);
      setArticulos(agruparCompra(comidas));
      setMarcas(m);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No hemos podido cargar la lista.');
    } finally {
      setCargando(false);
    }
  }, [dias]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  const grupos = useMemo(
    () => SECCIONES.map((s) => ({ ...s, articulos: articulos.filter((a) => a.seccion === s.clave) })).filter((g) => g.articulos.length),
    [articulos],
  );
  const hechos = articulos.filter((a) => marcas.has(a.clave)).length;

  const alternar = async (a: Articulo) => {
    if (!sesion) return;
    const marcado = !marcas.has(a.clave);
    const nuevo = new Set(marcas);
    if (marcado) nuevo.add(a.clave);
    else nuevo.delete(a.clave);
    setMarcas(nuevo);
    try {
      await guardarMarca(sesion.user.id, a.clave, marcado);
    } catch (e) {
      setMarcas(marcas);
      setError(e instanceof Error ? e.message : 'No se ha podido guardar.');
    }
  };

  const vaciar = async () => {
    const previas = marcas;
    setMarcas(new Set());
    try {
      await borrarMarcas();
    } catch (e) {
      setMarcas(previas);
      setError(e instanceof Error ? e.message : 'No se ha podido vaciar la lista.');
    }
  };

  return (
    <SafeAreaView style={s.pantalla} edges={['top']}>
      <ScrollView contentContainerStyle={s.contenido}>
        <Aparecer>
          <Text style={type.display}>Lista de la compra</Text>
          <Text style={[type.body, { marginTop: 2 }]}>Sale sola de tu menú, con las cantidades ya sumadas.</Text>
        </Aparecer>

        <View style={s.chips}>
          {RANGOS.map((r) => (
            <Chip key={r.clave} texto={r.texto} elegido={rango === r.clave} onPress={() => setRango(r.clave)} />
          ))}
        </View>

        {error ? <Aviso tono="rosa" texto={error} /> : null}

        {articulos.length > 0 ? (
          <Tarjeta style={{ gap: space.sm }}>
            <View style={s.fila}>
              <Text style={type.heading}>
                {hechos} de {articulos.length} en el carro
              </Text>
              {hechos > 0 ? (
                <Pressable onPress={vaciar} accessibilityRole="button" hitSlop={8}>
                  <Text style={s.enlace}>Desmarcar todo</Text>
                </Pressable>
              ) : null}
            </View>
            <View style={{ flexDirection: 'row' }}>
              <BarraProgreso actual={hechos} total={Math.max(articulos.length, 1)} />
            </View>
          </Tarjeta>
        ) : null}

        {cargando ? (
          <Text style={type.body}>Preparando tu lista…</Text>
        ) : articulos.length === 0 ? (
          <Tarjeta style={s.vacio}>
            <Text style={{ fontSize: 44 }}>🛒</Text>
            <Text style={[type.body, { textAlign: 'center' }]}>Todavía no hay menú para estos días. Abre la pestaña Hoy para prepararlo.</Text>
          </Tarjeta>
        ) : (
          grupos.map((g, gi) => (
            <Aparecer key={g.clave} retraso={gi * 60}>
              <Text style={s.seccion}>
                {g.emoji} {g.texto}
              </Text>
              <View style={s.caja}>
                {g.articulos.map((a, i) => {
                  const marcado = marcas.has(a.clave);
                  return (
                    <Pressable
                      key={a.clave}
                      onPress={() => alternar(a)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: marcado }}
                      style={[s.articulo, i > 0 && s.separador]}
                    >
                      <View style={[s.marca, marcado && s.marcaHecha]}>{marcado ? <Text style={s.marcaTexto}>✓</Text> : null}</View>
                      <Text style={[s.nombre, marcado && s.tachado]}>{a.nombre}</Text>
                      <Text style={[s.cantidad, marcado && s.tachado]}>{cantidadCompra(a)}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </Aparecer>
          ))
        )}

        {articulos.length > 0 ? (
          <Text style={[type.small, { textAlign: 'center', marginTop: space.md }]}>
            Si tienes alergias, revisa el etiquetado de cada producto en la tienda.
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.bg },
  contenido: { padding: space.xl, gap: space.lg, paddingBottom: space.xxl },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  fila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  enlace: { color: colors.olive, fontWeight: '700', fontSize: 14 },
  vacio: { alignItems: 'center', gap: space.sm, paddingVertical: space.xxl },
  seccion: { fontSize: 18, fontWeight: '700', color: colors.ink, marginBottom: space.sm },
  caja: { backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: space.lg, ...shadow },
  articulo: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 14 },
  separador: { borderTopWidth: 1, borderTopColor: colors.line },
  marca: { width: 28, height: 28, borderRadius: 9, borderWidth: 2, borderColor: '#D5D2C6', alignItems: 'center', justifyContent: 'center' },
  marcaHecha: { backgroundColor: colors.olive, borderColor: colors.olive },
  marcaTexto: { color: '#fff', fontWeight: '800', fontSize: 15 },
  nombre: { flex: 1, fontSize: 17, color: colors.ink },
  cantidad: { fontSize: 15, fontWeight: '700', color: colors.ink2 },
  tachado: { color: colors.muted, textDecorationLine: 'line-through' },
});
