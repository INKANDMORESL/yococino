// Sesión del usuario: registro, entrada con email o Google, y salida.
import type { Session } from '@supabase/supabase-js';
import { vaciarCache } from './cache';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { guardarEncuestaPendiente } from './perfil';
import { supabase, supabaseConfigurado } from './supabase';
import { cerrarPagos, iniciarPagos } from './pagos';
import { guardarRegion } from './region';

WebBrowser.maybeCompleteAuthSession();

interface Auth {
  sesion: Session | null;
  cargando: boolean;
  registrarConEmail: (email: string, contrasena: string) => Promise<{ necesitaConfirmar: boolean }>;
  entrarConEmail: (email: string, contrasena: string) => Promise<void>;
  entrarConGoogle: () => Promise<void>;
  salir: () => Promise<void>;
  // Recuperar contraseña: se envía un enlace al email; al volver, `recuperando` pide la nueva.
  recuperarContrasena: (email: string) => Promise<void>;
  cambiarContrasena: (nueva: string) => Promise<void>;
  recuperando: boolean;
}

const Ctx = createContext<Auth | null>(null);

const urlVuelta = () => Linking.createURL('auth');

// Traduce los errores de Supabase a mensajes claros.
export function mensajeError(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  if (!supabaseConfigurado) return 'El servidor aún no está configurado. Faltan las variables de Supabase en GitHub.';
  if (/invalid login credentials/i.test(m)) return 'El email o la contraseña no son correctos.';
  if (/already registered|already been registered/i.test(m)) return 'Ya hay una cuenta con este email. Prueba a entrar.';
  if (/email not confirmed/i.test(m)) return 'Antes de entrar, confirma tu email desde el correo que te hemos enviado.';
  if (/password/i.test(m) && /(6|8|short|weak)/i.test(m)) return 'La contraseña es demasiado corta o sencilla. Usa al menos 8 caracteres.';
  if (/provider is not enabled|unsupported provider/i.test(m)) return 'El acceso con Google aún no está activado. De momento, usa tu email.';
  if (/network|fetch/i.test(m)) return 'No hay conexión. Revisa tu Internet e inténtalo de nuevo.';
  if (/rate limit/i.test(m)) return 'Demasiados intentos seguidos. Espera un minuto y vuelve a probar.';
  return 'Algo no ha ido bien. Inténtalo de nuevo en un momento.';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<Session | null>(null);
  const [cargando, setCargando] = useState(true);
  const [recuperando, setRecuperando] = useState(false);

  useEffect(() => {
    if (!supabaseConfigurado) {
      setCargando(false);
      return;
    }
    supabase.auth
      .getSession()
      .then(({ data }) => {
        setSesion(data.session);
        if (data.session) {
          iniciarPagos(data.session.user.id);
          guardarRegion(data.session.user.id);
        }
      })
      .finally(() => setCargando(false));
    const { data } = supabase.auth.onAuthStateChange((evento, nueva) => {
      setSesion(nueva);
      if (evento === 'PASSWORD_RECOVERY') setRecuperando(true);
      // Al entrar por primera vez, guardar la encuesta que se rellenó antes de registrarse.
      if (nueva) guardarEncuestaPendiente(nueva.user.id).catch(() => {});
      if (nueva) {
        iniciarPagos(nueva.user.id);
        guardarRegion(nueva.user.id);
      }
      if (evento === 'SIGNED_OUT') cerrarPagos();
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const value = useMemo<Auth>(
    () => ({
      sesion,
      cargando,
      async registrarConEmail(email, contrasena) {
        const { data, error } = await supabase.auth.signUp({ email, password: contrasena, options: { emailRedirectTo: urlVuelta() } });
        if (error) throw error;
        // Supabase no devuelve error si el email ya existe; lo detecta por las identidades vacías.
        if (data.user && data.user.identities?.length === 0) throw new Error('already registered');
        return { necesitaConfirmar: !data.session };
      },
      async entrarConEmail(email, contrasena) {
        const { error } = await supabase.auth.signInWithPassword({ email, password: contrasena });
        if (error) throw error;
      },
      async entrarConGoogle() {
        const redirectTo = urlVuelta();
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo, skipBrowserRedirect: Platform.OS !== 'web' },
        });
        if (error) throw error;
        if (Platform.OS === 'web') return; // el navegador se redirige solo y vuelve a /auth
        const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
        if (res.type !== 'success') return; // cancelado por el usuario
        const codigo = new URL(res.url).searchParams.get('code');
        if (!codigo) throw new Error('Sin código de acceso');
        const { error: e2 } = await supabase.auth.exchangeCodeForSession(codigo);
        if (e2) throw e2;
      },
      recuperando,
      async recuperarContrasena(email) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: urlVuelta() });
        if (error) throw error;
      },
      async cambiarContrasena(nueva) {
        const { error } = await supabase.auth.updateUser({ password: nueva });
        if (error) throw error;
        setRecuperando(false);
      },
      async salir() {
        vaciarCache();
        await supabase.auth.signOut();
      },
    }),
    [sesion, cargando, recuperando],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): Auth {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
