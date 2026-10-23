// Enlaces a las páginas legales de yococino.app (privacidad, condiciones y aviso legal).
import { Linking, Platform, StyleSheet, Text, View } from 'react-native';
import { colors, space, type } from '../../theme';

const WEB = 'https://yococino.app';
export const PAGINAS = {
  privacidad: { url: `${WEB}/privacidad.html`, texto: 'Política de privacidad' },
  condiciones: { url: `${WEB}/condiciones.html`, texto: 'Condiciones de uso' },
  aviso: { url: `${WEB}/aviso-legal.html`, texto: 'Aviso legal' },
} as const;
export type PaginaLegal = keyof typeof PAGINAS;

export function abrirLegal(pagina: PaginaLegal) {
  const { url } = PAGINAS[pagina];
  // En la web se abre en otra pestaña, para no perder lo que se está rellenando.
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener');
    return;
  }
  Linking.openURL(url).catch(() => {});
}

// Texto enlazable para usar dentro de otro <Text> (por ejemplo, en una casilla).
export function EnlaceLegal({ pagina, texto }: { pagina: PaginaLegal; texto?: string }) {
  return (
    <Text
      accessibilityRole="link"
      style={s.enlace}
      onPress={(e) => {
        e?.stopPropagation?.();
        abrirLegal(pagina);
      }}
    >
      {texto ?? PAGINAS[pagina].texto.toLowerCase()}
    </Text>
  );
}

// Información básica de protección de datos (primera capa), para mostrar al crear la cuenta.
export function InfoProteccionDatos() {
  return (
    <View style={s.caja}>
      <Text style={s.titulo}>Información básica sobre protección de datos</Text>
      <Text style={s.texto}>
        <Text style={s.negrita}>Responsable:</Text> INKANDMORE SL (Yococino).{'\n'}
        <Text style={s.negrita}>Finalidad:</Text> crear tu cuenta, preparar tu menú y atender tus mensajes.{'\n'}
        <Text style={s.negrita}>Legitimación:</Text> tu consentimiento y las condiciones de uso que aceptas.{'\n'}
        <Text style={s.negrita}>Destinatarios:</Text> no vendemos tus datos. Solo los tratan los proveedores que hacen funcionar la app, con servidores en la UE.{'\n'}
        <Text style={s.negrita}>Derechos:</Text> acceder, corregir, borrar tus datos y retirar tu permiso cuando quieras, desde Perfil o en info@yococino.app.{'\n'}
        Más información en la <EnlaceLegal pagina="privacidad" />.
      </Text>
    </View>
  );
}

// Fila de enlaces: Privacidad · Condiciones · Aviso legal.
export function EnlacesLegales() {
  return (
    <View style={s.fila}>
      <Text style={s.pequeno} accessibilityRole="link" onPress={() => abrirLegal('privacidad')}>
        Privacidad
      </Text>
      <Text style={s.punto}>·</Text>
      <Text style={s.pequeno} accessibilityRole="link" onPress={() => abrirLegal('condiciones')}>
        Condiciones
      </Text>
      <Text style={s.punto}>·</Text>
      <Text style={s.pequeno} accessibilityRole="link" onPress={() => abrirLegal('aviso')}>
        Aviso legal
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  enlace: { color: colors.olive, fontWeight: '700', textDecorationLine: 'underline' },
  caja: { backgroundColor: colors.surface, borderRadius: 16, padding: space.lg, gap: space.sm, borderWidth: 1, borderColor: colors.line },
  titulo: { fontSize: 14, fontWeight: '700', color: colors.ink },
  texto: { ...type.small, lineHeight: 20 },
  negrita: { fontWeight: '700', color: colors.ink2 },
  fila: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
  pequeno: { fontSize: 13, fontWeight: '600', color: colors.olive, paddingVertical: space.xs },
  punto: { fontSize: 13, color: colors.muted },
});
