// Nueva contraseña, al volver desde el enlace del correo de recuperación.
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Aparecer, Aviso, Boton, Campo, useSacudida } from '../src/components';
import { mensajeError, useAuth } from '../src/lib/auth';
import { colors, space, type } from '../src/theme';

export default function NuevaContrasena() {
  const { sesion, cargando, cambiarContrasena } = useAuth();
  const [nueva, setNueva] = useState('');
  const [repetida, setRepetida] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { x, sacudir } = useSacudida();

  // Sin sesión (el enlace caducó o se abrió en otro dispositivo): a pedir otro enlace.
  if (!cargando && !sesion) return <Redirect href="/recuperar" />;

  const guardar = async () => {
    setError(null);
    if (nueva.length < 8) {
      setError('Usa al menos 8 caracteres.');
      return sacudir();
    }
    if (nueva !== repetida) {
      setError('Las dos contraseñas no coinciden.');
      return sacudir();
    }
    setOcupado(true);
    try {
      await cambiarContrasena(nueva);
      router.replace('/inicio');
    } catch (e) {
      setError(mensajeError(e));
      sacudir();
    } finally {
      setOcupado(false);
    }
  };

  return (
    <SafeAreaView style={s.pantalla}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView contentContainerStyle={s.lista} keyboardShouldPersistTaps="handled">
          <Aparecer>
            <Text style={type.display}>Nueva contraseña</Text>
            <Text style={[type.body, { marginTop: space.xs }]}>Elige una contraseña nueva para tu cuenta.</Text>
          </Aparecer>
          <Aparecer retraso={100} style={{ gap: space.lg }}>
            <Campo etiqueta="Nueva contraseña" grande={false} value={nueva} onChangeText={setNueva} secureTextEntry autoCapitalize="none" autoComplete="new-password" textContentType="newPassword" />
            <Campo etiqueta="Repítela" grande={false} value={repetida} onChangeText={setRepetida} secureTextEntry autoCapitalize="none" autoComplete="new-password" textContentType="newPassword" onSubmitEditing={guardar} />
          </Aparecer>
          {error ? <Aviso texto={error} tono="rosa" x={x} /> : null}
        </ScrollView>
        <View style={s.pie}>
          <Boton texto="Guardar contraseña" cargando={ocupado} onPress={guardar} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.bg },
  lista: { padding: space.xl, gap: space.xl, paddingBottom: space.xxl },
  pie: { padding: space.xl, paddingTop: space.md, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.bg },
});
