// Productos de la tienda (Google Play; App Store cuando esté). Una sola suscripción con cuatro planes:
// Peques no se vende suelto, va siempre con Premium («Premium + Peques»), así es imposible tener uno sin el otro
// y al cancelar se cancela todo junto. Para la persona se enseña como «Peques +0,99 €/mes».
export const SUSCRIPCION = 'yococino_premium';

export type Periodo = 'anual' | 'mensual';

export const PLANES_TIENDA: Record<Periodo, { solo: string; conPeques: string; precio: number; precioConPeques: number }> = {
  mensual: { solo: 'yococinopremiummes', conPeques: 'yococinopequesmes', precio: 5.99, precioConPeques: 6.98 },
  anual: { solo: 'yococinopremiumyear', conPeques: 'yococinopequesyear', precio: 39.99, precioConPeques: 49.98 },
};

export const euros = (n: number) => `${n.toFixed(2).replace('.', ',')} €`;
