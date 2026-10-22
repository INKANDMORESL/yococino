// Lista de la compra a partir del menú: hoy, próximos 3 días o la semana.
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Aparecer, Aviso, BarraProgreso, Chip, Tarjeta } from '../../src/components';
import { borrarMarcas, cargarComensales, cargarIngredientes, cargarMarcas, guardarComensales, guardarMarca } from '../../src/features/compra/api';
import { SECCIONES, agruparCompra, cantidadCompra, type Articulo, type ComidaConIngredientes, type Comensales } from '../../src/features/compra/lista';
import { hoyISO, sumarDias } from '../../src/features/menu/fechas';
import { useAuth } from '../../src/lib/auth';
import { colors, radius, shadow, space, type } from '../../src/theme';

const RANGOS = [
  { clave: 'hoy', texto: 'Hoy', dias: 1 },
  { clave: '3d', texto: 'Próximos 3 días', dias: 3 },
  { clave: 'semana', texto: 'Esta semana', dias: 7 },
] as const;

function Contador({ texto, valor, min, max, cambiar }: { texto: string; valor: number; min: number; max: number; cambiar: (v: number) => void }) {
  return (
    <View style={s.contador}>
      <Text style={[type.body, { flex: 1, color: colors.ink }]}>{texto}</Text>
      <Pressable
        onPress={() => valor > min && cambiar(valor - 1)}
        disabled={valor <= min}
        accessibilityRole="button"
        accessibilityLabel={`Quitar uno: ${texto}`}
        style={[s.boton, valor <= min && { opacity: 0.35 }]}
      >
        <Text style={s.botonTexto}>−</Text>
      </Pressable>
      <Text style={s.valor} accessibilityLiveRegion="polite">
        {valor}
      </Text>
      <Pressable
        onPress={() => valor < max && cambiar(valor + 1)}
        disabled={valor >= max}
        accessibilityRole="button"
        accessibilityLabel={`Añadir uno: ${texto}`}
        style={[s.boton, valor >= max && { opacity: 0.35 }]}
      >
        <Text style={s.botonTexto}>+</Text>
      </Pressable>
    </View>
  );
}

export default function Compra() {
  const { sesion } = useAuth();
  const [rango, setRango] = useState<(typeof RANGOS)[number]['clave']>('3d');
  const [comidas, setComidas] = useState<ComidaConIngredientes[]>([]);
  const [casa, setCasa] = useState<Comensales | null>(null);
  const casaCargada = useRef(false);
  const articulos: Articulo[] = useMemo(() => agruparCompra(comidas, casa ?? undefined), [comidas, casa]);
  const [marcas, setMarcas] = useState<Set<string>>(new Set());
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const dias = RANGOS.find((r) => r.clave === rango)?.dias ?? 3;

  // "Preparando tu lista…" solo la primera vez; después se actualiza sin vaciar la pantalla.
  const cargar = useCallback(async () => {
    setError(null);
    try {
      const hoy = hoyISO();
      const [lista, m] = await Promise.all([cargarIngredientes(hoy, sumarDias(hoy, dias - 1)), cargarMarcas()]);
      setComidas(lista);
      setMarcas(m);
      // Los comensales se leen una sola vez; luego los cambia la propia pantalla.
      if (!casaCargada.current) {
        casaCargada.current = true;
        setCasa(await cargarComensales().catch(() => ({ adultos: 1, peques: 0 })));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No hemos podido cargar la lista.');
    } finally {
      setCargando(false);
    }
  }, [dias]);

  // Se carga un poco después de entrar para que el cambio de pestaña vaya fluido.
  useFocusEffect(
    useCallback(() => {
      const t = setTimeout(cargar, 260);
      return () => clearTimeout(t);
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

  // Cambiar cuántos coméis: se recalcula al momento y se guarda para la próxima vez.
  const cambiarCasa = (nueva: Comensales) => {
    setCasa(nueva);
    if (sesion) guardarComensales(sesion.user.id, nueva).catch((e) => setError(e instanceof Error ? e.message : 'No se ha podido guardar.'));
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

        {casa ? (
          <Tarjeta style={{ gap: space.md }}>
            <Text style={type.heading}>¿Cuántos coméis en casa?</Text>
            <Contador texto="Adultos (contándote a ti)" valor={casa.adultos} min={1} max={10} cambiar={(v) => cambiarCasa({ ...casa, adultos: v })} />
            <Contador texto="Peques" valor={casa.peques} min={0} max={10} cambiar={(v) => cambiarCasa({ ...casa, peques: v })} />
            <Text style={type.small}>Tu ración va ajustada a tu plan. Para los demás adultos, ración normal; para cada peque, algo más de media.</Text>
          </Tarjeta>
        ) : null}

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
  contador: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  boton: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.leaf, alignItems: 'center', justifyContent: 'center' },
  botonTexto: { fontSize: 22, fontWeight: '700', color: colors.oliveInk, lineHeight: 24 },
  valor: { fontSize: 20, fontWeight: '800', color: colors.ink, minWidth: 28, textAlign: 'center' },
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
