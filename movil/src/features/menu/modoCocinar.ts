// Modo cocinar: mientras está activo, la pantalla no se apaga (móvil y navegador).
// expo-keep-awake viene incluido con el paquete expo.
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect, useState } from 'react';

const ETIQUETA = 'yococino-modo-cocinar';

export function useModoCocinar(): { activo: boolean; disponible: boolean; alternar: () => void } {
  const [activo, setActivo] = useState(false);
  const [disponible, setDisponible] = useState(true);

  useEffect(() => {
    if (!activo) return;
    let vivo = true;
    activateKeepAwakeAsync(ETIQUETA).catch(() => {
      if (!vivo) return;
      setDisponible(false);
      setActivo(false);
    });
    return () => {
      vivo = false;
      Promise.resolve()
        .then(() => deactivateKeepAwake(ETIQUETA))
        .catch(() => undefined);
    };
  }, [activo]);

  return { activo, disponible, alternar: () => setActivo((a) => !a) };
}
