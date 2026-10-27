// Al volver a tocar la pestaña en la que ya estás, la pantalla sube arriba del todo (como en Instagram).
// La barra de abajo avisa con avisarPestanaRepetida(); solo sube la pantalla que está a la vista.
import { useNavigation } from 'expo-router';
import { useEffect, useRef, type ComponentRef } from 'react';
import type { ScrollView } from 'react-native';

const oyentes = new Set<() => void>();

export function avisarPestanaRepetida() {
  oyentes.forEach((o) => o());
}

export function useSubirAlTocarPestana() {
  const ref = useRef<ComponentRef<typeof ScrollView>>(null);
  const navegacion = useNavigation();
  useEffect(() => {
    const oyente = () => {
      if (navegacion.isFocused()) ref.current?.scrollTo({ y: 0, animated: true });
    };
    oyentes.add(oyente);
    return () => {
      oyentes.delete(oyente);
    };
  }, [navegacion]);
  return ref;
}
