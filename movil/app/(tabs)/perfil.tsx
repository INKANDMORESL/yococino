// Perfil: preferencias del plan, alergias, gustos, peques, favoritas y cuenta.
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Aparecer, Aviso, Boton, Campo, Tarjeta } from '../../src/components';
import { erroresPaso, type Encuesta } from '../../src/features/encuesta/modelo';
import { PasoActividad } from '../../src/features/encuesta/pasos/PasoActividad';
import { PasoCasa } from '../../src/features/encuesta/pasos/PasoCasa';
import { PasoCocina } from '../../src/features/encuesta/pasos/PasoCocina';
import { PasoGustos } from '../../src/features/encuesta/pasos/PasoGustos';
import { PasoObjetivo } from '../../src/features/encuesta/pasos/PasoObjetivo';
import { PasoSalud } from '../../src/features/encuesta/pasos/PasoSalud';
import { TIPOS, type TipoComida } from '../../src/features/menu/tipos';
import { aEncuesta, borrarCuenta, cargarFavoritas, cargarPerfil, guardarPreferencias } from '../../src/features/perfil/api';
import { esAdmin } from '../../src/features/menu/api';
import { SembrarRecetas } from '../../src/features/perfil/SembrarRecetas';
import { respuestasSinLeer } from '../../src/features/contacto/api';
import { abrirLegal } from '../../src/features/cuenta/Legal';
import { useAuth } from '../../src/lib/auth';
import { cambiarPromociones } from '../../src/lib/perfil';
import { guardarCache, leerCache } from '../../src/lib/cache';
import { colors, radius, shadow, space, type } from '../../src/theme';
import { useSubirAlTocarPestana } from '../../src/lib/subirArriba';

type Seccion = 'objetivo' | 'actividad' | 'salud' | 'gustos' | 'cocina' | 'casa';

const SECCIONES: { clave: Seccion; titulo: string; emoji: string; paso: number }[] = [
  { clave: 'objetivo', titulo: 'Mi objetivo', emoji: '🎯', paso: 1 },
  { clave: 'actividad', titulo: 'Actividad física', emoji: '🏃', paso: 2 },
  { clave: 'salud', titulo: 'Alergias e intolerancias', emoji: '🩺', paso: 3 },
  { clave: 'gustos', titulo: 'Lo que no me gusta', emoji: '🙅', paso: 4 },
  { clave: 'cocina', titulo: 'Mi cocina', emoji: '👩‍🍳', paso: 5 },
  { clave: 'casa', titulo: 'Peques en casa', emoji: '🧒', paso: 6 },
];

const COMPONENTE = { objetivo: PasoObjetivo, actividad: PasoActividad, salud: PasoSalud, gustos: PasoGustos, cocina: PasoCocina, casa: PasoCasa };

function resumenSeccion(c: Seccion, e: Encuesta): string {
  if (c === 'objetivo') return e.objetivo === 'perder' ? `Perder peso, hasta ${e.pesoObjetivo} kg` : e.objetivo === 'musculo' ? 'Ganar músculo' : 'Mantener mi peso';
  if (c === 'actividad')
    return { nada: 'No hago deporte', poca: '1 o 2 días por semana', media: '3 o 4 días por semana', alta: '5 días o más' }[e.actividad ?? 'nada'];
  if (c === 'salud') return e.alergias.length ? e.alergias.join(', ') : 'Ninguna';
  if (c === 'gustos') return e.noMeGusta.length ? e.noMeGusta.join(', ') : 'Nada en especial';
  if (c === 'cocina')
    return `${{ facil: 'Fácil', medio: 'Medio', elaborado: 'Me gusta cocinar' }[e.nivel ?? 'facil']}, ${e.comidas} comidas al día${(e.aparatos ?? []).includes('airfryer') ? ', con airfryer' : ''}`;
  return e.hayPeques ? `${e.numPeques === 4 ? '4 o más' : e.numPeques} en casa` : 'No';
}

