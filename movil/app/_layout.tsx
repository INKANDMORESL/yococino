import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { EncuestaProvider } from '../src/features/encuesta/store';
import { AuthProvider } from '../src/lib/auth';
import { colors } from '../src/theme';

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
            <Stack.Screen name="cocinar" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="menu" />
            <Stack.Screen name="tutorial" options={{ animation: 'fade', gestureEnabled: false }} />
            <Stack.Screen name="suscripcion" options={{ animation: 'slide_from_bottom' }} />
          </Stack>
        </EncuestaProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
