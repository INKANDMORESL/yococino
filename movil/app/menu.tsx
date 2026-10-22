// Menú completo: los 30 días por delante, día a día. Se abre desde Inicio ("Ver menú completo").
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Aparecer, Aviso, Tarjeta } from '../src/components';
import { ErrorMenu, cambiarPlato, cargarComidas, fotoReceta, marcarHecha } from '../src/features/menu/api';
import { hoyISO, nombreDia, sumarDias } from '../src/features/menu/fechas';
import { SelectorDias } from '../src/features/menu/SelectorDias';
import { TarjetaComida } from '../src/features/menu/TarjetaComida';
import type { Comida } from '../src/features/menu/tipos';
import { colors, space, type } from '../src/theme';

const DIAS = 30;

export default function Menu() {
  const hoy = hoyISO();
  const dias = useMemo(() => Array.from({ length: DIAS }, (_, i) => sumarDias(hoy, i)), [hoy]);
  const [comidas, setComidas] = useState<Comida[] | null>(null);
  const [elegido, setElegido] = useState(hoy);
  const [cambiando, setCambiando] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const activo = useRef(true);

  useEffect(() => {
    activo.current = true;
    return () => {
      activo.current = false;
    };
  }, []);

  const recargar = useCallback(async () => {
    try {
      const lista = await cargarComidas(dias[0], dias[DIAS - 1]);
      if (activo.current) setComidas(lista);
    } catch (e) {
      setError(e instanceof ErrorMenu ? e.message : 'No hemos podido cargar tu menú.');
    }
  }, [dias]);

  useFocusEffect(
    useCallback(() => {
      recargar();
    }, [recargar]),
  );

  const porDia = useMemo(() => {
    const m = new Map<string, Comida[]>();
    for (const c of comidas ?? []) m.set(c.fecha, [...(m.get(c.fecha) ?? []), c]);
    return m;
  }, [comidas]);
  const listos = useMemo(() => new Set(porDia.keys()), [porDia]);
  const completos = useMemo(
    () => new Set([...porDia.entries()].filter(([, l]) => l.length > 0 && l.every((c) => c.hecha)).map(([d]) => d)),
    [porDia],
  );
  const delDia = porDia.get(elegido) ?? [];

  // Fotos de los platos del día elegido (la primera vez se generan; luego quedan guardadas).
  const fotosPedidas = useRef<Set<number>>(new Set());
  useEffect(() => {
    const sinFoto = delDia.filter((c) => c.receta && !c.receta.imagen && !fotosPedidas.current.has(c.receta.id)).map((c) => c.receta!.id);
    if (!sinFoto.length) return;
    sinFoto.forEach((id) => fotosPedidas.current.add(id));
    (async () => {
      for (const id of sinFoto) {
        const url = await fotoReceta(id).catch(() => null);
        if (!url || !activo.current) continue;
        setComidas((prev) => (prev ?? []).map((c) => (c.receta && c.receta.id === id ? { ...c, receta: { ...c.receta, imagen: url } } : c)));
      }
    })();
  }, [delDia]);

  const marcar = async (c: Comida) => {
    const nuevo = !c.hecha;
    setComidas((prev) => (prev ?? []).map((x) => (x.id === c.id ? { ...x, hecha: nuevo } : x)));
    try {
      await marcarHecha(c.id, nuevo);
    } catch (e) {
      setComidas((prev) => (prev ?? []).map((x) => (x.id === c.id ? { ...x, hecha: !nuevo } : x)));
      setError(e instanceof Error ? e.message : 'No se ha podido guardar.');
    }
  };

  const cambiar = async (c: Comida) => {
    if (cambiando) return;
    setCambiando(c.id);
    setError(null);
    setAviso(null);
    try {
      const r = await cambiarPlato(c.id);
      await recargar();
      setAviso(`Cambiado por: ${r.nombre}.`);
    } catch (e) {
      setError(e instanceof ErrorMenu ? e.message : 'No hemos podido cambiar el plato.');
    } finally {
      setCambiando(null);
    }
  };

  const hechas = delDia.filter((c) => c.hecha).length;

  return (
    <SafeAreaView style={s.pantalla} edges={['top']}>
      <View style={s.cabecera}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Volver" style={s.volver}>
          <Text style={s.flecha}>‹</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={type.title}>Menú del mes</Text>
          <Text style={type.small}>Los próximos 30 días</Text>
        </View>
        {elegido !== hoy ? (
          <Pressable onPress={() => setElegido(hoy)} accessibilityRole="button" style={s.hoy}>
            <Text style={s.hoyTexto}>HOY</Text>
          </Pressable>
        ) : null}
      </View>

      <SelectorDias dias={dias} elegido={elegido} onElegir={setElegido} listos={listos} completos={completos} />

      <ScrollView contentContainerStyle={s.contenido}>
        <View style={s.fila}>
          <Text style={type.title}>{nombreDia(elegido)}</Text>
          {delDia.length ? (
            <Text style={type.small}>
              {hechas} de {delDia.length} hechas
            </Text>
          ) : null}
        </View>
        {error ? <Aviso tono="rosa" texto={error} /> : null}
        {aviso ? <Aviso tono="hoja" texto={aviso} /> : null}
        {comidas === null ? (
          <Tarjeta style={s.vacio}>
            <Text style={type.body}>Cargando tu menú…</Text>
          </Tarjeta>
        ) : delDia.length === 0 ? (
          <Tarjeta style={s.vacio}>
            <Text style={{ fontSize: 40 }}>🍳</Text>
            <Text style={[type.body, { textAlign: 'center' }]}>Este día aún se está preparando. Vuelve en un momento.</Text>
          </Tarjeta>
        ) : (
          <View key={elegido} style={{ gap: space.md }}>
            {delDia.map((c, i) => (
              <Aparecer key={c.id} retraso={i * 50} desde={10}>
                <TarjetaComida comida={c} onMarcar={() => marcar(c)} onCambiar={c.fecha >= hoy ? () => cambiar(c) : undefined} cambiando={cambiando === c.id} />
              </Aparecer>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.bg },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.xl, paddingTop: space.md, paddingBottom: space.lg },
  volver: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  flecha: { fontSize: 28, lineHeight: 30, color: colors.ink, marginTop: -2 },
  hoy: { backgroundColor: colors.ink, borderRadius: 999, paddingHorizontal: 16, height: 38, justifyContent: 'center' },
  hoyTexto: { color: '#fff', fontWeight: '800', fontSize: 13, letterSpacing: 0.5 },
  contenido: { padding: space.xl, gap: space.md, paddingBottom: space.xxl },
  fila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  vacio: { alignItems: 'center', gap: space.sm, paddingVertical: space.xxl },
});
