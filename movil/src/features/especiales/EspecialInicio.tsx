// Apartado de Inicio con el especial de temporada (Halloween, Navidad, verano…): 2 recetas y «Ver todas».
// Estas recetas no entran en el menú; son para cuando apetezca algo de la época.
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { guardarCache, leerCache } from '../../lib/cache';
import { colors, radius, space, type } from '../../theme';
import { cargarEspecial, type Especial, type RecetaEspecial } from '../menu/api';

type Datos = { especial: Especial | null; recetas: RecetaEspecial[] };

export function EspecialInicio() {
  const [datos, setDatos] = useState<Datos | null>(leerCache<Datos>('especial:inicio') ?? null);

  useFocusEffect(
    useCallback(() => {
      cargarEspecial(undefined, 2)
        .then((d) => {
          setDatos(d);
          guardarCache('especial:inicio', d);
        })
        .catch(() => {});
    }, []),
  );

  if (!datos?.especial || !datos.recetas.length) return null;
  const { especial, recetas } = datos;
  const verTodas = () => router.push({ pathname: '/especial', params: { clave: especial.clave } });

  return (
    <View style={s.caja}>
      <View style={s.cabecera}>
        <Text style={s.emoji}>{especial.emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={type.heading}>{especial.titulo}</Text>
          <Text style={type.small}>{especial.descripcion}</Text>
        </View>
      </View>
      <View style={s.fila}>
        {recetas.slice(0, 2).map((r) => (
          <Pressable
            key={r.id}
            onPress={() => router.push({ pathname: '/receta/[id]', params: { id: String(r.id) } })}
            accessibilityRole="button"
            accessibilityLabel={`${r.nombre}. Ver receta`}
            style={s.receta}
          >
            <View style={s.foto}>
              {r.imagen_mini || r.imagen ? <Image source={{ uri: (r.imagen_mini || r.imagen)! }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
            </View>
            <Text style={s.nombre} numberOfLines={2}>
              {r.nombre}
            </Text>
            {r.aviso ? (
              <Text style={s.aviso} numberOfLines={2}>
                ⚠️ {r.aviso}
              </Text>
            ) : null}
          </Pressable>
        ))}
      </View>
      <Pressable onPress={verTodas} accessibilityRole="button" style={s.boton}>
        <Text style={s.botonTexto}>Ver todas las recetas ›</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  caja: { backgroundColor: colors.lemonSoft, borderRadius: radius.lg, padding: space.lg, gap: space.md },
  cabecera: { flexDirection: 'row', gap: space.md, alignItems: 'center' },
  emoji: { fontSize: 34 },
  fila: { flexDirection: 'row', gap: space.md },
  receta: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, overflow: 'hidden', paddingBottom: space.sm },
  foto: { height: 110, backgroundColor: '#EFE7D6' },
  nombre: { fontSize: 14, fontWeight: '700', color: colors.ink, paddingHorizontal: space.sm, marginTop: space.sm },
  aviso: { fontSize: 11, color: colors.rose, paddingHorizontal: space.sm, marginTop: 2 },
  boton: { alignSelf: 'center', paddingVertical: space.xs, paddingHorizontal: space.md },
  botonTexto: { fontSize: 15, fontWeight: '700', color: colors.oliveInk },
});
