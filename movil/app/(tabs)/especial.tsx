// Todas las recetas del especial de temporada. No entran en el menú: son para cuando apetezca algo de la época.
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Aparecer, Aviso } from '../../src/components';
import { ErrorMenu, cargarEspecial, type Especial, type RecetaEspecial } from '../../src/features/menu/api';
import { TIPOS, type TipoComida } from '../../src/features/menu/tipos';
import { colors, radius, space, type } from '../../src/theme';

// Dentro de las pestañas se reutiliza la misma pantalla: se vuelve a montar al cambiar de clave.
export default function EspecialPantalla() {
  const { clave } = useLocalSearchParams<{ clave?: string }>();
  return <EspecialPantallaContenido key={clave ?? ''} />;
}

function EspecialPantallaContenido() {
  const { clave } = useLocalSearchParams<{ clave?: string }>();
  const [especial, setEspecial] = useState<Especial | null>(null);
  const [recetas, setRecetas] = useState<RecetaEspecial[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    cargarEspecial(typeof clave === 'string' ? clave : undefined)
      .then((d) => {
        setEspecial(d.especial);
        setRecetas(d.recetas);
      })
      .catch((e) => setError(e instanceof ErrorMenu ? e.message : 'No hemos podido cargar las recetas.'));
  }, [clave]);

  return (
    <SafeAreaView style={s.pantalla} edges={['top']}>
      <ScrollView contentContainerStyle={s.contenido}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Volver" style={s.volver}>
          <Text style={s.flecha}>‹</Text>
        </Pressable>
        {especial ? (
          <Aparecer style={{ gap: space.xs }}>
            <Text style={{ fontSize: 44 }}>{especial.emoji}</Text>
            <Text style={type.display}>{especial.titulo}</Text>
            <Text style={type.body}>{especial.descripcion}</Text>
            <Text style={type.small}>Estas recetas no entran en tu menú: son para cuando te apetezca algo especial de la época.</Text>
          </Aparecer>
        ) : null}
        {error ? <Aviso tono="rosa" texto={error} /> : null}
        {!recetas && !error ? <ActivityIndicator color={colors.olive} style={{ marginTop: space.xl }} /> : null}
        {recetas && !recetas.length ? <Text style={type.body}>Estamos preparando las recetas de este especial. Vuelve en unas horas.</Text> : null}
        <View style={{ gap: space.md }}>
          {(recetas ?? []).map((r) => {
            const t = TIPOS[r.tipo_comida as TipoComida] ?? TIPOS.otro;
            return (
              <Pressable
                key={r.id}
                onPress={() => router.push({ pathname: '/receta/[id]', params: { id: String(r.id) } })}
                accessibilityRole="button"
                accessibilityLabel={`${r.nombre}. Ver receta`}
                style={s.tarjeta}
              >
                <View style={[s.foto, { backgroundColor: t.fondo }]}>
                  {r.imagen_mini || r.imagen ? (
                    <Image source={{ uri: (r.imagen_mini || r.imagen)! }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                  ) : (
                    <Text style={{ fontSize: 30 }}>{t.emoji}</Text>
                  )}
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={s.nombre} numberOfLines={2}>
                    {r.nombre}
                  </Text>
                  <Text style={type.small}>{[t.texto, r.minutos ? `${r.minutos} min` : null, r.kcal ? `${r.kcal} kcal` : null].filter(Boolean).join(' · ')}</Text>
                  {r.aviso ? <Text style={s.aviso}>⚠️ {r.aviso} Mejor de vez en cuando.</Text> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.bg },
  contenido: { padding: space.xl, gap: space.lg, paddingBottom: space.xxl },
  volver: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line },
  flecha: { fontSize: 26, lineHeight: 28, color: colors.ink, marginTop: -2 },
  tarjeta: { flexDirection: 'row', gap: space.md, backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.sm, alignItems: 'center' },
  foto: { width: 84, height: 84, borderRadius: radius.md, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  nombre: { fontSize: 16, fontWeight: '700', color: colors.ink },
  aviso: { fontSize: 12, color: colors.rose },
});
