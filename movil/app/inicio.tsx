// Inicio: qué toca comer hoy y los próximos 30 días. Mientras faltan días, los va preparando.
import { Redirect, router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Aparecer, Aviso, Boton, Saltar, Tarjeta } from '../src/components';
import { ErrorMenu, cargarComidas, marcarHecha, perfilBasico, prepararMenu } from '../src/features/menu/api';
import { fechaLarga, hoyISO, nombreDia, sumarDias } from '../src/features/menu/fechas';
import { PreparandoMenu } from '../src/features/menu/PreparandoMenu';
import { SelectorDias } from '../src/features/menu/SelectorDias';
import { TarjetaComida } from '../src/features/menu/TarjetaComida';
import type { Comida } from '../src/features/menu/tipos';
import { useAuth } from '../src/lib/auth';
import { guardarEncuestaPendiente } from '../src/lib/perfil';
import { colors, space, type } from '../src/theme';

const DIAS = 30;
const HORA_COMIDA: Record<string, number> = { desayuno: 8, media_manana: 11, almuerzo: 14, merienda: 17, cena: 21 };

const saludo = () => {
  const h = new Date().getHours();
  return h < 13 ? 'Buenos días' : h < 21 ? 'Buenas tardes' : 'Buenas noches';
};

type Estado =
  | { tipo: 'cargando' }
  | { tipo: 'sin_encuesta' }
  | { tipo: 'bloqueado'; mensaje: string }
  | { tipo: 'listo' };

