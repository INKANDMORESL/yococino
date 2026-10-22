// Pestañas principales: Hoy, Compra, Progreso y Perfil. Solo con sesión iniciada.
import { Redirect, Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useAuth } from '../../src/lib/auth';
import { colors } from '../../src/theme';

const icono = (emoji: string) =>
  function Icono({ focused }: { focused: boolean }) {
    return <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>;
  };

export default function Pestanas() {
  const { sesion, cargando } = useAuth();
  if (!cargando && !sesion) return <Redirect href="/" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.olive,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '700' },
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.line, height: 64, paddingTop: 6, paddingBottom: 8 },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="inicio" options={{ title: 'Hoy', tabBarIcon: icono('🍽️') }} />
      <Tabs.Screen name="compra" options={{ title: 'Compra', tabBarIcon: icono('🛒') }} />
      <Tabs.Screen name="progreso" options={{ title: 'Progreso', tabBarIcon: icono('📈') }} />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil', tabBarIcon: icono('👤') }} />
    </Tabs>
  );
}
