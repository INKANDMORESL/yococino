// Colores, tamaños y espacios de Yococino.
// Misma estética que la web Mi Dieta: crema claro, verde oliva y limón.

export const colors = {
  bg: '#FBFAF6',
  surface: '#FFFFFF',
  ink: '#1D2A23',
  ink2: '#4A564F',
  muted: '#7C857F',
  line: '#ECE9E0',
  olive: '#4D6B3C',
  oliveInk: '#3C5530',
  leaf: '#E6EDDC',
  leafSoft: '#F2F5EC',
  lemon: '#EFC94C',
  lemonSoft: '#FBF1CC',
  sea: '#3F7C8A',
  seaSoft: '#E3EFF1',
  rose: '#C2614F',
  roseSoft: '#F6E5E1',
};

export const radius = { sm: 12, md: 16, lg: 22, xl: 28, pill: 999 };

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const type = {
  display: { fontSize: 32, fontWeight: '700' as const, letterSpacing: -0.6, color: colors.ink },
  title: { fontSize: 24, fontWeight: '700' as const, letterSpacing: -0.3, color: colors.ink },
  heading: { fontSize: 18, fontWeight: '600' as const, color: colors.ink },
  body: { fontSize: 16, lineHeight: 23, color: colors.ink2 },
  small: { fontSize: 14, lineHeight: 20, color: colors.muted },
  label: { fontSize: 14, fontWeight: '600' as const, color: colors.ink2 },
};

export const shadow = {
  shadowColor: '#1D2A23',
  shadowOpacity: 0.07,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 6 },
  elevation: 2,
};
