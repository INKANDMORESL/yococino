// Pagos con RevenueCat (Google Play y App Store). La clave pública de RevenueCat llega en la compilación
// (variables de GitHub REVENUECAT_ANDROID_KEY / REVENUECAT_IOS_KEY). Sin clave, los pagos siguen «llegarán pronto».
import { Platform } from 'react-native';
import Purchases from 'react-native-purchases';

const clave = Platform.OS === 'android' ? process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY : process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
export const pagosDisponibles = !!clave;

let configurado = false;
// Se llama al iniciar sesión: la compra queda unida a la cuenta de Yococino (id de Supabase).
export async function iniciarPagos(userId: string) {
  if (!clave) return;
  try {
    if (!configurado) {
      Purchases.configure({ apiKey: clave, appUserID: userId });
      configurado = true;
    } else {
      await Purchases.logIn(userId);
    }
  } catch {
    // Sin pagos no se rompe nada: la app sigue funcionando.
  }
}

export async function cerrarPagos() {
  if (!configurado) return;
  try {
    await Purchases.logOut();
  } catch {
    // nada
  }
}
