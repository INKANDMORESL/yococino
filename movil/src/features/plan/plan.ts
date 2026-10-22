// Plan de la persona: premium, prueba gratis (7 días) o prueba terminada. Lo decide el servidor.
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { guardarCache, leerCache } from '../../lib/cache';
import { supabase } from '../../lib/supabase';
import { deISO, hoyISO } from '../menu/fechas';

export interface Plan {
  estado: 'premium' | 'prueba' | 'caducada';
  finPrueba: string | null;
}

export async function cargarPlan(): Promise<Plan> {
  const { data } = await supabase.rpc('mi_plan');
  const fila = (Array.isArray(data) ? data[0] : data) as { estado?: Plan['estado']; fin_prueba?: string | null } | null;
  // Si el servidor aún no sabe del plan, la app funciona como siempre.
  return guardarCache('plan', { estado: fila?.estado ?? 'premium', finPrueba: fila?.fin_prueba ?? null });
}

export function usePlan(): Plan | null {
  const [plan, setPlan] = useState<Plan | null>(leerCache<Plan>('plan') ?? null);
  useFocusEffect(
    useCallback(() => {
      cargarPlan()
        .then(setPlan)
        .catch(() => {});
    }, []),
  );
  return plan;
}

// ¿Este día queda fuera de lo que incluye su plan?
export const fueraDelPlan = (plan: Plan | null, fecha: string) => !!plan && plan.estado !== 'premium' && !!plan.finPrueba && fecha > plan.finPrueba;

export function diasRestantes(plan: Plan | null): number {
  if (!plan?.finPrueba) return 0;
  const ms = deISO(plan.finPrueba).getTime() - deISO(hoyISO()).getTime();
  return Math.max(0, Math.round(ms / 86_400_000) + 1);
}
