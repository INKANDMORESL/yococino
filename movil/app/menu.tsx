// Menú completo por semanas (como en Mi Dieta): flechas para pasar de semana y los 7 días con sus comidas.
// Se abre desde Inicio ("Ver menú completo") y cubre la semana actual hasta 30 días por delante.
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Aviso } from '../src/components';
import { ErrorMenu, cambiarPlato, cargarComidas, fotoReceta, marcarHecha } from '../src/features/menu/api';
import { deISO, hoyISO, sumarDias } from '../src/features/menu/fechas';
import { TIPOS, type Comida } from '../src/features/menu/tipos';
import { colors, radius, shadow, space, type } from '../src/theme';

const DIAS = 30;
const NOMBRES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const lunesDe = (iso: string) => {
  const d = deISO(iso);
  return sumarDias(iso, -((d.getDay() + 6) % 7));
};
const etiquetaSemana = (lunes: string) => {
  const a = deISO(lunes);
  const b = deISO(sumarDias(lunes, 6));
  return a.getMonth() === b.getMonth()
    ? `${a.getDate()} – ${b.getDate()} ${MESES[b.getMonth()]}`
    : `${a.getDate()} ${MESES[a.getMonth()]} – ${b.getDate()} ${MESES[b.getMonth()]}`;
};

function FilaComida({
  comida,
  onMarcar,
  onCambiar,
  cambiando,
}: {
  comida: Comida;
  onMarcar: () => void;
  onCambiar?: () => void;
  cambiando: boolean;
}) {
  const t = TIPOS[comida.tipo_comida] ?? TIPOS.otro;
  const abrir = () => {
    if (comida.receta_id) router.push({ pathname: '/receta/[id]', params: { id: String(comida.receta_id), comida: String(comida.id) } });
  };
  return (
    <View style={s.comida}>
      <Pressable onPress={abrir} accessibilityRole="button" accessibilityLabel={`${t.texto}: ${comida.receta?.nombre ?? ''}. Ver receta`} style={s.comidaZona}>
        <View style={[s.miniatura, { backgroundColor: t.fondo }]}>
          {comida.receta?.imagen ? <Image source={{ uri: comida.receta.imagen }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : <Text style={{ fontSize: 20 }}>{t.emoji}</Text>}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.comidaTipo}>{t.texto}</Text>
          <Text style={[s.comidaNombre, comida.hecha && { color: colors.muted }]} numberOfLines={2}>
            {comida.receta?.nombre ?? 'Plato sin receta'}
          </Text>
        </View>
      </Pressable>
      {onCambiar && !comida.hecha ? (
        <Pressable onPress={onCambiar} disabled={cambiando} accessibilityRole="button" accessibilityLabel="Cambiar este plato" hitSlop={6} style={s.cambiar}>
          {cambiando ? <ActivityIndicator size="small" color={colors.olive} /> : <Text style={s.cambiarTexto}>⇄</Text>}
        </Pressable>
      ) : null}
      <Pressable
        onPress={onMarcar}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: comida.hecha }}
        accessibilityLabel={comida.hecha ? 'Marcar como no hecha' : 'Marcar como hecha'}
        hitSlop={8}
        style={[s.check, comida.hecha && s.checkHecho]}
      >
        {comida.hecha ? <Text style={s.checkTexto}>✓</Text> : null}
      </Pressable>
    </View>
  );
}

