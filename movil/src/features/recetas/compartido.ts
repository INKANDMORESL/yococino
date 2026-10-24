// Enlace recibido al compartir desde otra app (TikTok, Instagram…) con «Compartir → Yococino». Solo en el móvil.
import { useIncomingShare } from 'expo-sharing';

export function useEnlaceCompartido(): { valores: string[]; limpiar: () => void } {
  const { sharedPayloads, clearSharedPayloads } = useIncomingShare();
  return {
    valores: (sharedPayloads ?? []).map((p) => String(p.value ?? '')),
    limpiar: () => {
      try {
        clearSharedPayloads();
      } catch {
        // Nada que limpiar.
      }
    },
  };
}
