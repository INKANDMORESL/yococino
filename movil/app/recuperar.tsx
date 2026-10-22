// ¿Olvidaste tu contraseña? Se envía un enlace al email para poner una nueva.
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Aparecer, Aviso, Boton, Campo, useSacudida } from '../src/components';
import { Cabecera } from '../src/features/cuenta/Cabecera';
import { emailValido } from '../src/features/cuenta/validar';
import { mensajeError, useAuth } from '../src/lib/auth';
import { colors, space, type } from '../src/theme';

export default function Recuperar() {
  const { recuperarContrasena } = useAuth();
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [enviado, setEnviado] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { x, sacudir } = useSacudida();

  const enviar = async () => {
    setError(null);
    if (!emailValido(email)) {
      setError('Escribe el email con el que te registraste.');
      sacudir();
      return;
    }
    setOcupado(true);
    try {
      await recuperarContrasena(email.trim());
      setEnviado(true);
    } catch (e) {
      setError(mensajeError(e));
      sacudir();
    } finally {
      setOcupado(false);
    }
  };

  return (
    <SafeAreaView style={s.pantalla}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.lista} keyboardShouldPersistTaps="handled">
          <Cabecera titulo="Recupera tu contraseña" subtitulo="Te enviamos un enlace para que pongas una nueva." />
          {enviado ? (
            <Aparecer style={{ gap: space.lg }}>
              <Aviso
                tono="hoja"
                texto={`Si hay una cuenta con ${email.trim()}, te llegará un correo en unos minutos. Abre el enlace desde este mismo dispositivo para poner tu nueva contraseña.`}
              />
              <Text style={type.small}>¿No te llega? Mira en la carpeta de correo no deseado o vuelve a intentarlo en un minuto.</Text>
            </Aparecer>
          ) : (
            <Aparecer retraso={100}>
              <Campo
                etiqueta="Email"
                grande={false}
                value={email}
                onChangeText={setEmail}
                placeholder="tu@email.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
                onSubmitEditing={enviar}
              />
            </Aparecer>
          )}
          {error ? <Aviso texto={error} tono="rosa" x={x} /> : null}
        </ScrollView>
        <View style={s.pie}>
          {enviado ? (
            <Boton texto="Volver a entrar" variante="linea" onPress={() => router.replace('/entrar')} />
          ) : (
            <Boton texto="Enviar enlace" cargando={ocupado} onPress={enviar} />
          )}
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
