// Utilidades del vídeo original (comunes a móvil y web).
export const redDe = (embed: string) => (embed.includes('tiktok') ? 'TikTok' : embed.includes('instagram') ? 'Instagram' : 'YouTube');
// Altura del reproductor: los de TikTok e Instagram son verticales.
export const alturaVideo = (red: string) => (red === 'YouTube' ? 220 : red === 'Instagram' ? 620 : 740);
