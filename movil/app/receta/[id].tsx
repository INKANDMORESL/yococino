// Receta paso a paso, con las cantidades ajustadas a la ración de la persona.
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Image, Platform, Pressable, ScrollView, StyleSheet, Text, Vibration, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BarraPestanasSuelta } from '../../src/components/BarraPestanas';
import { Aparecer, Aviso, Boton, Contador, Saltar } from '../../src/components';
import { cargarComensales } from '../../src/features/compra/api';
import { RACION_PEQUE, type Comensales } from '../../src/features/compra/lista';
import { leerCache } from '../../src/lib/cache';
import { useLatido } from '../../src/components/Animaciones';
import { ErrorMenu, MOTIVOS_DENUNCIA, avisosDeMiReceta, cambiarPlato, cargarComidas, cargarReceta, denunciarReceta, marcarHecha, textoAvisos } from '../../src/features/menu/api';
import { faltaFoto, pedirFoto } from '../../src/features/menu/fotos';
import { AsignarDia } from '../../src/features/menu/AsignarDia';
import { CambiarIngrediente } from '../../src/features/menu/CambiarIngrediente';
import { compartirReceta } from '../../src/features/menu/compartir';
import Svg, { Path } from 'react-native-svg';
import { Peques } from '../../src/features/menu/Peques';
import { anadirNoMeGusta, cambiarFavorita, esFavorita, pequesEnCasa } from '../../src/features/perfil/api';
import { useAuth } from '../../src/lib/auth';
import { volver } from '../../src/lib/volver';
import { cantidadTexto } from '../../src/features/menu/cantidades';
import { useModoCocinar } from '../../src/features/menu/modoCocinar';
import { relojTexto, tiempoDelPaso } from '../../src/features/menu/temporizador';
import { hoyISO, sumarDias } from '../../src/features/menu/fechas';
import { NIVEL, NOMBRE_ALERGENO, TIPOS, type Comida, type Receta } from '../../src/features/menu/tipos';
import { colors, radius, shadow, space, type } from '../../src/theme';
import { conCambios } from '../../src/features/menu/cambios';
import { avisarAlTerminar, quitar as quitarAviso } from '../../src/lib/avisosTemporizador';

// Aviso al terminar un temporizador: vibración en el móvil y un pitido en la web.
function avisarFin() {
  Vibration.vibrate([0, 600, 250, 600, 250, 600]);
  if (Platform.OS !== 'web') return;
  try {
    const Ctx = (globalThis as { AudioContext?: new () => AudioContext }).AudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    [0, 0.45, 0.9].forEach((t) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.25, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.35);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.4);
    });
  } catch {
    // Sin sonido disponible: basta con el aviso en pantalla.
  }
}

interface Temporizador {
  total: number; // segundos
  fin: number | null; // marca de tiempo en ms; null si está en pausa
  restante: number; // segundos que quedaban al pausar
  terminado: boolean;
}

function Marca({ hecha }: { hecha: boolean }) {
  const escala = useLatido(hecha);
  return (
    <Animated.View style={[s.marca, hecha && s.marcaHecha, { transform: [{ scale: escala }] }]}>
      {hecha ? <Text style={s.marcaTexto}>✓</Text> : null}
    </Animated.View>
  );
}

export default function RecetaPantalla() {
  const { id, comida } = useLocalSearchParams<{ id: string; comida?: string }>();
  return <FichaReceta key={`${id}-${comida ?? ''}`} />;
}

