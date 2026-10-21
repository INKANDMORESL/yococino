export const emailValido = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());

export function errorContrasena(c: string): string | null {
  if (c.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
  if (!/[A-Za-zÀ-ÿ]/.test(c) || !/\d/.test(c)) return 'Usa letras y al menos un número en la contraseña.';
  return null;
}
