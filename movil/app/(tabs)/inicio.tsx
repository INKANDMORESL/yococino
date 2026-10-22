// Inicio: la próxima comida, el menú de hoy (con acceso al menú completo), cocina con lo que tienes y el progreso.
// Mientras faltan días para tener 30 por delante, los va preparando.
import { Redirect, router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Aparecer, Aviso, Boton, Saltar, Tarjeta } from '../../src/components';
import { ResumenPeso } from '../../src/features/progreso/ResumenPeso';
import { ErrorMenu, cambiarPlato, cargarComidas, marcarHecha, perfilBasico, prepararMenu } from '../../src/features/menu/api';
import { faltaFoto, pedirFoto } from '../../src/features/menu/fotos';
import { fechaLarga, hoyISO, sumarDias } from '../../src/features/menu/fechas';
import { PreparandoMenu } from '../../src/features/menu/PreparandoMenu';
import { ProximaComida, proximaComida } from '../../src/features/menu/ProximaComida';
import { TarjetaComida } from '../../src/features/menu/TarjetaComida';
import type { Comida } from '../../src/features/menu/tipos';
import { useAuth } from '../../src/lib/auth';
import { guardarEncuestaPendiente } from '../../src/lib/perfil';
import { guardarCache, leerCache } from '../../src/lib/cache';
import { tutorialVisto } from '../../src/lib/tutorial';
import { AvisoPlan } from '../../src/features/plan/AvisoPlan';
import { fueraDelPlan, usePlan } from '../../src/features/plan/plan';
import { colors, radius, space, type } from '../../src/theme';

