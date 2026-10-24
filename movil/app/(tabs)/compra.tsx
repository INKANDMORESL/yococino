// Lista de la compra a partir del menú: hoy, próximos 3 días o próximos 7 días.
// Con «Recetas de la lista» se eligen qué recetas del menú entran en la compra.
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Aparecer, Aviso, BarraProgreso, Chip, Contador, Tarjeta } from '../../src/components';
import { borrarMarcas, cargarComensales, cargarFuera, cargarIngredientes, cargarMarcas, guardarComensales, guardarFuera, guardarMarca } from '../../src/features/compra/api';
import { SECCIONES, agruparCompra, cantidadCompra, type Articulo, type ComidaConIngredientes, type Comensales } from '../../src/features/compra/lista';
import { deISO, hoyISO, sumarDias } from '../../src/features/menu/fechas';
import { TIPOS, type TipoComida } from '../../src/features/menu/tipos';
import { useAuth } from '../../src/lib/auth';
import { guardarCache, leerCache } from '../../src/lib/cache';
import { colors, radius, shadow, space, type } from '../../src/theme';

const RANGOS = [
  { clave: 'hoy', texto: 'Hoy', dias: 1 },
  { clave: '3d', texto: 'Próximos 3 días', dias: 3 },
  { clave: 'semana', texto: 'Próximos 7 días', dias: 7 },
] as const;

const nombreDia = (iso: string) => {
  const hoy = hoyISO();
  if (iso === hoy) return 'Hoy';
  if (iso === sumarDias(hoy, 1)) return 'Mañana';
  return deISO(iso).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' });
};

export default function Compra() {
  const { sesion } = useAuth();
  const [rango, setRango] = useState<(typeof RANGOS)[number]['clave']>('3d');
  const [comidas, setComidas] = useState<ComidaConIngredientes[]>(leerCache('compra:3d') ?? []);
  const [casa, setCasa] = useState<Comensales | null>(leerCache('compra:casa') ?? null);
  const casaCargada = useRef(!!leerCache('compra:casa'));
  // Recetas quitadas de la lista con el filtro (se recuerdan en el móvil).
  const [fuera, setFuera] = useState<Set<number>>(leerCache('compra:fuera') ?? new Set());
  const [verFiltro, setVerFiltro] = useState(false);
  const elegidas = useMemo(() => comidas.filter((c) => !c.id || !fuera.has(c.id)), [comidas, fuera]);
  const articulos: Articulo[] = useMemo(() => agruparCompra(elegidas, casa ?? undefined), [elegidas, casa]);
  const conReceta = comidas.filter((c) => c.receta && c.id);
  const porDia = useMemo(() => {
    const m = new Map<string, ComidaConIngredientes[]>();
    for (const c of conReceta) {
      const f = c.fecha ?? '';
      m.set(f, [...(m.get(f) ?? []), c]);
    }
    return [...m.entries()];
  }, [conReceta]);
  const cambiarFuera = (nuevo: Set<number>) => {
    setFuera(guardarCache('compra:fuera', nuevo));
    guardarFuera(nuevo);
  };
  const [marcas, setMarcas] = useState<Set<string>>(leerCache('compra:marcas') ?? new Set());
  const [cargando, setCargando] = useState(!leerCache('compra:3d'));
  const [error, setError] = useState<string | null>(null);

  const dias = RANGOS.find((r) => r.clave === rango)?.dias ?? 3;

  // "Preparando tu lista…" solo la primera vez; después se actualiza sin vaciar la pantalla.
  const cargar = useCallback(async () => {
    setError(null);
    const enMemoria = leerCache<ComidaConIngredientes[]>(`compra:${rango}`);
    if (enMemoria) setComidas(enMemoria);
    try {
      const hoy = hoyISO();
      const [lista, m, f] = await Promise.all([cargarIngredientes(hoy, sumarDias(hoy, dias - 1)), cargarMarcas(), cargarFuera()]);
      setFuera(guardarCache('compra:fuera', f));
      guardarCache(`compra:${rango}`, lista);
      guardarCache('compra:marcas', m);
      setComidas(lista);
      setMarcas(m);
      // Los comensales se leen una sola vez; luego los cambia la propia pantalla.
      if (!casaCargada.current) {
        casaCargada.current = true;
        setCasa(guardarCache('compra:casa', await cargarComensales().catch(() => ({ adultos: 1, peques: 0 }))));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No hemos podido cargar la lista.');
    } finally {
      setCargando(false);
    }
  }, [dias, rango]);

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
    setCasa(guardarCache('compra:casa', nueva));
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

        {conReceta.length ? (
          <Tarjeta style={{ gap: space.md }}>
            <Pressable onPress={() => setVerFiltro(!verFiltro)} accessibilityRole="button" style={s.fila}>
              <View style={{ flex: 1 }}>
                <Text style={type.heading}>🍽️ Recetas de la lista</Text>
                <Text style={type.small}>
                  {conReceta.length - conReceta.filter((c) => fuera.has(c.id as number)).length} de {conReceta.length} recetas incluidas
                  {fuera.size && conReceta.some((c) => fuera.has(c.id as number)) ? ' · has quitado algunas' : ''}
                </Text>
              </View>
              <Text style={s.enlace}>{verFiltro ? 'Cerrar' : 'Elegir'}</Text>
            </Pressable>
            {verFiltro ? (
              <View style={{ gap: space.md }}>
                <View style={[s.fila, { justifyContent: 'flex-start', gap: space.lg }]}>
                  <Pressable
                    onPress={() => {
                      const n = new Set(fuera);
                      conReceta.forEach((c) => n.delete(c.id as number));
                      cambiarFuera(n);
                    }}
                    accessibilityRole="button"
                  >
                    <Text style={s.enlace}>Todas</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      const n = new Set(fuera);
                      conReceta.forEach((c) => n.add(c.id as number));
                      cambiarFuera(n);
                    }}
                    accessibilityRole="button"
                  >
                    <Text style={s.enlace}>Ninguna</Text>
                  </Pressable>
                </View>
                {porDia.map(([fecha, lista]) => (
                  <View key={fecha} style={{ gap: 2 }}>
                    <Text style={s.dia}>{nombreDia(fecha)}</Text>
                    {lista.map((c) => {
                      const dentro = !fuera.has(c.id as number);
                      const t = TIPOS[(c.tipo_comida ?? 'otro') as TipoComida] ?? TIPOS.otro;
                      return (
                        <Pressable
                          key={c.id}
                          onPress={() => {
                            const n = new Set(fuera);
                            if (dentro) n.add(c.id as number);
                            else n.delete(c.id as number);
                            cambiarFuera(n);
                          }}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: dentro }}
                          style={s.receta}
                        >
                          <View style={[s.marca, dentro && s.marcaHecha]}>{dentro ? <Text style={s.marcaTexto}>✓</Text> : null}</View>
                          <View style={{ flex: 1 }}>
                            <Text style={type.small}>{t.texto}</Text>
                            <Text style={[s.recetaNombre, !dentro && s.tachado]} numberOfLines={2}>
                              {c.receta?.nombre}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                ))}
              </View>
            ) : null}
          </Tarjeta>
        ) : null}

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
  dia: { fontSize: 14, fontWeight: '800', color: colors.olive, marginTop: space.sm, textTransform: 'capitalize' },
  receta: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 8 },
  recetaNombre: { fontSize: 15, fontWeight: '600', color: colors.ink },
});
