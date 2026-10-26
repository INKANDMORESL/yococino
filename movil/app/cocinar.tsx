// Cocina con lo que tienes: la persona escribe lo que hay en casa. Primero se le enseñan recetas que ya existen
// con esos ingredientes (sin gastar IA) y, si ninguna le convence, se crea una nueva apta para ella.
import { router } from 'expo-router';
import { useState } from 'react';
import { Image, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Aparecer, Aviso, Boton, Campo, Chip } from '../src/components';
import { ErrorMenu, cocinarCon, type SugerenciaCocinar } from '../src/features/menu/api';
import { colors, radius, space, type } from '../src/theme';

const TIPOS = [
  { clave: 'desayuno', texto: 'Desayuno' },
  { clave: 'almuerzo', texto: 'Comida' },
  { clave: 'merienda', texto: 'Merienda' },
  { clave: 'cena', texto: 'Cena' },
] as const;

const IDEAS = ['huevos', 'arroz', 'tomate', 'calabacín', 'pollo', 'garbanzos', 'patata', 'atún', 'espinacas', 'queso fresco'];

export default function Cocinar() {
  const [texto, setTexto] = useState('');
  const [lista, setLista] = useState<string[]>([]);
  const [tipo, setTipo] = useState<(typeof TIPOS)[number]['clave']>(new Date().getHours() >= 17 ? 'cena' : 'almuerzo');
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ id: number; nombre: string; descartados: string[] } | null>(null);
  const [sugerencias, setSugerencias] = useState<SugerenciaCocinar[] | null>(null);
  const [descartados, setDescartados] = useState<string[]>([]);

  const anadir = (t = texto) => {
    const nuevos = t
      .split(/[,;\n]/)
      .map((x) => x.trim().toLowerCase())
      .filter((x) => x && x.length <= 40 && !lista.includes(x));
    if (nuevos.length) {
      setSugerencias(null);
      setLista([...lista, ...nuevos].slice(0, 12));
    }
    setTexto('');
  };

  const crear = async (nueva = false) => {
    const todos = texto.trim() ? [...lista, ...texto.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean)] : lista;
    if (!todos.length) {
      setError('Escribe al menos un ingrediente que tengas en casa.');
      return;
    }
    setLista(todos.slice(0, 12));
    setTexto('');
    setError(null);
    setCreando(true);
    try {
      const r = await cocinarCon(todos.slice(0, 12), tipo, nueva);
      setDescartados(r.descartados);
      if (r.sugerencias?.length) {
        setSugerencias(r.sugerencias);
        return;
      }
      if (!r.receta_id) throw new Error('Sin receta');
      setSugerencias(null);
      if (r.descartados.length) setResultado({ id: r.receta_id, nombre: r.nombre ?? 'Tu receta', descartados: r.descartados });
      else router.replace({ pathname: '/receta/[id]', params: { id: String(r.receta_id) } });
    } catch (e) {
      setError(e instanceof ErrorMenu ? e.message : 'No hemos podido crear la receta.');
    } finally {
      setCreando(false);
    }
  };

  return (
    <SafeAreaView style={s.pantalla} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView contentContainerStyle={s.contenido} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => router.navigate('/inicio')} accessibilityRole="button" accessibilityLabel="Volver" style={s.volver}>
            <Text style={s.flecha}>‹</Text>
          </Pressable>

          <Aparecer>
            <Text style={type.display}>Cocina con lo que tienes</Text>
            <Text style={[type.body, { marginTop: space.xs }]}>Dinos qué hay en tu nevera y te proponemos una receta casera, sin lo que no puedes o no te gusta.</Text>
          </Aparecer>

          <Aparecer retraso={60} style={{ gap: space.md }}>
            <Campo
              etiqueta="¿Qué tienes en casa?"
              grande={false}
              value={texto}
              onChangeText={setTexto}
              onSubmitEditing={() => anadir()}
              returnKeyType="done"
              placeholder="Por ejemplo: huevos, calabacín"
              maxLength={120}
              autoCapitalize="none"
            />
            {texto.trim() ? <Boton texto="Añadir" variante="suave" onPress={() => anadir()} /> : null}
            {lista.length ? (
              <View style={s.chips}>
                {lista.map((x) => (
                  <Chip key={x} texto={x} elegido quitar onPress={() => {
                    setSugerencias(null);
                    setLista(lista.filter((y) => y !== x));
                  }} />
                ))}
              </View>
            ) : (
              <View style={{ gap: space.sm }}>
                <Text style={type.small}>Ideas rápidas:</Text>
                <View style={s.chips}>
                  {IDEAS.map((x) => (
                    <Chip key={x} texto={`+ ${x}`} elegido={false} onPress={() => anadir(x)} />
                  ))}
                </View>
              </View>
            )}
          </Aparecer>

          <Aparecer retraso={120} style={{ gap: space.sm }}>
            <Text style={[type.label, { marginLeft: space.xs }]}>¿Para qué comida?</Text>
            <View style={s.chips}>
              {TIPOS.map((t) => (
                <Chip key={t.clave} texto={t.texto} elegido={tipo === t.clave} onPress={() => {
                    setSugerencias(null);
                    setTipo(t.clave);
                  }} />
              ))}
            </View>
          </Aparecer>

          {error ? <Aviso tono="rosa" texto={error} /> : null}

          {sugerencias ? (
            <Aparecer style={{ gap: space.md }}>
              <Text style={type.heading}>Ya tenemos estas recetas con lo que tienes</Text>
              {descartados.length ? (
                <Text style={type.small}>Hemos dejado fuera {descartados.join(', ')} porque no encaja con tus alergias o lo que no te gusta.</Text>
              ) : null}
              {sugerencias.map((sug) => (
                <Pressable
                  key={sug.id}
                  onPress={() => router.push({ pathname: '/receta/[id]', params: { id: String(sug.id) } })}
                  accessibilityRole="button"
                  style={s.sugerencia}
                >
                  <View style={s.sugFoto}>{sug.imagen ? <Image source={{ uri: sug.imagen }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : <Text style={{ fontSize: 26 }}>🍽️</Text>}</View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.sugNombre} numberOfLines={2}>
                      {sug.nombre}
                    </Text>
                    <Text style={type.small}>Usa: {sug.coinciden.join(', ')}</Text>
                    {sug.faltan.length ? <Text style={type.small}>Te faltaría: {sug.faltan.join(', ')}</Text> : null}
                  </View>
                  <Text style={s.flechita}>›</Text>
                </Pressable>
              ))}
              <Boton texto={creando ? 'Pensando tu receta…' : 'Ninguna me convence: crear una nueva'} variante="suave" cargando={creando} onPress={() => crear(true)} />
              {creando ? <Text style={[type.small, { textAlign: 'center' }]}>Tarda unos 30 segundos. No cierres esta pantalla.</Text> : null}
            </Aparecer>
          ) : resultado ? (
            <View style={s.resultado}>
              <Text style={type.heading}>{resultado.nombre}</Text>
              <Text style={type.body}>
                Hemos dejado fuera {resultado.descartados.join(', ')} porque no encaja{resultado.descartados.length > 1 ? 'n' : ''} con tus alergias o lo que no te gusta.
              </Text>
              <Boton texto="Ver la receta" onPress={() => router.replace({ pathname: '/receta/[id]', params: { id: String(resultado.id) } })} />
            </View>
          ) : (
            <View style={{ gap: space.sm }}>
              <Boton texto={creando ? 'Buscando recetas…' : 'Buscar recetas'} cargando={creando} onPress={() => crear(false)} />
              {creando ? <Text style={[type.small, { textAlign: 'center' }]}>Si no hay ninguna, creamos una nueva: tarda unos 30 segundos.</Text> : null}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.bg },
  contenido: { padding: space.xl, gap: space.xl, paddingBottom: space.xxl },
  volver: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  flecha: { fontSize: 28, lineHeight: 30, color: colors.ink, marginTop: -2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  resultado: { backgroundColor: colors.leafSoft, borderRadius: radius.lg, padding: space.lg, gap: space.md },
  sugerencia: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.md },
  sugFoto: { width: 64, height: 64, borderRadius: radius.md, backgroundColor: colors.leafSoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  sugNombre: { fontSize: 16, fontWeight: '700', color: colors.ink },
  flechita: { fontSize: 24, color: colors.muted },
});
