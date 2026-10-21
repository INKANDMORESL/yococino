import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius, shadow, space } from '../theme';

export function Tarjeta({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg, ...shadow }, style]}>{children}</View>;
}
