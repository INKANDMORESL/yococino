// «Continuar con Apple» (solo en iPhone). Apple obliga a ofrecerlo si la app deja entrar con Google.
// Usa el botón oficial de Apple y entra en Supabase con el token que da el iPhone (sin pasar por el navegador).
import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { supabase } from '../../lib/supabase';
import { radius, space } from '../../theme';

async function entrarConApple() {
  const cred = await AppleAuthentication.signInAsync({
    requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
  });
  if (!cred.identityToken) throw new Error('Apple no ha devuelto el acceso.');
  const { error } = await supabase.auth.signInWithIdToken({ provider: 'apple', token: cred.identityToken });
  if (error) throw error;
  // Apple solo da el nombre la primera vez: se guarda para saludar en Inicio.
  const nombre = [cred.fullName?.givenName, cred.fullName?.familyName].filter(Boolean).join(' ');
  if (nombre) await supabase.auth.updateUser({ data: { full_name: nombre } }).catch(() => {});
}

// antes: comprobaciones previas (en el registro, aceptar las condiciones y guardar la encuesta); false = no seguir.
export function BotonApple({ onError, desactivado, alEmpezar, alTerminar, antes }: { onError: (e: unknown) => void; desactivado?: boolean; alEmpezar?: () => void; alTerminar?: () => void; antes?: () => Promise<boolean> }) {
  const [disponible, setDisponible] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    AppleAuthentication.isAvailableAsync()
      .then(setDisponible)
      .catch(() => setDisponible(false));
  }, []);
  if (!disponible) return null;
  return (
    <AppleAuthentication.AppleAuthenticationButton
      buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
      cornerRadius={radius.lg}
      style={{ height: 54, width: '100%', marginTop: space.md, opacity: desactivado ? 0.5 : 1 }}
      onPress={async () => {
        if (desactivado) return;
        alEmpezar?.();
        try {
          if (antes && !(await antes())) return;
          await entrarConApple();
        } catch (e) {
          // Si la persona cierra la ventana de Apple, no es un error.
          if ((e as { code?: string })?.code !== 'ERR_REQUEST_CANCELED') onError(e);
        } finally {
          alTerminar?.();
        }
      }}
    />
  );
}