export default function Inicio() {
  const { sesion, cargando: cargandoSesion, salir } = useAuth();
  const hoy = hoyISO();
  const dias = useMemo(() => Array.from({ length: DIAS }, (_, i) => sumarDias(hoy, i)), [hoy]);
  const [estado, setEstado] = useState<Estado>({ tipo: 'cargando' });
  const [comidas, setComidas] = useState<Comida[]>([]);
  const [elegido, setElegido] = useState(hoy);
  const [preparando, setPreparando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refrescando, setRefrescando] = useState(false);
  const activo = useRef(true);
  const enMarcha = useRef(false);

  useEffect(() => {
    activo.current = true;
    return () => {
      activo.current = false;
    };
  }, []);

  const recargar = useCallback(async () => {
    const lista = await cargarComidas(dias[0], dias[DIAS - 1]);
    if (activo.current) setComidas(lista);
    return lista;
  }, [dias]);

  // Pide días al servidor hasta completar el mes. Primero 1 (rápido) y luego de 2 en 2.
  const completarMes = useCallback(async () => {
    if (enMarcha.current) return;
    enMarcha.current = true;
    setPreparando(true);
    setError(null);
    try {
      let lote = 1;
      let fallosSeguidos = 0;
      while (activo.current) {
        try {
          const r = await prepararMenu(lote);
          fallosSeguidos = 0;
          await recargar();
          if (r.pendientes === 0) break;
          lote = 2;
        } catch (e) {
          const codigo = e instanceof ErrorMenu ? e.codigo : 'red';
          const base = e instanceof Error ? e.message : 'No hemos podido preparar tu menú.';
          const detalle = e instanceof ErrorMenu && e.detalle ? `\n\nDetalle técnico: ${e.detalle}` : '';
          const mensaje = base + detalle;
          if (codigo === 'sin_encuesta') {
            setEstado({ tipo: 'sin_encuesta' });
            break;
          }
          if (['menor', 'profesional', 'sin_consentimiento'].includes(codigo)) {
            setEstado({ tipo: 'bloqueado', mensaje });
            break;
          }
          if (codigo === 'ia_no_configurada' || ++fallosSeguidos >= 2) {
            setError(mensaje);
            break;
          }
        }
      }
    } finally {
      enMarcha.current = false;
      if (activo.current) setPreparando(false);
    }
  }, [recargar]);

  // Al entrar: comprobar la encuesta, cargar el menú y completar lo que falte.
  useEffect(() => {
    if (!sesion) return;
    (async () => {
      try {
        let perfil = await perfilBasico(sesion.user.id);
        if (!perfil?.encuesta_completada_at) {
          await guardarEncuestaPendiente(sesion.user.id).catch(() => {});
          perfil = await perfilBasico(sesion.user.id);
        }
        if (!perfil?.encuesta_completada_at) {
          setEstado({ tipo: 'sin_encuesta' });
          return;
        }
        const lista = await recargar();
        setEstado({ tipo: 'listo' });
        const conMenu = new Set(lista.map((c) => c.fecha));
        if (dias.some((d) => !conMenu.has(d))) completarMes();
      } catch (e) {
        setEstado({ tipo: 'listo' });
        setError(e instanceof Error ? e.message : 'No hemos podido cargar tu menú.');
      }
    })();
  }, [sesion, recargar, completarMes, dias]);

  const porDia = useMemo(() => {
    const m = new Map<string, Comida[]>();
    for (const c of comidas) m.set(c.fecha, [...(m.get(c.fecha) ?? []), c]);
    return m;
  }, [comidas]);
  const listos = useMemo(() => new Set(porDia.keys()), [porDia]);
  const completos = useMemo(
    () => new Set([...porDia.entries()].filter(([, l]) => l.length > 0 && l.every((c) => c.hecha)).map(([d]) => d)),
    [porDia],
  );

  const delDia = porDia.get(elegido) ?? [];
  const horaActual = new Date().getHours();
  const siguienteId = elegido === hoy ? delDia.find((c) => !c.hecha && (HORA_COMIDA[c.tipo_comida] ?? 0) + 2 > horaActual)?.id : undefined;
  const hechasHoy = (porDia.get(hoy) ?? []).filter((c) => c.hecha).length;
  const totalHoy = (porDia.get(hoy) ?? []).length;

  const marcar = async (c: Comida) => {
    const nuevo = !c.hecha;
    setComidas((prev) => prev.map((x) => (x.id === c.id ? { ...x, hecha: nuevo } : x)));
    try {
      await marcarHecha(c.id, nuevo);
    } catch (e) {
      setComidas((prev) => prev.map((x) => (x.id === c.id ? { ...x, hecha: !nuevo } : x)));
      setError(e instanceof Error ? e.message : 'No se ha podido guardar.');
    }
  };

  const refrescar = async () => {
    setRefrescando(true);
    try {
      const lista = await recargar();
      const conMenu = new Set(lista.map((c) => c.fecha));
      if (dias.some((d) => !conMenu.has(d))) completarMes();
    } finally {
      setRefrescando(false);
    }
  };

  if (!cargandoSesion && !sesion) return <Redirect href="/" />;

  if (estado.tipo === 'sin_encuesta') {
    return (
      <SafeAreaView style={s.centro}>
        <Saltar>
          <Text style={{ fontSize: 52 }}>📝</Text>
        </Saltar>
        <Text style={[type.title, s.centrado]}>Nos falta tu encuesta</Text>
        <Text style={[type.body, s.centrado]}>Son 2 minutos y con ella preparamos tu menú.</Text>
        <View style={{ alignSelf: 'stretch', gap: space.md, marginTop: space.lg }}>
          <Boton texto="Hacer la encuesta" onPress={() => router.push('/encuesta')} />
          <Boton texto="Cerrar sesión" variante="linea" onPress={salir} />
        </View>
      </SafeAreaView>
    );
  }

  if (estado.tipo === 'bloqueado') {
    return (
      <SafeAreaView style={s.centro}>
        <Text style={{ fontSize: 52 }}>🩺</Text>
        <Text style={[type.body, s.centrado, { color: colors.ink }]}>{estado.mensaje}</Text>
        <View style={{ alignSelf: 'stretch', marginTop: space.lg }}>
          <Boton texto="Cerrar sesión" variante="linea" onPress={salir} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.pantalla} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: space.xxl }}
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} tintColor={colors.olive} />}
      >
        <Aparecer style={s.cabecera}>
          <Text style={type.display}>{saludo()}</Text>
          <Text style={[type.body, { marginTop: 2 }]}>
            {fechaLarga(hoy)}
            {totalHoy ? ` · ${hechasHoy} de ${totalHoy} comidas hechas` : ''}
          </Text>
        </Aparecer>

        <Aparecer retraso={80}>
          <SelectorDias dias={dias} elegido={elegido} onElegir={setElegido} listos={listos} completos={completos} />
        </Aparecer>

        <View style={s.contenido}>
          {preparando ? <PreparandoMenu listos={listos.size} total={DIAS} /> : null}
          {error ? <Aviso tono="rosa" texto={error} /> : null}
          {error && !preparando ? <Boton texto="Reintentar" variante="suave" onPress={completarMes} /> : null}

          <Text style={[type.title, { marginTop: space.sm }]}>{nombreDia(elegido)}</Text>

          {estado.tipo === 'cargando' ? (
            <Tarjeta style={s.vacio}>
              <Text style={type.body}>Cargando tu menú…</Text>
            </Tarjeta>
          ) : delDia.length === 0 ? (
            <Tarjeta style={s.vacio}>
              <Text style={{ fontSize: 40 }}>🍳</Text>
              <Text style={[type.body, s.centrado]}>{preparando ? 'Estamos preparando este día. Aparecerá en unos segundos.' : 'Este día aún no tiene menú.'}</Text>
            </Tarjeta>
          ) : (
            <View key={elegido} style={{ gap: space.md }}>
              {delDia.map((c, i) => (
                <Aparecer key={c.id} retraso={i * 60} desde={12}>
                  <TarjetaComida comida={c} siguiente={c.id === siguienteId} onMarcar={() => marcar(c)} />
                </Aparecer>
              ))}
            </View>
          )}

          <Text style={[type.small, s.aviso]}>
            Menú orientativo: no sustituye el consejo de un profesional sanitario. Revisa siempre el etiquetado de los productos.
          </Text>
          <Pressable onPress={salir} accessibilityRole="button" style={s.salir}>
            <Text style={s.salirTexto}>Cerrar sesión</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.bg },
  cabecera: { paddingHorizontal: space.xl, paddingTop: space.lg, paddingBottom: space.lg },
  contenido: { paddingHorizontal: space.xl, paddingTop: space.lg, gap: space.md },
  centro: { flex: 1, backgroundColor: colors.bg, padding: space.xl, alignItems: 'center', justifyContent: 'center', gap: space.sm },
  centrado: { textAlign: 'center' },
  vacio: { alignItems: 'center', gap: space.sm, paddingVertical: space.xxl },
  aviso: { textAlign: 'center', marginTop: space.lg },
  salir: { alignSelf: 'center', padding: space.md },
  salirTexto: { color: colors.muted, fontWeight: '600', fontSize: 15 },
});
