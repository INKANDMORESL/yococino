// Al volver a tocar la pestaña en la que ya estás, la pantalla sube arriba del todo (como en Instagram).
import { useNavigation } from 'expo-router';
import { useEffect, useRef, type ComponentRef } from 'react';
import type { ScrollView } from 'react-native';

type ConPestana = { addListener: (evento: 'tabPress', accion: () => void) => () => void; isFocused: () => boolean };

export function useSubirAlTocarPestana() {
  const ref = useRef<ComponentRef<typeof ScrollView>>(null);
  const navegacion = useNavigation() as unknown as ConPestana;
  useEffect(() => {
    // Las pantallas de pestaña reciben «tabPress» al tocar su pestaña; si ya estaba abierta, se sube.
    return navegacion.addListener('tabPress', () => {
      if (navegacion.isFocused()) ref.current?.scrollTo({ y: 0, animated: true });
    });
  }, [navegacion]);
  return ref;
}
