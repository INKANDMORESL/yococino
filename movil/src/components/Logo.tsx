import { Image } from 'react-native';

// Logotipo de Yococino (la olla con hojas y el nombre), a partir del logo oficial.
export function Logo({ tamano = 120 }: { tamano?: number }) {
  return (
    <Image
      source={require('../../assets/logo.png')}
      style={{ width: tamano, height: tamano * (514 / 512) }}
      resizeMode="contain"
      accessibilityRole="image"
      accessibilityLabel="Logotipo de Yococino"
    />
  );
}
