// Estado de la encuesta compartido entre pantallas.
// Por ahora vive en memoria; en la fase 2 se guardará en Supabase.
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { encuestaVacia, type Encuesta } from './modelo';

interface EncuestaStore {
  encuesta: Encuesta;
  cambiar: (parcial: Partial<Encuesta>) => void;
  reiniciar: () => void;
}

const Ctx = createContext<EncuestaStore | null>(null);

export function EncuestaProvider({ children }: { children: ReactNode }) {
  const [encuesta, setEncuesta] = useState<Encuesta>(encuestaVacia);
  const value = useMemo<EncuestaStore>(
    () => ({
      encuesta,
      cambiar: (parcial) => setEncuesta((prev) => ({ ...prev, ...parcial })),
      reiniciar: () => setEncuesta(encuestaVacia),
    }),
    [encuesta],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useEncuesta(): EncuestaStore {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useEncuesta debe usarse dentro de EncuestaProvider');
  return ctx;
}
