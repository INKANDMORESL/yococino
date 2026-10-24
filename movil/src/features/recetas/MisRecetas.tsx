// «Mis recetas»: las recetas que cada persona guarda desde TikTok, con su explicación sencilla.
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Aviso, Boton, Tarjeta } from '../../components';
import { guardarCache, leerCache } from '../../lib/cache';
import { colors, radius, shadow, space, type } from '../../theme';
import { cargarMisRecetas, quitarMiReceta, textoAvisos, type MiReceta } from '../menu/api';
import { fotoPequena } from '../menu/fotos';
import { TIPOS, type TipoComida } from '../menu/tipos';

const PASOS = [
  ['1', 'En TikTok, pulsa «Compartir» en el vídeo de la receta que te guste.'],
  ['2', 'Elige Yococino. Si no sale, toca «Copiar enlace» y pégalo aquí abajo.'],
  ['3', 'La leemos, la escribimos paso a paso y la guardamos aquí, con su foto.'],
];

export function MisRecetas() {
  const [lista, setLista] = useState<MiReceta[] | null>(leerCache<MiReceta[]>('mis-recetas') ?? null);
  const [enlace, setEnlace] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [verComo, setVerComo] = useState(false);

  useFocusEffect(
    useCallback(() => {
      cargarMisRecetas()
        .then((l) => setLista(guardarCache('mis-recetas', l)))
        .catch((e) => setError(e instanceof Error ? e.message : 'No hemos podido cargar tus recetas.'));
    }, []),
  );

  const guardar = () => {
    const url = enlace.match(/https?:\/\/[^\s<>"']+/i)?.[0];
    if (!url) return setError('Pega el enlace completo de la publicación (empieza por https://).');
    setError(null);
    setEnlace('');
    router.push({ pathname: '/importar', params: { url } });
  };

  const quitar = async (id: number) => {
    try {
      await quitarMiReceta(id);
      setLista((l) => guardarCache('mis-recetas', (l ?? []).filter((r) => r.id !== id)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No hemos podido quitarla.');
    }
  };

  return (
    <View style={{ gap: space.lg }}>
      <Tarjeta style={{ gap: space.md }}>
        <Text style={type.heading}>📥 Guarda recetas de TikTok</Text>
        <Text style={type.body}>¿Has visto una receta que te encanta en TikTok? Guárdala aquí en un momento:</Text>
        {PASOS.map(([n, t]) => (
          <View key={n} style={s.paso}>
            <View style={s.numero}>
              <Text style={s.numeroTexto}>{n}</Text>
            </View>
            <Text style={[type.body, { flex: 1, color: colors.ink }]}>{t}</Text>
          </View>
        ))}
        <Pressable onPress={() => setVerComo(!verComo)} accessibilityRole="button">
          <Text style={s.enlaceTexto}>{verComo ? 'Ocultar' : '¿Qué hacemos con la receta?'}</Text>
        </Pressable>
        {verComo ? (
          <View style={{ gap: space.sm }}>
            <Text style={type.small}>⚠️ Si tiene mucho azúcar, grasa, sal o calorías, te avisamos para que la tomes de vez en cuando.</Text>
            <Text style={type.small}>🙅 Si la publicación no es de comida o no encaja con los valores de Yococino, no se guarda.</Text>
            <Text style={type.small}>La escribimos con nuestras palabras y le hacemos una foto propia: no copiamos el vídeo ni las fotos del autor.</Text>
            <Text style={type.small}>En la prueba gratis puedes guardar 1 receta. Con la suscripción, todas las que quieras dentro de tu plan.</Text>
          </View>
        ) : null}
        <View style={s.campo}>
          <TextInput
            value={enlace}
            onChangeText={setEnlace}
            placeholder="Pega aquí el enlace de TikTok"
            placeholderTextColor={colors.muted}
            style={s.input}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="go"
            onSubmitEditing={guardar}
            accessibilityLabel="Enlace de la receta"
          />
        </View>
        <Boton texto="Guardar receta" onPress={guardar} desactivado={!enlace.trim()} />
      </Tarjeta>

      {error ? <Aviso tono="rosa" texto={error} /> : null}

      {lista === null ? (
        <ActivityIndicator color={colors.olive} />
      ) : lista.length === 0 ? (
        <Text style={[type.small, { textAlign: 'center' }]}>Aún no has guardado ninguna receta de TikTok.</Text>
      ) : (
        <View style={{ gap: space.md }}>
          {lista.map((r) => {
            const t = TIPOS[r.tipo_comida as TipoComida] ?? TIPOS.otro;
            const aviso = textoAvisos(r.avisos);
            return (
              <View key={r.id} style={s.tarjeta}>
                <Pressable
                  onPress={() => router.push({ pathname: '/receta/[id]', params: { id: String(r.id) } })}
                  accessibilityRole="button"
                  accessibilityLabel={`${r.nombre}. Ver receta`}
                  style={s.fila}
                >
                  <View style={[s.foto, { backgroundColor: t.fondo }]}>
                    {fotoPequena(r) ? <Image source={{ uri: fotoPequena(r)! }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : <Text style={{ fontSize: 30 }}>{t.emoji}</Text>}
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={s.nombre} numberOfLines={2}>
                      {r.nombre}
                    </Text>
                    {aviso ? <Text style={s.aviso}>⚠️ {aviso}</Text> : <Text style={s.detalles}>{t.texto}</Text>}
                  </View>
                </Pressable>
                <View style={s.acciones}>
                  {r.origen_url ? (
                    <Pressable onPress={() => Linking.openURL(r.origen_url as string).catch(() => {})} accessibilityRole="link" hitSlop={6}>
                      <Text style={s.accion}>Ver publicación original</Text>
                    </Pressable>
                  ) : (
                    <View />
                  )}
                  <Pressable onPress={() => quitar(r.id)} accessibilityRole="button" hitSlop={6}>
                    <Text style={[s.accion, { color: colors.rose }]}>Quitar</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  paso: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  numero: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.olive, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  numeroTexto: { color: '#fff', fontWeight: '800', fontSize: 14 },
  enlaceTexto: { color: colors.olive, fontWeight: '700', fontSize: 15 },
  campo: { backgroundColor: colors.bg, borderRadius: radius.pill, paddingHorizontal: space.lg, height: 50, justifyContent: 'center', borderWidth: 1, borderColor: colors.line },
  input: { fontSize: 16, color: colors.ink, height: '100%' },
  tarjeta: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.md, gap: space.sm, ...shadow },
  fila: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  foto: { width: 76, height: 76, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  nombre: { fontSize: 16, fontWeight: '700', color: colors.ink, lineHeight: 21 },
  detalles: { fontSize: 13, color: colors.muted },
  aviso: { fontSize: 13, color: colors.rose, fontWeight: '600' },
  acciones: { flexDirection: 'row', justifyContent: 'space-between' },
  accion: { fontSize: 13, fontWeight: '700', color: colors.olive },
});