export default function Perfil() {
  const arriba = useSubirAlTocarPestana();
  const { sesion, salir } = useAuth();
  const previo = leerCache<{ enc: Encuesta | null; favs: { id: number; nombre: string; tipo_comida: string }[] }>('perfil');
  const [original, setOriginal] = useState<Encuesta | null>(previo?.enc ?? null);
  const [e, setE] = useState<Encuesta | null>(previo?.enc ?? null);
  const [abierta, setAbierta] = useState<Seccion | null>(null);
  const [favoritas, setFavoritas] = useState<{ id: number; nombre: string; tipo_comida: string }[]>(previo?.favs ?? []);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [confirmarBorrado, setConfirmarBorrado] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [sinLeer, setSinLeer] = useState(0);
  const [promociones, setPromociones] = useState<boolean | null>(null);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const [{ perfil, pesoActual }, favs] = await Promise.all([cargarPerfil(), cargarFavoritas()]);
          const enc = perfil ? aEncuesta(perfil, pesoActual) : null;
          guardarCache('perfil', { enc, favs });
          if (enc) {
            setOriginal(enc);
            setE(enc);
          }
          setFavoritas(favs);
          setPromociones(!!(perfil as { promociones?: boolean } | null)?.promociones);
          esAdmin().then(setAdmin).catch(() => {});
          respuestasSinLeer().then(setSinLeer).catch(() => {});
        } catch (err) {
          setError(err instanceof Error ? err.message : 'No hemos podido cargar tu perfil.');
        }
      })();
    }, []),
  );

  const cambiar = (parcial: Partial<Encuesta>) => {
    setAviso(null);
    setE((prev) => (prev ? { ...prev, ...parcial } : prev));
  };
  const hayCambios = !!e && !!original && JSON.stringify(e) !== JSON.stringify(original);

  const guardar = async () => {
    if (!sesion || !e || !original) return;
    for (const sec of SECCIONES) {
      const err = erroresPaso(sec.paso, e);
      if (err) {
        setAbierta(sec.clave);
        setError(err);
        return;
      }
    }
    setError(null);
    setGuardando(true);
    try {
      const { cambio, quitadas } = await guardarPreferencias(sesion.user.id, e, original);
      setOriginal(e);
      setAbierta(null);
      setAviso(
        cambio === 'todo_hoy'
          ? 'Guardado. Por seguridad, rehacemos tu menú desde hoy: ve a la pestaña Inicio y se preparará de nuevo.'
          : cambio === 'todo_manana'
            ? 'Guardado. Tu menú se rehará a partir de mañana con estas cantidades.'
            : quitadas
              ? `Guardado. Solo cambiamos ${quitadas === 1 ? 'el plato que lo llevaba' : `los ${quitadas} platos que lo llevaban`}: el resto de tu menú sigue igual. Ve a Inicio y se completará.`
              : 'Guardado. Tu menú sigue igual: ningún plato se ve afectado.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No hemos podido guardar.');
    } finally {
      setGuardando(false);
    }
  };

  const borrar = async () => {
    setBorrando(true);
    try {
      await borrarCuenta();
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No hemos podido borrar tu cuenta.');
      setBorrando(false);
    }
  };

  return (
    <SafeAreaView style={s.pantalla} edges={['top']}>
      <ScrollView ref={arriba} contentContainerStyle={s.contenido} keyboardShouldPersistTaps="handled">
        <Aparecer>
          <Text style={type.display}>Perfil</Text>
          <Text style={[type.body, { marginTop: 2 }]}>{sesion?.user.email}</Text>
        </Aparecer>

        {e ? (
          <Aparecer retraso={60}>
            <Text style={s.titulo}>Mi plan</Text>
            <View style={{ marginBottom: space.md }}>
              <Campo
                etiqueta="Tu nombre"
                grande={false}
                value={e.nombre}
                onChangeText={(t) => cambiar({ nombre: t })}
                placeholder="¿Cómo te llamamos?"
                autoCapitalize="words"
                maxLength={40}
              />
            </View>
            <View style={s.caja}>
              {SECCIONES.map((sec, i) => {
                const Componente = COMPONENTE[sec.clave];
                const activa = abierta === sec.clave;
                return (
                  <View key={sec.clave} style={i > 0 ? s.separador : null}>
                    <Pressable
                      onPress={() => setAbierta(activa ? null : sec.clave)}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: activa }}
                      style={s.fila}
                    >
                      <View style={s.icono}>
                        <Text style={{ fontSize: 18 }}>{sec.emoji}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.filaTitulo}>{sec.titulo}</Text>
                        <Text style={type.small} numberOfLines={activa ? undefined : 1}>
                          {resumenSeccion(sec.clave, e)}
                        </Text>
                      </View>
                      <Text style={s.chevron}>{activa ? '−' : '›'}</Text>
                    </Pressable>
                    {activa ? (
                      <View style={s.editor}>
                        <Componente e={e} cambiar={cambiar} />
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </Aparecer>
        ) : null}

        {error ? <Aviso tono="rosa" texto={error} /> : null}
        {aviso ? <Aviso tono="hoja" texto={aviso} /> : null}
        {hayCambios ? <Boton texto="Guardar cambios" cargando={guardando} onPress={guardar} /> : null}

        <Aparecer retraso={120}>
          <Text style={s.titulo}>Recetas favoritas</Text>
          {favoritas.length ? (
            <View style={s.caja}>
              {favoritas.map((f, i) => {
                const t = TIPOS[f.tipo_comida as TipoComida] ?? TIPOS.otro;
                return (
                  <Pressable
                    key={f.id}
                    onPress={() => router.push({ pathname: '/receta/[id]', params: { id: String(f.id) } })}
                    accessibilityRole="button"
                    style={[s.fila, i > 0 && s.separador]}
                  >
                    <View style={[s.icono, { backgroundColor: t.fondo }]}>
                      <Text style={{ fontSize: 18 }}>{t.emoji}</Text>
                    </View>
                    <Text style={[s.filaTitulo, { flex: 1 }]}>{f.nombre}</Text>
                    <Text style={s.chevron}>›</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <Tarjeta>
              <Text style={type.body}>Toca el corazón ♡ en cualquier receta para guardarla aquí.</Text>
            </Tarjeta>
          )}
        </Aparecer>

        {admin ? (
          <View>
            <Text style={s.titulo}>Herramientas del dueño</Text>
            <SembrarRecetas />
          </View>
        ) : null}

        <Aparecer retraso={180}>
          <Text style={s.titulo}>Cuenta</Text>
          <View style={{ gap: space.md }}>
            <View style={s.caja}>
              <Pressable onPress={() => router.push('/suscripcion')} accessibilityRole="button" style={s.fila}>
                <View style={s.icono}>
                  <Text style={{ fontSize: 18 }}>✨</Text>
                </View>
                <Text style={[s.filaTitulo, { flex: 1 }]}>Mi suscripción</Text>
                <Text style={s.chevron}>›</Text>
              </Pressable>
              <Pressable onPress={() => router.push('/contacto')} accessibilityRole="button" style={[s.fila, s.separador]}>
                <View style={s.icono}>
                  <Text style={{ fontSize: 18 }}>💬</Text>
                </View>
                <Text style={[s.filaTitulo, { flex: 1 }]}>Contacta con nosotros</Text>
                {sinLeer ? (
                  <View style={s.globo}>
                    <Text style={s.globoTexto}>{sinLeer}</Text>
                  </View>
                ) : null}
                <Text style={s.chevron}>›</Text>
              </Pressable>
              <Pressable onPress={() => router.push('/tutorial')} accessibilityRole="button" style={[s.fila, s.separador]}>
                <View style={s.icono}>
                  <Text style={{ fontSize: 18 }}>🧭</Text>
                </View>
                <Text style={[s.filaTitulo, { flex: 1 }]}>Ver el paso a paso de la app</Text>
                <Text style={s.chevron}>›</Text>
              </Pressable>
              {(
                [
                  ['🔒', 'Política de privacidad', 'privacidad'],
                  ['📄', 'Condiciones de uso', 'condiciones'],
                  ['⚖️', 'Aviso legal', 'aviso'],
                ] as const
              ).map(([emoji, texto, pagina]) => (
                <Pressable key={pagina} onPress={() => abrirLegal(pagina)} accessibilityRole="link" style={[s.fila, s.separador]}>
                  <View style={s.icono}>
                    <Text style={{ fontSize: 18 }}>{emoji}</Text>
                  </View>
                  <Text style={[s.filaTitulo, { flex: 1 }]}>{texto}</Text>
                  <Text style={s.chevron}>↗</Text>
                </Pressable>
              ))}
              {promociones !== null ? (
                <View style={[s.fila, s.separador]}>
                  <View style={s.icono}>
                    <Text style={{ fontSize: 18 }}>📧</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.filaTitulo}>Novedades y promociones</Text>
                    <Text style={type.small}>{promociones ? 'Las recibes por email. Desactívalo para darte de baja.' : 'No recibes emails promocionales.'}</Text>
                  </View>
                  <Switch
                    value={promociones}
                    accessibilityLabel="Recibir novedades y promociones por email"
                    trackColor={{ true: colors.olive, false: colors.line }}
                    onValueChange={async (si) => {
                      if (!sesion) return;
                      setPromociones(si);
                      try {
                        await cambiarPromociones(sesion.user.id, si);
                        setAviso(si ? 'Listo: te avisaremos de novedades y promociones.' : 'Listo: ya no recibirás emails promocionales.');
                      } catch (err) {
                        setPromociones(!si);
                        setError(err instanceof Error ? err.message : 'No hemos podido guardar tu elección.');
                      }
                    }}
                  />
                </View>
              ) : null}
            </View>
            <Boton texto="Cerrar sesión" variante="linea" onPress={salir} />
            {!confirmarBorrado ? (
              <Pressable onPress={() => setConfirmarBorrado(true)} accessibilityRole="button" style={s.enlaceBorrar}>
                <Text style={s.enlaceBorrarTexto}>Borrar mi cuenta y mis datos</Text>
              </Pressable>
            ) : (
              <Tarjeta style={{ gap: space.md, borderWidth: 1.5, borderColor: colors.rose }}>
                <Text style={type.heading}>¿Borrar tu cuenta?</Text>
                <Text style={type.body}>Se borrarán para siempre tu cuenta, tu menú, tu progreso y tus respuestas. No se puede deshacer.</Text>
                <Boton texto="Sí, borrar todo" cargando={borrando} onPress={borrar} />
                <Boton texto="Cancelar" variante="linea" onPress={() => setConfirmarBorrado(false)} />
              </Tarjeta>
            )}
          </View>
        </Aparecer>

        <Text style={[type.small, { textAlign: 'center', marginTop: space.lg }]}>
          Yococino ofrece menús orientativos y no sustituye el consejo de un profesional sanitario.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.bg },
  contenido: { padding: space.xl, gap: space.lg, paddingBottom: space.xxl },
  titulo: { fontSize: 20, fontWeight: '700', color: colors.ink, marginBottom: space.sm },
  caja: { backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden', ...shadow },
  fila: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  separador: { borderTopWidth: 1, borderTopColor: colors.line },
  icono: { width: 38, height: 38, borderRadius: radius.sm, backgroundColor: colors.leaf, alignItems: 'center', justifyContent: 'center' },
  filaTitulo: { fontSize: 16, fontWeight: '600', color: colors.ink },
  chevron: { fontSize: 22, color: '#C3C0B5' },
  globo: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: colors.rose, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  globoTexto: { color: '#fff', fontSize: 12, fontWeight: '800' },
  editor: { paddingHorizontal: space.lg, paddingBottom: space.xl },
  enlaceBorrar: { alignSelf: 'center', padding: space.md },
  enlaceBorrarTexto: { color: colors.rose, fontWeight: '600', fontSize: 15 },
});
