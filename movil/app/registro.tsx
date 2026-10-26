// Registro, justo después de la encuesta: con Google o con email y contraseña.
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Aparecer, Aviso, Boton, Campo, Casilla, Saltar, Separador, useSacudida } from '../src/components';
import { Cabecera } from '../src/features/cuenta/Cabecera';
import { EnlaceLegal, EnlacesLegales, InfoProteccionDatos } from '../src/features/cuenta/Legal';
import { emailValido, errorContrasena } from '../src/features/cuenta/validar';
import { evaluar } from '../src/features/encuesta/modelo';
import { useEncuesta } from '../src/features/encuesta/store';
import { mensajeError, useAuth } from '../src/lib/auth';
import { dejarEncuestaPendiente } from '../src/lib/perfil';
import { colors, space, type } from '../src/theme';

export default function Registro() {
  const { sesion, registrarConEmail, entrarConGoogle } = useAuth();
  const { encuesta } = useEncuesta();
  const [email, setEmail] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [ver, setVer] = useState(false);
  const [consentimiento, setConsentimiento] = useState(false);
  const [condiciones, setCondiciones] = useState(false);
  const [promociones, setPromociones] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<'email' | 'google' | null>(null);
  const [enviadoA, setEnviadoA] = useState<string | null>(null);
  const { x, sacudir } = useSacudida();

  if (sesion) return <Redirect href="/inicio" />;
  // Sin encuesta válida no hay registro: vuelve al principio.
  if (evaluar(encuesta).tipo !== 'ok' || !encuesta.objetivo) return <Redirect href="/" />;

  const fallo = (m: string) => {
    setError(m);
    sacudir();
  };

  const comprobarPermisos = (): boolean => {
    if (!consentimiento) {
      fallo('Para preparar tu menú necesitamos tu permiso para usar tus datos de salud.');
      return false;
    }
    if (!condiciones) {
      fallo('Acepta las condiciones de uso y la política de privacidad para continuar.');
      return false;
    }
    return true;
  };

  const conGoogle = async () => {
    setError(null);
    if (!comprobarPermisos()) return;
    setOcupado('google');
    try {
      await dejarEncuestaPendiente(encuesta, consentimiento, promociones);
      await entrarConGoogle();
    } catch (e) {
      fallo(mensajeError(e));
    } finally {
      setOcupado(null);
    }
  };

  const conEmail = async () => {
    setError(null);
    if (!emailValido(email)) return fallo('Revisa tu email: parece que falta algo.');
    const errC = errorContrasena(contrasena);
    if (errC) return fallo(errC);
    if (!comprobarPermisos()) return;
    setOcupado('email');
    try {
      await dejarEncuestaPendiente(encuesta, consentimiento, promociones);
      const { necesitaConfirmar } = await registrarConEmail(email.trim(), contrasena);
      if (necesitaConfirmar) setEnviadoA(email.trim());
    } catch (e) {
      fallo(mensajeError(e));
    } finally {
      setOcupado(null);
    }
  };

  if (enviadoA) {
    return (
      <SafeAreaView style={s.pantalla}>
        <View style={s.centro}>
          <Saltar>
            <Text style={{ fontSize: 56 }}>📬</Text>
          </Saltar>
          <Aparecer retraso={150} style={{ gap: space.sm }}>
            <Text style={[type.title, s.centrado]}>Revisa tu correo</Text>
            <Text style={[type.body, s.centrado]}>
              Te hemos enviado un enlace a {enviadoA}. Púlsalo para confirmar tu cuenta y tu menú empezará a prepararse.
            </Text>
            <Text style={[type.small, s.centrado]}>¿No lo ves? Mira en la carpeta de correo no deseado.</Text>
          </Aparecer>
        </View>
        <View style={s.pieSuelto}>
          <Boton texto="Ya lo he confirmado, entrar" onPress={() => router.replace('/entrar')} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.pantalla}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView contentContainerStyle={s.lista} keyboardShouldPersistTaps="handled">
          <Cabecera titulo="Crea tu cuenta" subtitulo="Así guardamos tu plan y lo tienes en cualquier móvil." />

          <Aparecer retraso={100}>
            <Boton texto="Continuar con Google" variante="google" icono="G" cargando={ocupado === 'google'} desactivado={ocupado === 'email'} onPress={conGoogle} />
          </Aparecer>

          <Aparecer retraso={160}>
            <Separador texto="o con tu email" />
          </Aparecer>

          <Aparecer retraso={220} style={{ gap: space.lg }}>
            <Campo
              etiqueta="Email"
              grande={false}
              value={email}
              onChangeText={setEmail}
              placeholder="tu@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
            />
            <View>
              <Campo
                etiqueta="Contraseña"
                grande={false}
                value={contrasena}
                onChangeText={setContrasena}
                placeholder="Mínimo 8 caracteres, con un número"
                secureTextEntry={!ver}
                autoCapitalize="none"
                autoComplete="new-password"
                textContentType="newPassword"
              />
              <Pressable onPress={() => setVer(!ver)} accessibilityRole="button" style={s.ver}>
                <Text style={s.verTexto}>{ver ? 'Ocultar contraseña' : 'Mostrar contraseña'}</Text>
              </Pressable>
            </View>
          </Aparecer>

          <Aparecer retraso={280} style={{ gap: space.lg }}>
            <Casilla marcada={consentimiento} onPress={() => setConsentimiento(!consentimiento)}>
              Doy mi permiso para que Yococino use mis datos de salud (peso, alergias y respuestas de la encuesta) solo para preparar mi menú.
              Puedo retirarlo y borrar mi cuenta cuando quiera.
            </Casilla>
            <Casilla marcada={condiciones} onPress={() => setCondiciones(!condiciones)}>
              Tengo 18 años o más y acepto las <EnlaceLegal pagina="condiciones" /> y la <EnlaceLegal pagina="privacidad" />.
            </Casilla>
            <Casilla marcada={promociones} onPress={() => setPromociones(!promociones)}>
              (Opcional) Quiero recibir por email novedades, recetas y promociones de Yococino. Puedo darme de baja cuando quiera desde Perfil.
            </Casilla>
            <InfoProteccionDatos />
          </Aparecer>

          {error ? <Aviso texto={error} tono="rosa" x={x} /> : null}
        </ScrollView>

        <View style={s.pie}>
          <Boton texto="Crear cuenta" cargando={ocupado === 'email'} desactivado={ocupado === 'google'} onPress={conEmail} />
          <Pressable onPress={() => router.push('/entrar')} accessibilityRole="link" style={s.enlace}>
            <Text style={type.small}>
              ¿Ya tienes cuenta? <Text style={s.enlaceTexto}>Entra</Text>
            </Text>
          </Pressable>
          <EnlacesLegales />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.bg },
  lista: { padding: space.xl, gap: space.xl, paddingBottom: space.xxl },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.xl },
  centrado: { textAlign: 'center' },
  ver: { alignSelf: 'flex-end', paddingVertical: space.sm, paddingHorizontal: space.xs },
  verTexto: { fontSize: 14, fontWeight: '600', color: colors.olive },
  pieSuelto: { paddingHorizontal: space.xl, paddingBottom: space.lg },
  pie: { padding: space.xl, paddingTop: space.md, gap: space.xs, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.bg },
  enlace: { alignSelf: 'center', padding: space.sm },
  enlaceTexto: { color: colors.olive, fontWeight: '700' },
});