function FichaReceta() {
  const { id, comida: comidaParam } = useLocalSearchParams<{ id: string; comida?: string }>();
  const [receta, setReceta] = useState<Receta | null>(null);
  const [comida, setComida] = useState<Comida | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ingHechos, setIngHechos] = useState<Set<number>>(new Set());
  const [pasosHechos, setPasosHechos] = useState<Set<number>>(new Set());
  const [favorita, setFavorita] = useState(false);
  const [avisoSalud, setAvisoSalud] = useState<string | null>(null);
  const [avisoCompartir, setAvisoCompartir] = useState<string | null>(null);
  const [noGusta, setNoGusta] = useState<Set<string>>(new Set());
  const [aviso, setAviso] = useState<string | null>(null);
  const { sesion } = useAuth();
  const [temporizadores, setTemporizadores] = useState<Map<number, Temporizador>>(new Map());
  const [ahora, setAhora] = useState(Date.now());
  const cocinar = useModoCocinar();
  const [foto, setFoto] = useState<string | null>(null);
  const [peques, setPeques] = useState<{ hay: boolean; franjas: string[] }>({ hay: false, franjas: [] });
  const [cambiando, setCambiando] = useState<'catalogo' | 'nueva' | null>(null);
  const [denuncia, setDenuncia] = useState<'cerrada' | 'abierta' | 'enviando' | 'enviada'>('cerrada');
  const avisados = useRef<Set<number>>(new Set());

  // Mientras haya algún temporizador en marcha, se actualiza cada segundo.
  const enMarcha = [...temporizadores.values()].some((t) => t.fin !== null && !t.terminado);
  useEffect(() => {
    if (!enMarcha) return;
    const id = setInterval(() => setAhora(Date.now()), 500);
    return () => clearInterval(id);
  }, [enMarcha]);

  const restante = (t: Temporizador) => (t.fin === null ? t.restante : Math.max(0, (t.fin - ahora) / 1000));

  // Al llegar a cero: aviso una sola vez.
  useEffect(() => {
    let cambio = false;
    const nuevo = new Map(temporizadores);
    for (const [paso, t] of temporizadores) {
      if (!t.terminado && t.fin !== null && t.fin <= ahora) {
        nuevo.set(paso, { ...t, terminado: true, restante: 0 });
        cambio = true;
        if (!avisados.current.has(paso)) {
          avisados.current.add(paso);
          avisarFin();
          quitarAviso(`${id}-${paso}`);
          setAviso(`⏰ ¡Tiempo! Paso ${paso + 1} listo.`);
        }
      }
    }
    if (cambio) setTemporizadores(nuevo);
  }, [ahora, temporizadores, id]);

  // Fuera de la app: notificación fija mientras corre y aviso con sonido al terminar.
  const nombreReceta = receta?.nombre ?? 'Tu receta';
  const iniciar = (paso: number, segundos: number) => {
    avisados.current.delete(paso);
    avisarAlTerminar(`${id}-${paso}`, segundos, nombreReceta, paso + 1);
    setAhora(Date.now());
    setTemporizadores(new Map(temporizadores).set(paso, { total: segundos, fin: Date.now() + segundos * 1000, restante: segundos, terminado: false }));
  };
  const pausar = (paso: number) => {
    const t = temporizadores.get(paso);
    if (!t) return;
    const nuevo = new Map(temporizadores);
    if (t.fin === null) {
      nuevo.set(paso, { ...t, fin: Date.now() + t.restante * 1000 });
      avisarAlTerminar(`${id}-${paso}`, t.restante, nombreReceta, paso + 1);
    } else {
      nuevo.set(paso, { ...t, fin: null, restante: restante(t) });
      quitarAviso(`${id}-${paso}`);
    }
    setAhora(Date.now());
    setTemporizadores(nuevo);
  };
  const cancelar = (paso: number) => {
    quitarAviso(`${id}-${paso}`);
    const nuevo = new Map(temporizadores);
    nuevo.delete(paso);
    setTemporizadores(nuevo);
  };

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const r = await cargarReceta(Number(id));
        if (!vivo) return;
        setReceta(r);
        setFoto(r.imagen);
        if (faltaFoto(r)) pedirFoto(r.id).then((f) => vivo && f?.imagen && setFoto(f.imagen)).catch(() => {});
        esFavorita(r.id).then((f) => vivo && setFavorita(f)).catch(() => {});
        // Aviso de alto contenido: recetas especiales de temporada (recetas.avisos) o guardadas de redes.
        if (r.avisos?.length) setAvisoSalud(textoAvisos(r.avisos));
        else avisosDeMiReceta(r.id).then((m) => vivo && setAvisoSalud(m ? textoAvisos(m.avisos) : null)).catch(() => {});
        pequesEnCasa().then((p) => vivo && setPeques(p)).catch(() => {});
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
  // Para cuántos se cocina: empieza con los comensales de casa (los de la lista de la compra) y se puede cambiar aquí.
  const [casa, setCasa] = useState<Comensales | null>(leerCache<Comensales>('compra:casa') ?? null);
  useEffect(() => {
    if (!casa) cargarComensales().then(setCasa).catch(() => setCasa({ adultos: 1, peques: 0 }));
  }, [casa]);
  const comensales = casa ?? { adultos: 1, peques: 0 };
  // Tu ración va ajustada a tu plan; cada adulto más, una ración normal; cada peque, algo más de media.
  const factorTotal = factor + Math.max(0, comensales.adultos - 1) + comensales.peques * RACION_PEQUE;
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

  const alternarFavorita = async () => {
    if (!sesion || !receta) return;
    const nueva = !favorita;
    setFavorita(nueva);
    try {
      await cambiarFavorita(sesion.user.id, receta.id, nueva);
    } catch (e) {
      setFavorita(!nueva);
      setError(e instanceof Error ? e.message : 'No se ha podido guardar.');
    }
  };

  const noMeGusta = async (alimento: string) => {
    if (!sesion || noGusta.has(alimento)) return;
    setNoGusta(new Set(noGusta).add(alimento));
    try {
      const quitados = await anadirNoMeGusta(sesion.user.id, alimento);
      setAviso(
        quitados
          ? `Apuntado: ${alimento} no volverá a aparecer. Cambiamos solo ${quitados === 1 ? 'el plato que lo llevaba' : `los ${quitados} platos que lo llevaban`}; el resto de tu menú sigue igual.`
          : `Apuntado: ${alimento} no aparecerá en tus próximos menús.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se ha podido guardar.');
    }
  };

  const denunciar = async (motivo: string) => {
    if (!sesion || !receta || denuncia === 'enviando') return;
    setDenuncia('enviando');
    try {
      await denunciarReceta(sesion.user.id, receta, motivo);
      setDenuncia('enviada');
    } catch (e) {
      setDenuncia('abierta');
      setError(e instanceof Error ? e.message : 'No se ha podido enviar la denuncia.');
    }
  };

  const cambiar = async (nueva: boolean) => {
    if (!comida || cambiando) return;
    setCambiando(nueva ? 'nueva' : 'catalogo');
    setError(null);
    try {
      const r = await cambiarPlato(comida.id, nueva);
      router.replace({ pathname: '/receta/[id]', params: { id: String(r.receta_id), comida: String(comida.id) } });
    } catch (e) {
      setError(e instanceof ErrorMenu ? e.message : 'No hemos podido cambiar el plato.');
      setCambiando(null);
    }
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
      <View style={s.pantalla}>
        <SafeAreaView style={s.centro} edges={['top']}>
          <Aviso tono="rosa" texto={error} />
          <Boton texto="Volver" variante="linea" onPress={() => volver()} />
        </SafeAreaView>
        <BarraPestanasSuelta />
      </View>
    );
  }
  if (!receta) {
    return (
      <View style={s.pantalla}>
        <SafeAreaView style={s.centro} edges={['top']}>
          <ActivityIndicator size="large" color={colors.olive} />
        </SafeAreaView>
        <BarraPestanasSuelta />
      </View>
    );
  }

  const t = TIPOS[receta.tipo_comida] ?? TIPOS.otro;
  const activos = [...temporizadores.entries()].filter(([, x]) => x.fin !== null || x.terminado);
  const proximo = activos.find(([, x]) => x.terminado) ?? activos.sort((a, b) => restante(a[1]) - restante(b[1]))[0];
  const meta = [t.texto, receta.minutos ? `${receta.minutos} min` : null, NIVEL[receta.nivel], nutricion[0] ? `${nutricion[0][1]} kcal` : null].filter(
    Boolean,
  ) as string[];

  // Ingredientes cambiados desde la lista de la compra («Equivalente»): se ven ya cambiados en esta comida.
  const cambios = comida?.cambios ?? {};
  const vista = Object.keys(cambios).length ? conCambios(receta, cambios) : receta;

  return (
    <View style={s.pantalla}>
      <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: comida ? 120 : space.xxl }}>
        <View style={[s.portada, { backgroundColor: t.fondo }]}>
          {foto ? (
            <Image source={{ uri: foto }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityLabel={`Foto de ${receta.nombre}`} />
          ) : (
            <Saltar>
              <Text style={s.emoji}>{t.emoji}</Text>
            </Saltar>
          )}
        </View>

        <View style={s.hoja}>
          <Aparecer>
            <Text style={s.titulo}>{receta.nombre}</Text>
            {receta.descripcion ? <Text style={[type.body, { marginTop: space.sm }]}>{receta.descripcion}</Text> : null}
            {avisoCompartir ? (
              <View style={{ marginTop: space.md }}>
                <Aviso tono="hoja" texto={avisoCompartir} />
              </View>
            ) : null}
            {avisoSalud ? (
              <View style={{ marginTop: space.md }}>
                <Aviso tono="rosa" texto={`⚠️ ${avisoSalud} Mejor tomarla de vez en cuando.`} />
              </View>
            ) : null}
            <View style={s.chips}>
              {meta.map((m) => (
                <View key={m} style={s.chip}>
                  <Text style={s.chipTexto}>{m}</Text>
                </View>
              ))}
            </View>
            {factor !== 1 ? <Text style={[type.small, { marginTop: space.sm }]}>Cantidades ajustadas a tu plan.</Text> : null}
          </Aparecer>

          <Aparecer retraso={40}>
            <Pressable
              onPress={cocinar.alternar}
              accessibilityRole="switch"
              accessibilityState={{ checked: cocinar.activo }}
              accessibilityLabel="Modo cocinar: la pantalla no se apaga"
              style={[s.cocinar, cocinar.activo && s.cocinarActivo]}
            >
              <Text style={s.cocinarEmoji}>👩‍🍳</Text>
              <View style={{ flex: 1 }}>
                <Text style={[s.cocinarTitulo, cocinar.activo && { color: '#fff' }]}>Modo cocinar</Text>
                <Text style={[type.small, cocinar.activo && { color: 'rgba(255,255,255,0.85)' }]}>
                  {!cocinar.disponible
                    ? 'Este dispositivo no permite mantener la pantalla encendida.'
                    : cocinar.activo
                      ? 'La pantalla no se apagará mientras cocinas.'
                      : 'Actívalo y la pantalla no se apagará.'}
                </Text>
              </View>
              <View style={[s.interruptor, cocinar.activo && s.interruptorActivo]}>
                <View style={[s.bolita, cocinar.activo && s.bolitaActiva]} />
              </View>
            </Pressable>
          </Aparecer>

          <Aparecer retraso={80}>
            <Text style={s.seccion}>Ingredientes</Text>
            <View style={s.comensales}>
              <Text style={s.comensalesTitulo}>¿Para cuántos cocinas?</Text>
              <Contador texto="Adultos" valor={comensales.adultos} min={1} max={12} cambiar={(v) => setCasa({ ...comensales, adultos: v })} />
              <Contador texto="Peques" valor={comensales.peques} min={0} max={10} cambiar={(v) => setCasa({ ...comensales, peques: v })} />
              {comensales.adultos > 1 || comensales.peques > 0 ? (
                <Text style={type.small}>Cantidades para todos: tu ración ajustada a tu plan, ración normal para los demás adultos y algo más de media por peque.</Text>
              ) : null}
            </View>
            <View style={s.caja}>
              {vista.ingredientes.map((ing, i) => {
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
                    <Text style={[s.ingCantidad, hecho && s.tachado]}>{cantidadTexto(ing.cantidad, ing.unidad, factorTotal, ing.nombre)}</Text>
                  </Pressable>
                );
              })}
            </View>
            <CambiarIngrediente
              recetaId={receta.id}
              ingredientes={receta.ingredientes}
              comidaId={comida && comida.fecha >= hoyISO() ? comida.id : null}
              listo={(nueva) =>
                router.replace({ pathname: '/receta/[id]', params: comida ? { id: String(nueva), comida: String(comida.id) } : { id: String(nueva) } })
              }
            />
          </Aparecer>

          <Aparecer retraso={140}>
            <Text style={s.seccion}>Preparación</Text>
            <View style={{ gap: space.md }}>
              {vista.pasos.map((paso, i) => {
                const hecho = pasosHechos.has(i);
                const tiempo = tiempoDelPaso(paso);
                const reloj = temporizadores.get(i);
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
                    <View style={{ flex: 1, gap: space.md }}>
                      <Text style={s.pasoTexto}>{paso}</Text>
                      {tiempo ? (
                        reloj ? (
                          <View style={[s.reloj, reloj.terminado && s.relojFin]}>
                            <Text style={[s.relojNumero, reloj.terminado && { color: '#fff' }]}>
                              {reloj.terminado ? '⏰ ¡Listo!' : relojTexto(restante(reloj))}
                            </Text>
                            {!reloj.terminado ? (
                              <Pressable onPress={() => pausar(i)} accessibilityRole="button" hitSlop={6} style={s.relojBoton}>
                                <Text style={s.relojBotonTexto}>{reloj.fin === null ? 'Seguir' : 'Pausa'}</Text>
                              </Pressable>
                            ) : null}
                            <Pressable onPress={() => cancelar(i)} accessibilityRole="button" hitSlop={6} style={s.relojBoton}>
                              <Text style={s.relojBotonTexto}>{reloj.terminado ? 'Cerrar' : 'Parar'}</Text>
                            </Pressable>
                          </View>
                        ) : (
                          <Pressable
                            onPress={() => iniciar(i, tiempo.segundos)}
                            accessibilityRole="button"
                            accessibilityLabel={`Iniciar temporizador de ${tiempo.texto}`}
                            style={s.iniciar}
                          >
                            <Text style={s.iniciarTexto}>⏱ Iniciar {tiempo.texto}</Text>
                          </Pressable>
                        )
                      ) : null}
                    </View>
                    <Marca hecha={hecho} />
                  </Pressable>
                );
              })}
            </View>
          </Aparecer>

          {receta.nota_airfryer ? (
            <View style={[s.nota, { backgroundColor: colors.lemonSoft }]}>
              <Text style={[type.body, { color: colors.ink }]}>🍟 {receta.nota_airfryer}</Text>
            </View>
          ) : null}

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

          {peques.hay ? (
            <View style={{ marginTop: space.xl }}>
              <Peques recetaId={receta.id} franjas={peques.franjas} />
            </View>
          ) : null}

          <View style={{ marginTop: space.xl }}>
            <AsignarDia recetaId={receta.id} tipoReceta={receta.tipo_comida} />
          </View>

          {comida && comida.fecha >= hoyISO() ? (
            <View>
              <Text style={s.seccion}>¿No te apetece?</Text>
              <Text style={[type.small, { marginBottom: space.md }]}>Lo cambiamos por otro plato que encaje con tu plan y tus alergias.</Text>
              <View style={{ gap: space.sm }}>
                <Boton texto="Cambiar por otro plato" variante="suave" cargando={cambiando === 'catalogo'} onPress={() => cambiar(false)} />
                <Pressable onPress={() => cambiar(true)} accessibilityRole="button" disabled={!!cambiando} style={s.enlace}>
                  <Text style={s.enlaceTexto}>{cambiando === 'nueva' ? 'Creando un plato nuevo… (unos 30 segundos)' : 'Prefiero algo totalmente nuevo'}</Text>
                </Pressable>
              </View>
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
          <View>
            <Text style={s.seccion}>¿Algo no te gusta?</Text>
            <Text style={[type.small, { marginBottom: space.md }]}>Tócalo y no volverá a aparecer en tus menús.</Text>
            <View style={s.chips}>
              {receta.ingredientes
                .filter((i) => i.unidad !== 'al gusto')
                .map((i) => {
                  const nombre = i.nombre.charAt(0).toUpperCase() + i.nombre.slice(1);
                  const marcado = noGusta.has(nombre);
                  return (
                    <Pressable
                      key={`ng-${i.nombre}`}
                      onPress={() => noMeGusta(nombre)}
                      accessibilityRole="button"
                      accessibilityLabel={`No me gusta: ${nombre}`}
                      style={[s.chip, marcado && { backgroundColor: colors.roseSoft, borderColor: colors.rose }]}
                    >
                      <Text style={s.chipTexto}>{marcado ? `🙅 ${nombre}` : nombre}</Text>
                    </Pressable>
                  );
                })}
            </View>
          </View>
          {aviso ? <Aviso tono="hoja" texto={aviso} /> : null}
          {error ? <Aviso tono="rosa" texto={error} /> : null}

          {denuncia === 'enviada' ? (
            <Aviso
              tono="hoja"
              texto={`Gracias. No volverás a ver esta receta${comida && comida.fecha >= hoyISO() ? ' (puedes cambiarla arriba con «Cambiar por otro plato»)' : ''} y la revisaremos en menos de 24 horas.`}
            />
          ) : denuncia === 'cerrada' ? (
            <Pressable onPress={() => setDenuncia('abierta')} accessibilityRole="button" style={[s.enlace, { marginTop: space.lg }]}>
              <Text style={[s.enlaceTexto, { color: colors.muted, fontSize: 14 }]}>🚩 Denunciar esta receta</Text>
            </Pressable>
          ) : (
            <View style={{ marginTop: space.lg }}>
              <Text style={s.seccion}>¿Qué le pasa a esta receta?</Text>
              <Text style={[type.small, { marginBottom: space.md }]}>Dejará de aparecerte y el equipo la revisará.</Text>
              <View style={{ gap: space.sm }}>
                {MOTIVOS_DENUNCIA.map((m) => (
                  <Boton key={m} texto={m} variante="linea" desactivado={denuncia === 'enviando'} onPress={() => denunciar(m)} />
                ))}
                <Pressable onPress={() => setDenuncia('cerrada')} accessibilityRole="button" style={s.enlace}>
                  <Text style={s.enlaceTexto}>Cancelar</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      <SafeAreaView edges={['top']} style={[s.barra, { pointerEvents: 'box-none' }]}>
        <Pressable onPress={() => volver()} accessibilityRole="button" accessibilityLabel="Volver" hitSlop={8} style={s.volver}>
          <Text style={s.flecha}>‹</Text>
        </Pressable>
        {!proximo && cocinar.activo ? (
          <View style={[s.relojFlotante, { backgroundColor: colors.olive }]}>
            <Text style={s.relojFlotanteTexto}>👩‍🍳 Modo cocinar</Text>
          </View>
        ) : null}
        {proximo ? (
          <View style={[s.relojFlotante, proximo[1].terminado && { backgroundColor: colors.rose }]} accessibilityLiveRegion="polite">
            <Text style={s.relojFlotanteTexto}>
              {proximo[1].terminado ? `⏰ Paso ${proximo[0] + 1} listo` : `⏱ ${relojTexto(restante(proximo[1]))} · Paso ${proximo[0] + 1}`}
            </Text>
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Pressable
            onPress={() =>
              receta &&
              compartirReceta(vista)
                .then((r) => r === 'copiada' && setAvisoCompartir('Receta copiada. Pégala donde quieras para enviarla.'))
                .catch(() => {})
            }
            accessibilityRole="button"
            accessibilityLabel="Compartir la receta"
            style={s.volver}
          >
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={colors.ink} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M12 3v12" />
              <Path d="M7 8l5-5 5 5" />
              <Path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
            </Svg>
          </Pressable>
          <Pressable
            onPress={alternarFavorita}
            accessibilityRole="button"
            accessibilityLabel={favorita ? 'Quitar de favoritas' : 'Guardar en favoritas'}
            style={s.volver}
          >
            <Text style={[s.corazon, favorita && { color: colors.rose }]}>{favorita ? '♥' : '♡'}</Text>
          </Pressable>
        </View>
      </SafeAreaView>

      {comida ? (
        <View style={s.pie}>
          <Boton texto={comida.hecha ? '✓ Hecha' : 'Marcar como hecha'} variante={comida.hecha ? 'suave' : 'principal'} onPress={marcarComida} />
        </View>
      ) : null}
      </View>
      <BarraPestanasSuelta />
    </View>
  );
}

const s = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.bg },
  centro: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.lg },
  portada: { height: 300, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  barra: { position: 'absolute', top: 0, left: 0, right: 0, padding: space.lg, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  relojFlotante: { backgroundColor: colors.ink, borderRadius: radius.pill, paddingVertical: 10, paddingHorizontal: 16, ...shadow },
  relojFlotanteTexto: { color: '#fff', fontWeight: '800', fontSize: 15 },
  iniciar: { alignSelf: 'flex-start', backgroundColor: colors.leaf, borderRadius: radius.pill, paddingVertical: 10, paddingHorizontal: 16 },
  iniciarTexto: { color: colors.oliveInk, fontWeight: '700', fontSize: 15 },
  reloj: { flexDirection: 'row', alignItems: 'center', gap: space.sm, alignSelf: 'flex-start', backgroundColor: colors.lemonSoft, borderRadius: radius.pill, paddingVertical: 6, paddingLeft: 16, paddingRight: 6 },
  relojFin: { backgroundColor: colors.rose },
  relojNumero: { fontSize: 22, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'], minWidth: 70 },
  relojBoton: { backgroundColor: colors.surface, borderRadius: radius.pill, paddingVertical: 8, paddingHorizontal: 12 },
  relojBotonTexto: { fontWeight: '700', fontSize: 14, color: colors.ink },
  corazon: { fontSize: 22, color: colors.ink },
  comensales: { backgroundColor: colors.leafSoft, borderRadius: radius.lg, padding: space.lg, gap: space.md, marginBottom: space.md },
  comensalesTitulo: { fontSize: 16, fontWeight: '700', color: colors.ink },
  enlace: { alignSelf: 'center', padding: space.md },
  enlaceTexto: { color: colors.olive, fontWeight: '700', fontSize: 15, textAlign: 'center' },
  cocinar: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.lg, padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.surface, ...shadow },
  cocinarActivo: { backgroundColor: colors.olive },
  cocinarEmoji: { fontSize: 26 },
  cocinarTitulo: { fontSize: 17, fontWeight: '700', color: colors.ink },
  interruptor: { width: 50, height: 30, borderRadius: 15, backgroundColor: '#E4E1D6', padding: 3, justifyContent: 'center' },
  interruptorActivo: { backgroundColor: 'rgba(255,255,255,0.35)' },
  bolita: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff' },
  bolitaActiva: { alignSelf: 'flex-end' },
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
  pasoTexto: { fontSize: 19, lineHeight: 27, color: colors.ink },
  nota: { borderRadius: radius.md, padding: space.lg },
  nutricion: { flexDirection: 'row', gap: space.sm },
  dato: { flex: 1, alignItems: 'center', paddingVertical: space.md, borderRadius: radius.sm, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.surface },
  datoValor: { fontSize: 17, fontWeight: '700', color: colors.ink },
  datoNombre: { fontSize: 11.5, color: colors.muted, marginTop: 2 },
  pie: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.xl, paddingTop: space.md, paddingBottom: space.md, backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.line },
});
