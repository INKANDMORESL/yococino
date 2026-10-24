// Guardar una receta compartida desde otra app (TikTok, Instagram, YouTube, Pinterest o una web).
// Llega por «Compartir → Yococino», o desde «Mis recetas» pegando el enlace (parámetro url).
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useIncomingShare } from 'expo-sharing';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Aparecer, Aviso, Boton, Saltar } from '../src/components';
import { ErrorMenu, importarReceta, type ResultadoImportar } from '../src/features/menu/api';
import { useAuth } from '../src/lib/auth';
import { borrarCache } from '../src/lib/cache';
import { colors, space, type } from '../src/theme';

const enlaceDe = (texto: string | null | undefined) => String(texto ?? '').match(/https?:\/\/[^\s<>"']+/i)?.[0] ?? null;

export default function Importar() {
  const { sesion, cargando } = useAuth();
  const params = useLocalSearchParams<{ url?: string }>();
  const { sharedPayloads, clearSharedPayloads } = useIncomingShare();
  const [estado, setEstado] = useState<'esperando' | 'leyendo' | 'listo' | 'error'>('esperando');
  const [resultado, setResultado] = useState<ResultadoImportar | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hecho = useRef(false);

  const compartido = (sharedPayloads ?? []).map((p) => enlaceDe(p.value)).find(Boolean) ?? null;
  const url = enlaceDe(typeof params.url === 'string' ? params.url : null) ?? compartido;

  useEffect(() => {
    if (!sesion || !url || hecho.current) return;
    hecho.current = true;
    setEstado('leyendo');
    importarReceta(url)
      .then((r) => {
        setResultado(r);
        setEstado('listo');
        borrarCache('mis-recetas');
      })
      .catch((e) => {
        setError(e instanceof ErrorMenu ? e.message : 'No hemos podido guardar esa receta. Vuelve a intentarlo en un momento.');
        setEstado('error');
      })
      .finally(() => {
        try {
          clearSharedPayloads();
        } catch {
          // Nada que limpiar.
        }
      });
  }, [sesion, url, clearSharedPayloads]);

  if (!cargando && !sesion) return <Redirect href="/" />;

  return (
    <SafeAreaView style={s.pantalla}>
      <View style={s.centro}>
        {estado === 'leyendo' || (estado === 'esperando' && url) ? (
          <Aparecer style={s.bloque}>
            <ActivityIndicator size="large" color={colors.olive} />
            <Text style={[type.title, s.centrado]}>Leyendo la receta…</Text>
            <Text style={[type.body, s.centrado]}>Estamos sacando los ingredientes y los pasos, y revisando lo saludable que es. Tarda unos segundos.</Text>
          </Aparecer>
        ) : estado === 'listo' && resultado ? (
          <Aparecer style={s.bloque}>
            <Saltar>
              <Text style={{ fontSize: 56 }}>{resultado.aviso ? '⚠️' : '✅'}</Text>
            </Saltar>
            <Text style={[type.title, s.centrado]}>Guardada en Mis recetas</Text>
            <Text style={[type.heading, s.centrado]}>{resultado.nombre}</Text>
            {resultado.aviso ? (
              <Aviso tono="rosa" texto={`${resultado.aviso} Es mejor tomarla de vez en cuando. Por eso solo la verás tú y no se compartirá con el resto de personas de Yococino.`} />
            ) : resultado.publica ? (
              <Aviso tono="hoja" texto="¡Es una receta equilibrada! Además de guardarla para ti, la hemos añadido al recetario para que más personas puedan disfrutarla." />
            ) : null}
            {resultado.no_apta ? <Aviso tono="rosa" texto={resultado.no_apta} /> : null}
          </Aparecer>
        ) : estado === 'error' ? (
          <Aparecer style={s.bloque}>
            <Text style={{ fontSize: 56 }}>🙅</Text>
            <Text style={[type.title, s.centrado]}>No la hemos guardado</Text>
            <Aviso tono="rosa" texto={error ?? ''} />
          </Aparecer>
        ) : (
          <Aparecer style={s.bloque}>
            <Text style={{ fontSize: 56 }}>🔗</Text>
            <Text style={[type.title, s.centrado]}>No hemos recibido ningún enlace</Text>
            <Text style={[type.body, s.centrado]}>Comparte una receta desde TikTok, Instagram u otra app y elige Yococino, o pega el enlace en Recetas → Mis recetas.</Text>
          </Aparecer>
        )}
      </View>
      <View style={{ gap: space.sm }}>
        {estado === 'listo' && resultado ? (
          <Boton texto="Ver la receta" onPress={() => router.replace({ pathname: '/receta/[id]', params: { id: String(resultado.receta_id) } })} />
        ) : null}
        {estado !== 'leyendo' ? <Boton texto="Ir a Mis recetas" variante="linea" onPress={() => router.replace({ pathname: '/recetas', params: { ver: 'mias' } })} /> : null}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.bg, padding: space.xl },
  centro: { flex: 1, justifyContent: 'center' },
  bloque: { alignItems: 'center', gap: space.md },
  centrado: { textAlign: 'center' },
});
