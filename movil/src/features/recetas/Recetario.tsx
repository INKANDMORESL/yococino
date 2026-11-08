// Recetario con buscador, filtros y «Ver más» (las recetas se cargan por páginas, no todas de golpe).
// Se usa en la pestaña Recetas (con Favoritas, Mis recetas y tipos de comida) y en cada tipo (Desayunos, Comidas…).
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Aviso, Boton, Chip } from '../../components';
import { guardarCache, leerCache } from '../../lib/cache';
import { colors, radius, shadow, space, type } from '../../theme';
import { ErrorMenu, buscarRecetas, type RecetaResumen } from '../menu/api';
import { kcalTexto } from '../menu/cantidades';
import { fotoPequena } from '../menu/fotos';
import { NIVEL, TIPOS, type TipoComida } from '../menu/tipos';
import { cargarFavoritas, type Favorita } from '../perfil/api';
import { MisRecetas } from './MisRecetas';

const POR_PAGINA = 20;

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
  { clave: 'airfryer', texto: '🍟 Airfryer' },
];

const BUSCAR: Record<TipoComida, string> = {
  desayuno: 'Busca un desayuno o un ingrediente',
  media_manana: 'Busca una media mañana o un ingrediente',
  almuerzo: 'Busca una comida o un ingrediente',
  merienda: 'Busca una merienda o un ingrediente',
  cena: 'Busca una cena o un ingrediente',
  otro: 'Busca una receta o un ingrediente',
};

interface Pagina {
  recetas: RecetaResumen[];
  siguiente: number | null;
}

export function Recetario({
  tipoFijo,
  pedido,
}: {
  // Solo recetas de ese tipo (pantalla de Desayunos, Comidas…). Sin él, se enseñan los filtros de tipo, Favoritas y Mis recetas.
  tipoFijo?: TipoComida;
  // Filtro que se pide desde fuera (por ejemplo «mias» al tocar lo de TikTok); «vez» cambia en cada petición.
  pedido?: { filtro: string; vez: number };
}) {
  const [texto, setTexto] = useState('');
  const [filtro, setFiltro] = useState<string | null>(pedido?.filtro ?? null);
  useEffect(() => {
    if (pedido) setFiltro(pedido.filtro);
  }, [pedido]);
  const [categoria, setCategoria] = useState<string | null>(null);
  const [sub, setSub] = useState<string | null>(null);
  const subs = CATEGORIAS.find((c) => c.clave === categoria)?.subs ?? [];
  const tipo = tipoFijo ?? (filtro && filtro !== 'favoritas' && filtro !== 'mias' ? filtro : null);
  const clave = `recetario:${texto.trim().toLowerCase()}|${tipo ?? ''}|${categoria ?? ''}|${sub ?? ''}`;
  const [pagina, setPagina] = useState<Pagina | null>(leerCache<Pagina>(clave) ?? null);
  const [favs, setFavs] = useState<Favorita[]>(leerCache<Favorita[]>('favoritas') ?? []);
  const favoritas = new Set(favs.map((f) => f.id));
  const [cargando, setCargando] = useState(false);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const turno = useRef(0);

  useFocusEffect(
    useCallback(() => {
      cargarFavoritas()
        .then((f) => setFavs(guardarCache('favoritas', f)))
        .catch(() => {});
    }, []),
  );

  // Primera página: al dejar de escribir (con una pequeña espera) o al cambiar un filtro.
  useEffect(() => {
    const mio = ++turno.current;
    if (filtro === 'mias' || filtro === 'favoritas') return;
    const enMemoria = leerCache<Pagina>(clave);
    setPagina(enMemoria ?? null);
    if (enMemoria) return;
    const t = setTimeout(
      async () => {
        setCargando(true);
        setError(null);
        try {
          const p = guardarCache(clave, await buscarRecetas(texto.trim(), tipo, categoria, sub, 0, POR_PAGINA));
          if (mio === turno.current) setPagina(p);
        } catch (e) {
          if (mio === turno.current) setError(e instanceof ErrorMenu ? e.message : 'No hemos podido buscar recetas.');
        } finally {
          if (mio === turno.current) setCargando(false);
        }
      },
      texto ? 400 : 150,
    );
    return () => clearTimeout(t);
  }, [clave, filtro]);

  const verMas = async () => {
    if (!pagina || pagina.siguiente === null || cargandoMas) return;
    const mio = turno.current;
    setCargandoMas(true);
    setError(null);
    try {
      const mas = await buscarRecetas(texto.trim(), tipo, categoria, sub, pagina.siguiente, POR_PAGINA);
      if (mio !== turno.current) return;
      const vistas = new Set(pagina.recetas.map((r) => r.id));
      const nueva = { recetas: [...pagina.recetas, ...mas.recetas.filter((r) => !vistas.has(r.id))], siguiente: mas.siguiente };
      setPagina(guardarCache(clave, nueva));
    } catch (e) {
      if (mio === turno.current) setError(e instanceof ErrorMenu ? e.message : 'No hemos podido cargar más recetas.');
    } finally {
      setCargandoMas(false);
    }
  };

  // Favoritas: todas las guardadas (filtradas por el texto, si lo hay).
  const lista: RecetaResumen[] =
    filtro === 'favoritas'
      ? favs
          .filter((f) => !texto.trim() || f.nombre.toLowerCase().includes(texto.trim().toLowerCase()))
          .map((f) => ({ ...f, nivel: (['facil', 'medio', 'elaborado'].includes(f.nivel) ? f.nivel : 'facil') as RecetaResumen['nivel'] }))
      : (pagina?.recetas ?? []);
  const conFiltros = filtro !== 'favoritas' && filtro !== 'mias';
  const buscarQue = tipoFijo ? BUSCAR[tipoFijo] : 'Busca un plato o un ingrediente';

  return (
    <View style={{ gap: space.lg }}>
      <View style={{ gap: space.md }}>
        {filtro !== 'mias' ? (
          <View style={s.buscador}>
            <Text style={s.lupa}>⌕</Text>
            <TextInput
              value={texto}
              onChangeText={setTexto}
              placeholder={buscarQue}
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
        {!tipoFijo ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.desliza} contentContainerStyle={s.filtros}>
            {FILTROS.map((f) => (
              <Chip key={f.clave ?? 'todas'} texto={f.texto} elegido={filtro === f.clave} onPress={() => setFiltro(f.clave)} />
            ))}
          </ScrollView>
        ) : null}
        {conFiltros ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.desliza} contentContainerStyle={s.filtros}>
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
        {conFiltros && subs.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.desliza} contentContainerStyle={s.filtros}>
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
      ) : conFiltros && (!pagina || (cargando && !lista.length)) ? (
        <View style={s.centro}>{error ? null : <ActivityIndicator color={colors.olive} />}</View>
      ) : lista.length === 0 ? (
        <View style={s.centro}>
          <Text style={{ fontSize: 40 }}>🔎</Text>
          <Text style={[type.body, { textAlign: 'center' }]}>
            {filtro === 'favoritas'
              ? 'Aún no tienes favoritas aquí. Toca el corazón ♡ en una receta.'
              : categoria
                ? 'No hay recetas con ese filtro. Prueba con otro o quítalo.'
                : 'No hay recetas con esa búsqueda. Prueba con otra palabra.'}
          </Text>
        </View>
      ) : (
        <View style={{ gap: space.md }}>
          {lista.map((r) => (
            <TarjetaReceta key={r.id} receta={r} favorita={favoritas.has(r.id)} />
          ))}
          {conFiltros && pagina?.siguiente !== null ? <Boton texto="Ver más recetas" variante="suave" onPress={verMas} cargando={cargandoMas} /> : null}
        </View>
      )}
    </View>
  );
}

