// Contactar con Yococino: conversación con el equipo. Las respuestas llegan desde el panel de gestión.
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Aviso } from '../src/components';
import { cargarMensajes, enviarMensaje, marcarLeidos, type Mensaje } from '../src/features/contacto/api';
import { useAuth } from '../src/lib/auth';
import { volver } from '../src/lib/volver';
import { colors, radius, shadow, space, type } from '../src/theme';

const hora = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1} · ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export default function Contacto() {
  const { sesion } = useAuth();
  const [mensajes, setMensajes] = useState<Mensaje[] | null>(null);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lista = useRef<ComponentRef<typeof ScrollView>>(null);

  const cargar = useCallback(async () => {
    try {
      setMensajes(await cargarMensajes());
      marcarLeidos().catch(() => {});
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No hemos podido cargar tus mensajes.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargar();
      // Mientras la pantalla está abierta, se miran las respuestas cada 20 segundos.
      const t = setInterval(cargar, 20_000);
      return () => clearInterval(t);
    }, [cargar]),
  );

  const enviar = async () => {
    if (!sesion || !texto.trim() || enviando) return;
    setEnviando(true);
    setError(null);
    try {
      await enviarMensaje(sesion.user.id, texto);
      setTexto('');
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se ha podido enviar.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <SafeAreaView style={s.pantalla} edges={['top', 'bottom']}>
      <View style={s.cabecera}>
        <Pressable onPress={() => volver('/perfil')} accessibilityRole="button" accessibilityLabel="Volver" hitSlop={8} style={s.volver}>
          <Text style={s.flecha}>‹</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={type.title}>Contacta con nosotros</Text>
          <Text style={type.small}>Te respondemos aquí mismo, normalmente en 24-48 horas.</Text>
        </View>
      </View>
      <Pressable
        onPress={() => Linking.openURL('https://www.instagram.com/yococino.app/').catch(() => {})}
        accessibilityRole="link"
        accessibilityLabel="Síguenos en Instagram"
        style={s.instagram}
      >
        <Text style={{ fontSize: 20 }}>📸</Text>
        <Text style={s.instagramTexto}>Síguenos en Instagram: @yococino.app</Text>
        <Text style={s.instagramFlecha}>›</Text>
      </Pressable>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView ref={lista} contentContainerStyle={s.contenido} onContentSizeChange={() => lista.current?.scrollToEnd({ animated: false })}>
          {mensajes === null ? (
            <ActivityIndicator color={colors.olive} style={{ marginTop: space.xxl }} />
          ) : mensajes.length === 0 ? (
            <View style={s.vacio}>
              <Text style={{ fontSize: 40 }}>💬</Text>
              <Text style={[type.body, { textAlign: 'center' }]}>
                ¿Dudas, ideas o algún problema con la app? Escríbenos y te contestaremos. Por favor, no nos envíes datos de salud que no hagan falta.
              </Text>
            </View>
          ) : (
            mensajes.map((m) => (
              <View key={m.id} style={[s.burbuja, m.de === 'cliente' ? s.mia : s.suya]}>
                {m.de === 'equipo' ? <Text style={s.quien}>Equipo Yococino</Text> : null}
                <Text style={[s.texto, m.de === 'cliente' && { color: '#fff' }]}>{m.texto}</Text>
                <Text style={[s.hora, m.de === 'cliente' && { color: 'rgba(255,255,255,0.75)' }]}>{hora(m.created_at)}</Text>
              </View>
            ))
          )}
          {error ? <Aviso tono="rosa" texto={error} /> : null}
        </ScrollView>

        <View style={s.escribir}>
          <TextInput
            value={texto}
            onChangeText={setTexto}
            placeholder="Escribe tu mensaje"
            placeholderTextColor={colors.muted}
            multiline
            maxLength={2000}
            style={s.input}
            accessibilityLabel="Mensaje"
          />
          <Pressable onPress={enviar} disabled={!texto.trim() || enviando} accessibilityRole="button" accessibilityLabel="Enviar" style={[s.enviar, (!texto.trim() || enviando) && { opacity: 0.4 }]}>
            {enviando ? <ActivityIndicator color="#fff" /> : <Text style={s.enviarTexto}>↑</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.bg },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.xl, paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: colors.line },
  volver: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', ...shadow },
  flecha: { fontSize: 28, lineHeight: 30, color: colors.ink, marginTop: -2 },
  instagram: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginHorizontal: space.xl, marginTop: space.md, paddingHorizontal: space.lg, paddingVertical: space.md, borderRadius: radius.lg, backgroundColor: colors.surface, ...shadow },
  instagramTexto: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.ink },
  instagramFlecha: { fontSize: 22, color: colors.muted },
  contenido: { padding: space.xl, gap: space.sm, flexGrow: 1 },
  vacio: { alignItems: 'center', gap: space.md, paddingVertical: space.xxl },
  burbuja: { maxWidth: '84%', borderRadius: radius.lg, paddingHorizontal: space.lg, paddingVertical: space.md, gap: 4 },
  mia: { alignSelf: 'flex-end', backgroundColor: colors.olive, borderBottomRightRadius: 6 },
  suya: { alignSelf: 'flex-start', backgroundColor: colors.surface, borderBottomLeftRadius: 6, ...shadow },
  quien: { fontSize: 12, fontWeight: '800', color: colors.olive },
  texto: { fontSize: 16, lineHeight: 22, color: colors.ink },
  hora: { fontSize: 11, color: colors.muted, alignSelf: 'flex-end' },
  escribir: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, padding: space.md, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.surface },
  input: { flex: 1, minHeight: 44, maxHeight: 140, borderRadius: 22, backgroundColor: colors.bg, paddingHorizontal: space.lg, paddingTop: 12, paddingBottom: 12, fontSize: 16, color: colors.ink },
  enviar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.olive, alignItems: 'center', justifyContent: 'center' },
  enviarTexto: { color: '#fff', fontSize: 22, fontWeight: '800' },
});