const DIAS = 30;

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
  // Lo último que se vio, para enseñarlo al instante al volver.
  const previo = leerCache<{ comidas: Comida[]; nombre: string | null }>('inicio');
  const [estado, setEstado] = useState<Estado>(previo ? { tipo: 'listo' } : { tipo: 'cargando' });
  const [comidas, setComidas] = useState<Comida[]>(previo?.comidas ?? []);
  const [preparando, setPreparando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refrescando, setRefrescando] = useState(false);
  const [nombre, setNombre] = useState<string | null>(previo?.nombre ?? null);
  const [cambiando, setCambiando] = useState<number | null>(null);
  const [avisoCambio, setAvisoCambio] = useState<string | null>(null);
  const activo = useRef(true);
  const plan = usePlan();
  // Días que incluye su plan (en la prueba gratis, solo 7).
  const diasPlan = useMemo(() => dias.filter((d) => !fueraDelPlan(plan, d)), [dias, plan]);
  const planRef = useRef(plan);
  planRef.current = plan;
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
          if (r.pendientes === 0 || r.plan === 'caducada') break;
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
        const meta = sesion.user.user_metadata as { full_name?: string; name?: string } | undefined;
        setNombre((perfil.nombre || meta?.full_name || meta?.name || '').trim().split(' ')[0] || null);
        const lista = await recargar();
        setEstado({ tipo: 'listo' });
        if (!(await tutorialVisto())) router.push('/tutorial');
        const conMenu = new Set(lista.map((c) => c.fecha));
        const p = planRef.current;
        if (p?.estado !== 'caducada' && dias.some((d) => !fueraDelPlan(p, d) && !conMenu.has(d))) completarMes();
      } catch (e) {
        setEstado({ tipo: 'listo' });
        setError(e instanceof Error ? e.message : 'No hemos podido cargar tu menú.');
      }
    })();
  }, [sesion, recargar, completarMes, dias]);

  useEffect(() => {
    if (comidas.length) guardarCache('inicio', { comidas, nombre });
  }, [comidas, nombre]);

  // Al volver a Inicio (desde una receta o el menú), se actualiza sin esperar.
  const primeraVez = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (primeraVez.current) {
        primeraVez.current = false;
        return;
      }
      recargar().catch(() => {});
    }, [recargar]),
  );

  const porDia = useMemo(() => {
    const m = new Map<string, Comida[]>();
    for (const c of comidas) m.set(c.fecha, [...(m.get(c.fecha) ?? []), c]);
    return m;
  }, [comidas]);
  const listos = useMemo(() => new Set(porDia.keys()), [porDia]);
  const delDia = porDia.get(hoy) ?? [];
  const proxima = useMemo(() => proximaComida(comidas), [comidas]);

  // Fotos de la próxima comida y de los platos de hoy: se piden una a una la primera vez (luego quedan guardadas).
  const fotosPedidas = useRef<Set<number>>(new Set());
  useEffect(() => {
    const candidatas = proxima ? [proxima.comida, ...delDia] : delDia;
    const sinFoto = [...new Set(candidatas.filter((c) => faltaFoto(c.receta) && !fotosPedidas.current.has(c.receta!.id)).map((c) => c.receta!.id))];
    if (!sinFoto.length) return;
    sinFoto.forEach((id) => fotosPedidas.current.add(id));
    (async () => {
      for (const id of sinFoto) {
        const f = await pedirFoto(id);
        if (!f || !activo.current) continue;
        setComidas((prev) => prev.map((c) => (c.receta && c.receta.id === id ? { ...c, receta: { ...c.receta, imagen: f.imagen, imagen_mini: f.imagen_mini } } : c)));
      }
    })();
  }, [delDia, proxima]);
  const siguienteId = proxima?.comida.fecha === hoy ? proxima.comida.id : undefined;
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

  const cambiar = async (c: Comida) => {
    if (cambiando) return;
    setCambiando(c.id);
    setError(null);
    setAvisoCambio(null);
    try {
      const r = await cambiarPlato(c.id);
      await recargar();
      setAvisoCambio(`Cambiado por: ${r.nombre}.`);
    } catch (e) {
      setError(e instanceof ErrorMenu ? e.message : 'No hemos podido cambiar el plato.');
    } finally {
      setCambiando(null);
    }
  };

  const refrescar = async () => {
    setRefrescando(true);
    try {
      const lista = await recargar();
      const conMenu = new Set(lista.map((c) => c.fecha));
      if (plan?.estado !== 'caducada' && diasPlan.some((d) => !conMenu.has(d))) completarMes();
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
          <Text style={type.display} numberOfLines={2}>
            {saludo()}
            {nombre ? `, ${nombre}` : ''}
          </Text>
          <Text style={[type.body, { marginTop: 2 }]}>
            {fechaLarga(hoy)}
            {totalHoy ? ` · ${hechasHoy} de ${totalHoy} comidas hechas` : ''}
          </Text>
        </Aparecer>

        <View style={s.contenido}>
          <AvisoPlan plan={plan} />
          {preparando ? <PreparandoMenu listos={Math.min(listos.size, diasPlan.length)} total={diasPlan.length} /> : null}
          {error ? <Aviso tono="rosa" texto={error} /> : null}
          {error && !preparando ? <Boton texto="Reintentar" variante="suave" onPress={completarMes} /> : null}

          {proxima ? (
            <Aparecer retraso={60}>
              <ProximaComida comida={proxima.comida} cuando={proxima.cuando} onMarcar={() => marcar(proxima.comida)} />
            </Aparecer>
          ) : null}

          <View style={s.filaHoy}>
            <Text style={type.title}>Hoy</Text>
            <Pressable onPress={() => router.push('/menu')} accessibilityRole="button" style={s.verMenu}>
              <Text style={s.verMenuTexto}>Ver menú completo</Text>
            </Pressable>
          </View>

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
            <View style={{ gap: space.md }}>
              {delDia.map((c, i) => (
                <Aparecer key={c.id} retraso={i * 60} desde={12}>
                  <TarjetaComida
                    comida={c}
                    siguiente={c.id === siguienteId}
                    onMarcar={() => marcar(c)}
                    onCambiar={c.fecha >= hoy ? () => cambiar(c) : undefined}
                    cambiando={cambiando === c.id}
                  />
                </Aparecer>
              ))}
            </View>
          )}

          {avisoCambio ? <Aviso tono="hoja" texto={avisoCambio} /> : null}

          {estado.tipo === 'listo' ? (
            <Pressable onPress={() => router.push('/cocinar')} accessibilityRole="button" style={s.nevera}>
              <Text style={{ fontSize: 30 }}>🧺</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.neveraTitulo}>Cocina con lo que tienes</Text>
                <Text style={s.neveraTexto}>Dinos qué hay en tu nevera y te damos una receta</Text>
              </View>
              <Text style={s.neveraFlecha}>›</Text>
            </Pressable>
          ) : null}

          {estado.tipo === 'listo' ? (
            <View style={{ marginTop: space.lg, gap: space.sm }}>
              <Text style={type.title}>Mi progreso</Text>
              <ResumenPeso />
            </View>
          ) : null}

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
  filaHoy: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.lg },
  verMenu: { borderWidth: 1.5, borderColor: colors.line, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: colors.surface },
  verMenuTexto: { fontSize: 14, fontWeight: '700', color: colors.ink },
  nevera: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.md, padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.ink },
  neveraTitulo: { fontSize: 17, fontWeight: '700', color: '#fff' },
  neveraTexto: { fontSize: 14, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  neveraFlecha: { fontSize: 26, color: colors.lemon },
});