export function TarjetaReceta({ receta: r, favorita }: { receta: RecetaResumen; favorita?: boolean }) {
  const t = TIPOS[r.tipo_comida as TipoComida] ?? TIPOS.otro;
  const detalles = [t.texto, r.minutos ? `${r.minutos} min` : null, r.minutos ? NIVEL[r.nivel] : null, kcalTexto(r.kcal)].filter(Boolean).join(' · ');
  const foto = fotoPequena(r);
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/receta/[id]', params: { id: String(r.id) } })}
      accessibilityRole="button"
      accessibilityLabel={`${r.nombre}. Ver receta`}
      style={s.tarjeta}
    >
      <View style={[s.foto, { backgroundColor: t.fondo }]}>
        {foto ? <Image source={{ uri: foto }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : <Text style={{ fontSize: 30 }}>{t.emoji}</Text>}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.nombre} numberOfLines={2}>
          {r.nombre}
        </Text>
        {r.especial ? (
          <View style={s.etiquetaEspecial}>
            <Text style={s.etiquetaEspecialTexto}>{r.especial}</Text>
          </View>
        ) : r.descripcion ? (
          <Text style={type.small} numberOfLines={1}>
            {r.descripcion}
          </Text>
        ) : null}
        <Text style={s.detalles}>{detalles}</Text>
        {r.aviso ? <Text style={s.avisoTexto}>⚠️ {r.aviso}</Text> : null}
      </View>
      {favorita ? <Text style={s.corazon}>♥</Text> : null}
    </Pressable>
  );
}

const s = StyleSheet.create({
  etiquetaEspecial: { alignSelf: 'flex-start', backgroundColor: colors.lemonSoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, marginVertical: 2 },
  etiquetaEspecialTexto: { fontSize: 12, fontWeight: '700', color: colors.ink },
  avisoTexto: { fontSize: 12, color: colors.rose, marginTop: 2 },
  buscador: { flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: space.lg, height: 52, ...shadow },
  lupa: { fontSize: 22, color: colors.muted },
  input: { flex: 1, fontSize: 16, color: colors.ink, height: '100%' },
  borrar: { fontSize: 22, color: colors.muted },
  desliza: { marginHorizontal: -space.xl },
  filtros: { gap: space.sm, paddingHorizontal: space.xl },
  centro: { alignItems: 'center', gap: space.md, paddingVertical: space.xxl },
  tarjeta: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.md, ...shadow },
  foto: { width: 76, height: 76, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  nombre: { fontSize: 16, fontWeight: '700', color: colors.ink, lineHeight: 21 },
  detalles: { fontSize: 13, color: colors.muted, marginTop: 3 },
  corazon: { fontSize: 18, color: colors.rose },
});
