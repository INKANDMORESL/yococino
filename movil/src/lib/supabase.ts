// Conexión con Supabase (base de datos y usuarios).
// La URL y la clave pública llegan como variables EXPO_PUBLIC_*, que GitHub inyecta al compilar.
// La clave pública ("anon" o "publishable") está pensada para ir dentro de la app:
// lo que protege los datos son las reglas de seguridad por fila de la base de datos.
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const clave = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const supabaseConfigurado = url.startsWith('https://') && clave.length > 20;

export const supabase = createClient(supabaseConfigurado ? url : 'https://sin-configurar.supabase.co', supabaseConfigurado ? clave : 'sin-configurar', {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
    flowType: 'pkce',
  },
});

// En el móvil, renovar la sesión solo mientras la app está abierta.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (estado) => {
    if (estado === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
