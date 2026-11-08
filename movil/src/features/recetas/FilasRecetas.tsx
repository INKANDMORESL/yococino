// Portada del recetario: una fila por tipo de comida que se desliza a la derecha (5 recetas y, al final, «Ver más recetas»).
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { guardarCache, leerCache } from '../../lib/cache';
import { colors, radius, shadow, space } from '../../theme';
import { filasRecetas, type RecetaResumen } from '../menu/api';
import { kcalTexto } from '../menu/cantidades';
import { fotoPequena } from '../menu/fotos';
import { TIPOS, type TipoComida } from '../menu/tipos';

export const FILAS: { tipo: TipoComida; titulo: string }[] = [
  { tipo: 'desayuno', titulo: '☕ Desayunos' },
  { tipo: 'almuerzo', titulo: '🍲 Comidas' },
  { tipo: 'cena', titulo: '🥗 Cenas' },
  { tipo: 'media_manana', titulo: '🍎 Media mañana' },
  { tipo: 'merienda', titulo: '🥜 Meriendas' },
];

const ANCHO = 156;

const abrirTipo = (tipo: TipoComida) => router.push({ pathname: '/recetario', params: { tipo } });

export function FilasRecetas() {
  const [filas, setFilas] = useState<Record<string, RecetaResumen[]> | null>(leerCache('recetas:filas') ?? null);
  useEffect(() => {
    filasRecetas()
      .then((f) => setFilas(guardarCache('recetas:filas', f)))
      .catch(() => {});
  }, []);

  return (
    <View style={{ gap: space.xl }}>
      {FILAS.map(({ tipo, titulo }) => {
        const recetas = filas?.[tipo];
        if (filas && !recetas?.length) return null;
        return (
          <View key={tipo} style={{ gap: space.sm }}>
            <View style={s.cabecera}>
              <Text style={s.titulo}>{titulo}</Text>
              <Pressable onPress={() => abrirTipo(tipo)} accessibilityRole="button" hitSlop={8}>
                <Text style={s.verTodas}>Ver todas ›</Text>
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.desliza} contentContainerStyle={s.fila}>
              {recetas
                ? recetas.map((r) => <Tarjeta key={r.id} receta={r} />)
                : [0, 1, 2].map((i) => <View key={i} style={[s.tarjeta, s.hueco]} />)}
              {recetas ? (
                <Pressable onPress={() => abrirTipo(tipo)} accessibilityRole="button" accessibilityLabel={`Ver más recetas de ${titulo}`} style={[s.tarjeta, s.mas]}>
                  <Text style={{ fontSize: 34 }}>{TIPOS[tipo].emoji}</Text>
                  <Text style={s.masTexto}>Ver más recetas</Text>
                  <Text style={s.masFlecha}>›</Text>
                </Pressable>
              ) : null}
            </ScrollView>
          </View>
        );
      })}
    </View>
  );
}

function Tarjeta({ receta: r }: { receta: RecetaResumen }) {
  const t = TIPOS[r.tipo_comida as TipoComida] ?? TIPOS.otro;
  const foto = fotoPequena(r);
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/receta/[id]', params: { id: String(r.id) } })}
      accessibilityRole="button"
      accessibilityLabel={`${r.nombre}. Ver receta`}
      style={s.tarjeta}
    >
      <View style={[s.foto, { backgroundColor: t.fondo }]}>
        {foto ? <Image source={{ uri: foto }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : <Text style={{ fontSize: 34 }}>{t.emoji}</Text>}
      </View>
      <View style={s.texto}>
        <Text style={s.nombre} numberOfLines={2}>
          {r.nombre}
        </Text>
        <Text style={s.detalles} numberOfLines={1}>
          {[r.minutos ? `${r.minutos} min` : null, kcalTexto(r.kcal)].filter(Boolean).join(' · ')}
        </Text>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  cabecera: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titulo: { fontSize: 19, fontWeight: '800', color: colors.ink },
  verTodas: { fontSize: 14, fontWeight: '700', color: colors.olive },
  desliza: { marginHorizontal: -space.xl },
  fila: { gap: space.md, paddingHorizontal: space.xl, paddingVertical: 4 },
  tarjeta: { width: ANCHO, backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden', ...shadow },
  hueco: { height: ANCHO + 66, backgroundColor: colors.surface, opacity: 0.6 },
  foto: { width: ANCHO, height: ANCHO * 0.8, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  texto: { padding: space.sm, gap: 2, minHeight: 72 },
  nombre: { fontSize: 14, fontWeight: '700', color: colors.ink, lineHeight: 18 },
  detalles: { fontSize: 12, color: colors.muted },
  mas: { alignItems: 'center', justifyContent: 'center', gap: space.xs, backgroundColor: colors.leafSoft, minHeight: ANCHO * 0.8 + 72 },
  masTexto: { fontSize: 15, fontWeight: '800', color: colors.oliveInk, textAlign: 'center' },
  masFlecha: { fontSize: 26, color: colors.oliveInk },
});
