// Compartir una receta (WhatsApp, mensajes, email…) con sus ingredientes y pasos, en texto.
import { Platform, Share } from 'react-native';
import { cantidadTexto } from './cantidades';
import type { Receta } from './tipos';

export function textoReceta(r: Receta): string {
  const ingredientes = (r.ingredientes ?? [])
    .map((i) => {
      const c = cantidadTexto(i.cantidad, i.unidad);
      return `• ${i.nombre}${c ? ` (${c})` : ''}`;
    })
    .join('\n');
  const pasos = (r.pasos ?? []).map((p, n) => `${n + 1}. ${p}`).join('\n');
  return [
    `🍽️ ${r.nombre}`,
    r.descripcion ?? '',
    r.minutos ? `⏱ ${r.minutos} min · 1 ración` : '',
    ingredientes ? `\nIngredientes:\n${ingredientes}` : '',
    pasos ? `\nPreparación:\n${pasos}` : '',
    '\nReceta de Yococino, tu menú y tus recetas hechos para ti 👉 https://yococino.app',
  ]
    .filter(Boolean)
    .join('\n');
}

// Devuelve 'copiada' si no hay menú de compartir (por ejemplo, en algunos navegadores) y se ha copiado el texto.
export async function compartirReceta(r: Receta): Promise<'compartida' | 'copiada' | 'cancelada'> {
  const texto = textoReceta(r);
  if (Platform.OS === 'web') {
    const nav = (globalThis as { navigator?: Navigator }).navigator;
    if (nav?.share) {
      try {
        await nav.share({ title: r.nombre, text: texto });
        return 'compartida';
      } catch {
        return 'cancelada';
      }
    }
    await nav?.clipboard?.writeText(texto);
    return 'copiada';
  }
  const res = await Share.share({ message: texto, title: r.nombre });
  return res.action === Share.dismissedAction ? 'cancelada' : 'compartida';
}
