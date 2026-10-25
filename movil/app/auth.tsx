// Vuelta desde Google o desde el enlace de confirmación del email.
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { Boton } from '../src/components';
import { mensajeError, useAuth } from '../src/lib/auth';
import { supabase } from '../src/lib/supabase';
import { colors, space, type } from '../src/theme';

export default function Auth() {
  const { sesion, recuperando } = useAuth();
  const { code, error_description } = useLocalSearchParams<{ code?: string; error_description?: string }>();
  const [error, setError] = useState<string | null>(null);
  // El enlace del email ya activa la cuenta en el servidor. Si se abre en otro navegador o en otro móvil
  // distinto de donde se creó la cuenta, no se puede entrar solo: se avisa y se manda a «Entrar».
  const [sinEntrar, setSinEntrar] = useState(false);

  useEffect(() => {
    // En la web, Supabase lee el código de la dirección por sí solo. En el móvil hay que canjearlo.
    if (Platform.OS !== 'web' && code && !sesion) {
      supabase.auth.exchangeCodeForSession(code).then(({ error: e }) => {
        if (!e) return;
        if (/verifier|code/i.test(e.message)) setSinEntrar(true);
        else setError(mensajeError(e));
      });
    }
  }, [code, sesion]);

  useEffect(() => {
    if (error_description) setSinEntrar(true);
    const t = setTimeout(() => setSinEntrar(true), 8000);
    return () => clearTimeout(t);
  }, [error_description]);

  if (sesion && recuperando) return <Redirect href="/nueva-contrasena" />;
  if (sesion) return <Redirect href="/inicio" />;

  return (
    <View style={s.pantalla}>
      {sinEntrar && !error ? (
        <View style={{ gap: space.lg, alignSelf: 'stretch' }}>
          <Text style={{ fontSize: 56, textAlign: 'center' }}>✅</Text>
          <Text style={[type.title, { textAlign: 'center' }]}>Tu cuenta está activada</Text>
          <Text style={[type.body, { textAlign: 'center', color: colors.ink }]}>
            Si acabas de confirmar tu email, ya está todo listo. Entra con tu email y tu contraseña.
          </Text>
          <Boton texto="Entrar" onPress={() => router.replace('/entrar')} />
        </View>
      ) : error ? (
        <View style={{ gap: space.lg, alignSelf: 'stretch' }}>
          <Text style={[type.body, { textAlign: 'center', color: colors.ink }]}>{error}</Text>
          <Boton texto="Volver a entrar" onPress={() => setError(null)} variante="linea" />
        </View>
      ) : (
        <>
          <ActivityIndicator size="large" color={colors.olive} />
          <Text style={type.body}>Entrando en tu cuenta…</Text>
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  pantalla: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg, padding: space.xl, backgroundColor: colors.bg },
});
