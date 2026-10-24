// Recetario: buscador de recetas aptas para la persona, por nombre o ingrediente, y por tipo de comida.
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Aparecer, Aviso, Chip } from '../../src/components';
import { ErrorMenu, buscarRecetas, type RecetaResumen } from '../../src/features/menu/api';
import { kcalTexto } from '../../src/features/menu/cantidades';
import { fotoPequena } from '../../src/features/menu/fotos';
import { NIVEL, TIPOS, type TipoComida } from '../../src/features/menu/tipos';
import { cargarFavoritas } from '../../src/features/perfil/api';
import { MisRecetas } from '../../src/features/recetas/MisRecetas';
import { guardarCache, leerCache } from '../../src/lib/cache';
import { colors, radius, shadow, space, type } from '../../src/theme';

const FILTROS: { clave: string | null; texto: string }[] = [
  { clave: null, texto: 'Todas' },
  { clave: 'favoritas', texto: '♥ Favoritas' },
  { clave: 'mias', texto: '📥 Mis recetas' },
  { clave: 'desayuno', texto: 'Desayunos' },
  { clave: 'almuerzo', texto: 'Comidas' },
  { clave: 'cena', texto: 'Cenas' },
  { clave: 'merienda', texto: 'Meriendas' },
  { clave: 'media_manana', texto: 'Media mañana' },
];

// Filtros por ingrediente principal y, para carne y pescado, por tipo.
const CATEGORIAS: { clave: string; texto: string; subs?: { clave: string; texto: string }[] }[] = [
  {
    clave: 'carne',
    texto: '🍗 Carne',
    subs: [
      { clave: 'pollo', texto: 'Pollo' },
      { clave: 'pavo', texto: 'Pavo' },
      { clave: 'ternera', texto: 'Ternera' },
      { clave: 'cerdo', texto: 'Cerdo' },
      { clave: 'cordero', texto: 'Cordero' },
      { clave: 'conejo', texto: 'Conejo' },
    ],
  },
  {
    clave: 'pescado',
    texto: '🐟 Pescado',
    subs: [
      { clave: 'blanco', texto: 'Pescado blanco' },
      { clave: 'azul', texto: 'Pescado azul' },
    ],
  },
  { clave: 'marisco', texto: '🦐 Marisco' },
  { clave: 'huevos', texto: '🥚 Huevos' },
  { clave: 'legumbres', texto: '🫘 Legumbres' },
  { clave: 'vegetal', texto: '🥦 Sin carne ni pescado' },
  { clave: 'pasta_arroz', texto: '🍝 Pasta y arroz' },
];

