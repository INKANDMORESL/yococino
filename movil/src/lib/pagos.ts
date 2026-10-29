// Pagos con RevenueCat (Google Play y App Store). La clave pública de RevenueCat llega en la compilación
// (variables de GitHub REVENUECAT_ANDROID_KEY / REVENUECAT_IOS_KEY). Sin clave, los pagos siguen «llegarán pronto».
// La compra se une a la cuenta de Yococino (id de Supabase) y RevenueCat avisa al servidor (función
// pagos-revenuecat), que es quien decide si la persona es premium.
import { Platform } from 'react-native';
import Purchases, { PRODUCT_CATEGORY, type PurchasesStoreProduct } from 'react-native-purchases';
import { PLANES_TIENDA, SUSCRIPCION, type Periodo } from '../features/plan/productos';

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

export type ResultadoCompra = 'ok' | 'cancelada' | 'no_disponible' | 'error';

const idPlan = (periodo: Periodo, conPeques: boolean) => {
  const p = PLANES_TIENDA[periodo];
  return conPeques ? p.conPeques : p.solo;
};

// En Google Play cada plan básico es un producto «suscripcion:plan» (yococino_premium:yococinopremiummes).
// En el App Store cada plan es su propio producto con el mismo nombre (yococinopremiummes), en un grupo.
async function productoDe(plan: string): Promise<PurchasesStoreProduct | null> {
  const productos = await Purchases.getProducts(Platform.OS === 'ios' ? [plan] : [SUSCRIPCION], PRODUCT_CATEGORY.SUBSCRIPTION);
  return productos.find((p) => p.identifier === `${SUSCRIPCION}:${plan}` || p.identifier === plan) ?? null;
}

// Compra (o cambio de plan: por ejemplo, añadir Peques a quien ya tiene Premium).
export async function comprar(periodo: Periodo, conPeques: boolean, planActual?: string | null): Promise<ResultadoCompra> {
  if (!configurado) return 'no_disponible';
  try {
    const producto = await productoDe(idPlan(periodo, conPeques));
    if (!producto) return 'no_disponible';
    const anterior = planActual?.split(':')[0] === SUSCRIPCION ? planActual : null;
    const cambio = Platform.OS === 'android' && anterior && anterior !== producto.identifier ? { oldProductIdentifier: anterior } : null;
    const { customerInfo } = await Purchases.purchaseStoreProduct(producto, cambio);
    return customerInfo.entitlements.active.premium ? 'ok' : 'error';
  } catch (e) {
    if ((e as { userCancelled?: boolean })?.userCancelled) return 'cancelada';
    return 'error';
  }
}

// Recupera una suscripción comprada antes (otro móvil, reinstalación). true = tiene premium.
export async function restaurarCompras(): Promise<boolean> {
  if (!configurado) return false;
  try {
    const info = await Purchases.restorePurchases();
    return !!info.entitlements.active.premium;
  } catch {
    return false;
  }
}

// Abre la pantalla de la tienda para cambiar o cancelar la suscripción.
export async function gestionarSuscripcion() {
  try {
    await Purchases.showManageSubscriptions();
  } catch {
    // nada
  }
}
