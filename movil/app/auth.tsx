// Vuelta desde Google o desde el enlace de confirmación del email.
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { Boton } from '../src/components';
import { mensajeError, useAuth } from '../src/lib/auth';
import { supabase } from '../src/lib/supabase';
import { colors, space, type } from '../src/theme';

export default function Auth() {
  const { sesion } = useAuth();
  const { code } = useLocalSearchParams<{ code?: string }>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // En la web, Supabase lee el código de la dirección por sí solo. En el móvil hay que canjearlo.
    if (Platform.OS !== 'web' && code && !sesion) {
      supabase.auth.exchangeCodeForSession(code).then(({ error: e }) => {
        if (e) setError(mensajeError(e));
      });
    }
  }, [code, sesion]);

  if (sesion) return <Redirect href="/inicio" />;

  return (
    <View style={s.pantalla}>
      {error ? (
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
