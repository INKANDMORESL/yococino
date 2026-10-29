// Entrar con una cuenta existente.
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Aparecer, Aviso, Boton, Campo, Separador, useSacudida } from '../src/components';
import { Cabecera } from '../src/features/cuenta/Cabecera';
import { emailValido } from '../src/features/cuenta/validar';
import { mensajeError, useAuth } from '../src/lib/auth';
import { colors, space } from '../src/theme';
import { EnlacesLegales } from '../src/features/cuenta/Legal';
import { BotonApple } from '../src/features/cuenta/BotonApple';

export default function Entrar() {
  const { sesion, entrarConEmail, entrarConGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<'email' | 'google' | 'apple' | null>(null);
  const { x, sacudir } = useSacudida();

  if (sesion) return <Redirect href="/inicio" />;

  const fallo = (m: string) => {
    setError(m);
    sacudir();
  };

  const conEmail = async () => {
    setError(null);
    if (!emailValido(email) || !contrasena) return fallo('Escribe tu email y tu contraseña.');
    setOcupado('email');
    try {
      await entrarConEmail(email.trim(), contrasena);
    } catch (e) {
      fallo(mensajeError(e));
    } finally {
      setOcupado(null);
    }
  };

  const conGoogle = async () => {
    setError(null);
    setOcupado('google');
    try {
      await entrarConGoogle();
    } catch (e) {
      fallo(mensajeError(e));
    } finally {
      setOcupado(null);
    }
  };

  return (
    <SafeAreaView style={s.pantalla}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView contentContainerStyle={s.lista} keyboardShouldPersistTaps="handled">
          <Cabecera titulo="Hola de nuevo" subtitulo="Entra para ver tu menú de hoy." />
          <Aparecer retraso={100}>
            <Boton texto="Continuar con Google" variante="google" icono="G" cargando={ocupado === 'google'} desactivado={ocupado === 'email'} onPress={conGoogle} />
                        <BotonApple onError={(e) => fallo(mensajeError(e))} desactivado={ocupado !== null} alEmpezar={() => setOcupado('apple')} alTerminar={() => setOcupado(null)} />
          </Aparecer>
          <Aparecer retraso={160}>
            <Separador texto="o con tu email" />
          </Aparecer>
          <Aparecer retraso={220} style={{ gap: space.lg }}>
            <Campo etiqueta="Email" grande={false} value={email} onChangeText={setEmail} placeholder="tu@email.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" />
            <Campo etiqueta="Contraseña" grande={false} value={contrasena} onChangeText={setContrasena} secureTextEntry autoCapitalize="none" autoComplete="current-password" textContentType="password" onSubmitEditing={conEmail} />
          </Aparecer>
          <Pressable onPress={() => router.push({ pathname: '/recuperar', params: email ? { email: email.trim() } : {} })} accessibilityRole="link" style={s.olvido}>
            <Text style={s.olvidoTexto}>¿Olvidaste tu contraseña?</Text>
          </Pressable>
          {error ? <Aviso texto={error} tono="rosa" x={x} /> : null}
        </ScrollView>
        <View style={s.pie}>
          <Boton texto="Entrar" cargando={ocupado === 'email'} desactivado={ocupado === 'google'} onPress={conEmail} />
          <EnlacesLegales />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.bg },
  lista: { padding: space.xl, gap: space.xl, paddingBottom: space.xxl },
  olvido: { alignSelf: 'flex-end', paddingVertical: space.xs },
  olvidoTexto: { color: colors.olive, fontWeight: '700', fontSize: 15 },
  pie: { padding: space.xl, paddingTop: space.md, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.bg },
});