export default function Menu() {
  const hoy = hoyISO();
  const primerLunes = lunesDe(hoy);
  const ultimoLunes = lunesDe(sumarDias(hoy, DIAS - 1));
  const [lunes, setLunes] = useState(primerLunes);
  const [comidas, setComidas] = useState<Comida[] | null>(null);
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
      const lista = await cargarComidas(primerLunes, sumarDias(hoy, DIAS - 1));
      if (activo.current) setComidas(lista);
    } catch (e) {
      setError(e instanceof ErrorMenu ? e.message : 'No hemos podido cargar tu menú.');
    }
  }, [primerLunes, hoy]);

  useFocusEffect(
    useCallback(() => {
      recargar();
    }, [recargar]),
  );

  const semana = useMemo(() => Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i)), [lunes]);
  const porDia = useMemo(() => {
    const m = new Map<string, Comida[]>();
    for (const c of comidas ?? []) m.set(c.fecha, [...(m.get(c.fecha) ?? []), c]);
    return m;
  }, [comidas]);
  const deLaSemana = useMemo(() => semana.flatMap((d) => porDia.get(d) ?? []), [semana, porDia]);
  const hechas = deLaSemana.filter((c) => c.hecha).length;

  // Fotos de los platos de la semana que se ve (la primera vez se generan; luego quedan guardadas).
  const fotosPedidas = useRef<Set<number>>(new Set());
  useEffect(() => {
    // Solo de hoy a 6 días vista, para no gastar en fotos de días lejanos.
    const limite = sumarDias(hoy, 6);
    const sinFoto = [
      ...new Set(
        deLaSemana
          .filter((c) => c.fecha >= hoy && c.fecha <= limite && c.receta && !c.receta.imagen && !fotosPedidas.current.has(c.receta.id))
          .map((c) => c.receta!.id),
      ),
    ];
    if (!sinFoto.length) return;
    sinFoto.forEach((id) => fotosPedidas.current.add(id));
    (async () => {
      for (const id of sinFoto) {
        const url = await fotoReceta(id).catch(() => null);
        if (!url || !activo.current) continue;
        setComidas((prev) => (prev ?? []).map((c) => (c.receta && c.receta.id === id ? { ...c, receta: { ...c.receta, imagen: url } } : c)));
      }
    })();
  }, [deLaSemana, hoy]);

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

  const puedeAtras = lunes > primerLunes;
  const puedeAdelante = lunes < ultimoLunes;

  return (
    <SafeAreaView style={s.pantalla} edges={['top']}>
      <View style={s.cabecera}>
        <Pressable onPress={() => router.navigate('/inicio')} accessibilityRole="button" accessibilityLabel="Volver" hitSlop={8} style={s.redondo}>
          <Text style={s.flecha}>‹</Text>
        </Pressable>
        <Text style={[type.title, { flex: 1 }]}>Menú</Text>
        {lunes !== primerLunes ? (
          <Pressable onPress={() => setLunes(primerLunes)} accessibilityRole="button" style={s.hoy}>
            <Text style={s.hoyTexto}>HOY</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={s.semana}>
        <Pressable
          onPress={() => puedeAtras && setLunes(sumarDias(lunes, -7))}
          disabled={!puedeAtras}
          accessibilityRole="button"
          accessibilityLabel="Semana anterior"
          style={[s.redondo, !puedeAtras && { opacity: 0.35 }]}
        >
          <Text style={s.flechaPeq}>‹</Text>
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={s.semanaTitulo}>{etiquetaSemana(lunes)}</Text>
          <Text style={type.small}>{deLaSemana.length ? `${hechas} de ${deLaSemana.length} comidas hechas` : 'Semana sin menú todavía'}</Text>
        </View>
        <Pressable
          onPress={() => puedeAdelante && setLunes(sumarDias(lunes, 7))}
          disabled={!puedeAdelante}
          accessibilityRole="button"
          accessibilityLabel="Semana siguiente"
          style={[s.redondo, !puedeAdelante && { opacity: 0.35 }]}
        >
          <Text style={s.flechaPeq}>›</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={s.contenido}>
        {error ? <Aviso tono="rosa" texto={error} /> : null}
        {aviso ? <Aviso tono="hoja" texto={aviso} /> : null}
        {comidas === null ? (
          <ActivityIndicator color={colors.olive} style={{ marginTop: space.xxl }} />
        ) : (
          semana.map((d, i) => {
            const lista = porDia.get(d) ?? [];
            const esHoy = d === hoy;
            const pasado = d < hoy;
            return (
              <View key={d} style={[s.dia, esHoy && s.diaHoy, pasado && { opacity: 0.6 }]}>
                <View style={s.diaTitulo}>
                  <Text style={s.diaNombre}>{NOMBRES[i]}</Text>
                  <Text style={s.diaNumero}>{deISO(d).getDate()}</Text>
                  {esHoy ? (
                    <View style={s.etiqueta}>
                      <Text style={s.etiquetaTexto}>Hoy</Text>
                    </View>
                  ) : lista.length ? (
                    <Text style={s.cuenta}>
                      {lista.filter((c) => c.hecha).length}/{lista.length}
                    </Text>
                  ) : null}
                </View>
                {lista.length ? (
                  lista.map((c, j) => (
                    <View key={c.id} style={j > 0 ? s.separador : null}>
                      <FilaComida comida={c} onMarcar={() => marcar(c)} onCambiar={c.fecha >= hoy ? () => cambiar(c) : undefined} cambiando={cambiando === c.id} />
                    </View>
                  ))
                ) : (
                  <Text style={[type.small, { paddingVertical: space.sm }]}>{d < hoy ? 'Sin comidas' : d > sumarDias(hoy, DIAS - 1) ? 'Aún no toca' : 'Preparándose…'}</Text>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.bg },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.xl, paddingTop: space.md, paddingBottom: space.md },
  redondo: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', ...shadow },
  flecha: { fontSize: 28, lineHeight: 30, color: colors.ink, marginTop: -2 },
  flechaPeq: { fontSize: 24, lineHeight: 26, color: colors.ink, marginTop: -2 },
  hoy: { backgroundColor: colors.ink, borderRadius: 999, paddingHorizontal: 16, height: 38, justifyContent: 'center' },
  hoyTexto: { color: '#fff', fontWeight: '800', fontSize: 13, letterSpacing: 0.5 },
  semana: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.xl, paddingBottom: space.md },
  semanaTitulo: { fontSize: 18, fontWeight: '700', color: colors.ink },
  contenido: { paddingHorizontal: space.xl, paddingBottom: space.xxl, gap: space.md },
  dia: { backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: space.lg, paddingVertical: space.md, ...shadow },
  diaHoy: { borderWidth: 2, borderColor: colors.olive },
  diaTitulo: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm, marginBottom: space.xs },
  diaNombre: { fontSize: 17, fontWeight: '700', color: colors.ink },
  diaNumero: { fontSize: 15, color: colors.muted, flex: 1 },
  etiqueta: { backgroundColor: colors.olive, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  etiquetaTexto: { color: '#fff', fontSize: 12, fontWeight: '800' },
  cuenta: { fontSize: 13, fontWeight: '700', color: colors.oliveInk },
  separador: { borderTopWidth: 1, borderTopColor: colors.line },
  comida: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm },
  comidaZona: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md },
  miniatura: { width: 44, height: 44, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  comidaTipo: { fontSize: 12, fontWeight: '700', color: colors.muted },
  comidaNombre: { fontSize: 15, fontWeight: '600', color: colors.ink, lineHeight: 20 },
  cambiar: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.leafSoft, alignItems: 'center', justifyContent: 'center' },
  cambiarTexto: { fontSize: 16, fontWeight: '700', color: colors.olive },
  check: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: '#DAD7CC', alignItems: 'center', justifyContent: 'center' },
  checkHecho: { backgroundColor: colors.olive, borderColor: colors.olive },
  checkTexto: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
