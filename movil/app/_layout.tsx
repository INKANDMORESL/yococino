import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { EncuestaProvider } from '../src/store';
import { colors } from '../src/theme';

export default function Layout() {
  return (
    <SafeAreaProvider>
      <EncuestaProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
      </EncuestaProvider>
    </SafeAreaProvider>
  );
}