export default function Recetas() {
  const [texto, setTexto] = useState('');
  const { ver } = useLocalSearchParams<{ ver?: string }>();
  const [filtro, setFiltro] = useState<string | null>(ver === 'mias' ? 'mias' : null);
  useEffect(() => {
    if (ver === 'mias') setFiltro('mias');
  }, [ver]);
  const [categoria, setCategoria] = useState<string | null>(null);
  const [sub, setSub] = useState<string | null>(null);
  const subs = CATEGORIAS.find((c) => c.clave === categoria)?.subs ?? [];
  const [recetas, setRecetas] = useState<RecetaResumen[] | null>(leerCache<RecetaResumen[]>('recetas:|') ?? null);
  const [favs, setFavs] = useState<{ id: number; nombre: string; tipo_comida: string }[]>(leerCache('favoritas') ?? []);
  const favoritas = new Set(favs.map((f) => f.id));
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const turno = useRef(0);

  useFocusEffect(
    useCallback(() => {
      cargarFavoritas()
        .then((f) => setFavs(guardarCache('favoritas', f)))
        .catch(() => {});
    }, []),
  );

  // Busca al dejar de escribir (con una pequeña espera) o al cambiar el filtro.
  useEffect(() => {
    const mio = ++turno.current;
    if (filtro === 'mias') return;
    const tipo = filtro && filtro !== 'favoritas' ? filtro : null;
    const clave = `recetas:${texto.trim().toLowerCase()}|${tipo ?? ''}${categoria ? `|${categoria}|${sub ?? ''}` : ''}`;
    const enMemoria = leerCache<RecetaResumen[]>(clave);
    if (enMemoria) setRecetas(enMemoria);
    const t = setTimeout(
      async () => {
        setCargando(true);
        setError(null);
        try {
          const r = guardarCache(clave, await buscarRecetas(texto.trim(), tipo, categoria, sub));
          if (mio === turno.current) setRecetas(r);
        } catch (e) {
          if (mio === turno.current) setError(e instanceof ErrorMenu ? e.message : 'No hemos podido buscar recetas.');
        } finally {
          if (mio === turno.current) setCargando(false);
        }
      },
      enMemoria ? 0 : texto ? 400 : 250,
    );
    return () => clearTimeout(t);
  }, [texto, filtro, categoria, sub]);

  // Favoritas: se muestran todas las guardadas (filtradas por el texto, si lo hay).
  const lista: RecetaResumen[] =
    filtro === 'favoritas'
      ? favs
          .filter((f) => !texto.trim() || f.nombre.toLowerCase().includes(texto.trim().toLowerCase()))
          .map((f) => {
            const encontrada = (recetas ?? []).find((r) => r.id === f.id);
            return encontrada ?? { id: f.id, nombre: f.nombre, descripcion: null, tipo_comida: f.tipo_comida, nivel: 'facil', minutos: null, kcal: null, imagen: null };
          })
      : (recetas ?? []);

  return (
    <SafeAreaView style={s.pantalla} edges={['top']}>
      <ScrollView contentContainerStyle={s.contenido} keyboardShouldPersistTaps="handled" stickyHeaderIndices={[1]}>
        <Aparecer>
          <Text style={type.display}>Recetas</Text>
          <Text style={[type.body, { marginTop: 2 }]}>Todas aptas para ti. Ábrelas y añádelas al día que quieras.</Text>
        </Aparecer>

        <View style={s.cabecera}>
          {filtro !== 'mias' ? (
            <View style={s.buscador}>
              <Text style={s.lupa}>⌕</Text>
              <TextInput
                value={texto}
                onChangeText={setTexto}
                placeholder="Busca un plato o un ingrediente"
                placeholderTextColor={colors.muted}
                style={s.input}
                returnKeyType="search"
                autoCorrect={false}
                accessibilityLabel="Buscar recetas"
                maxLength={60}
              />
              {texto ? (
                <Pressable onPress={() => setTexto('')} accessibilityRole="button" accessibilityLabel="Borrar búsqueda" hitSlop={8}>
                  <Text style={s.borrar}>×</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filtros}>
            {FILTROS.map((f) => (
              <Chip key={f.clave ?? 'todas'} texto={f.texto} elegido={filtro === f.clave} onPress={() => setFiltro(f.clave)} />
            ))}
          </ScrollView>
          {filtro !== 'favoritas' && filtro !== 'mias' ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filtros}>
              {CATEGORIAS.map((c) => (
                <Chip
                  key={c.clave}
                  texto={c.texto}
                  elegido={categoria === c.clave}
                  onPress={() => {
                    setCategoria(categoria === c.clave ? null : c.clave);
                    setSub(null);
                  }}
                />
              ))}
            </ScrollView>
          ) : null}
          {filtro !== 'favoritas' && filtro !== 'mias' && subs.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filtros}>
              <Chip texto="Todos" elegido={!sub} onPress={() => setSub(null)} />
              {subs.map((x) => (
                <Chip key={x.clave} texto={x.texto} elegido={sub === x.clave} onPress={() => setSub(sub === x.clave ? null : x.clave)} />
              ))}
            </ScrollView>
          ) : null}
        </View>

        {error && filtro !== 'mias' ? <Aviso tono="rosa" texto={error} /> : null}

        {filtro === 'mias' ? (
          <MisRecetas />
        ) : filtro !== 'favoritas' && (recetas === null || (cargando && !lista.length)) ? (
          <View style={s.centro}>
            <ActivityIndicator color={colors.olive} />
          </View>
        ) : lista.length === 0 ? (
          <View style={s.centro}>
            <Text style={{ fontSize: 40 }}>🔎</Text>
            <Text style={[type.body, { textAlign: 'center' }]}>
              {filtro === 'favoritas' ? 'Aún no tienes favoritas aquí. Toca el corazón ♡ en una receta.' : categoria ? 'No hay recetas con ese filtro. Prueba con otro o quítalo.' : 'No hay recetas con esa búsqueda. Prueba con otra palabra.'}
            </Text>
          </View>
        ) : (
          <View style={{ gap: space.md }}>
            {lista.map((r) => {
              const t = TIPOS[r.tipo_comida as TipoComida] ?? TIPOS.otro;
              const detalles = [t.texto, r.minutos ? `${r.minutos} min` : null, r.minutos ? NIVEL[r.nivel] : null, kcalTexto(r.kcal)].filter(Boolean).join(' · ');
              return (
                <Pressable
                  key={r.id}
                  onPress={() => router.push({ pathname: '/receta/[id]', params: { id: String(r.id) } })}
                  accessibilityRole="button"
                  accessibilityLabel={`${r.nombre}. Ver receta`}
                  style={s.tarjeta}
                >
                  <View style={[s.foto, { backgroundColor: t.fondo }]}>
                    {fotoPequena(r) ? <Image source={{ uri: fotoPequena(r)! }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : <Text style={{ fontSize: 30 }}>{t.emoji}</Text>}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.nombre} numberOfLines={2}>
                      {r.nombre}
                    </Text>
                    {r.descripcion ? (
                      <Text style={type.small} numberOfLines={1}>
                        {r.descripcion}
                      </Text>
                    ) : null}
                    <Text style={s.detalles}>{detalles}</Text>
                  </View>
                  {favoritas.has(r.id) ? <Text style={s.corazon}>♥</Text> : null}
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.bg },
  contenido: { padding: space.xl, gap: space.lg, paddingBottom: space.xxl },
  cabecera: { backgroundColor: colors.bg, gap: space.md, paddingVertical: space.sm },
  buscador: { flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: space.lg, height: 52, ...shadow },
  lupa: { fontSize: 22, color: colors.muted },
  input: { flex: 1, fontSize: 16, color: colors.ink, height: '100%' },
  borrar: { fontSize: 22, color: colors.muted },
  filtros: { gap: space.sm, paddingRight: space.xl },
  centro: { alignItems: 'center', gap: space.md, paddingVertical: space.xxl },
  tarjeta: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.md, ...shadow },
  foto: { width: 76, height: 76, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  nombre: { fontSize: 16, fontWeight: '700', color: colors.ink, lineHeight: 21 },
  detalles: { fontSize: 13, color: colors.muted, marginTop: 3 },
  corazon: { fontSize: 18, color: colors.rose },
});
