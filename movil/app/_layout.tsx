import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { EncuestaProvider } from '../src/features/encuesta/store';
import { Arranque } from '../src/components/Arranque';
import { AuthProvider, useAuth } from '../src/lib/auth';
import { colors } from '../src/theme';

// Animación del logo al abrir la app, hasta saber si hay sesión (Inicio se va cargando por detrás).
function AnimacionArranque() {
  const { cargando } = useAuth();
  return <Arranque listo={!cargando} />;
}

export default function Layout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <EncuestaProvider>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.bg },
              animation: 'slide_from_right',
            }}
          >
            <Stack.Screen name="index" options={{ animation: 'fade' }} />
            <Stack.Screen name="(tabs)" options={{ animation: 'fade', gestureEnabled: false }} />
            <Stack.Screen name="auth" options={{ animation: 'fade' }} />
            {/* Receta, menú completo y especial llevan la misma barra de abajo: se abren con un fundido rápido
                para que la barra no se mueva ni parezca que se recarga. */}
            <Stack.Screen name="receta/[id]" options={{ animation: 'fade', animationDuration: 150 }} />
            <Stack.Screen name="menu" options={{ animation: 'fade', animationDuration: 150 }} />
            <Stack.Screen name="especial" options={{ animation: 'fade', animationDuration: 150 }} />
            <Stack.Screen name="cocinar" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="tutorial" options={{ animation: 'fade', gestureEnabled: false }} />
            <Stack.Screen name="suscripcion" options={{ animation: 'slide_from_bottom' }} />
          </Stack>
          <AnimacionArranque />
        </EncuestaProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
