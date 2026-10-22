// Tira horizontal con los 30 días del menú.
import { useEffect, useRef, type ComponentRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, space } from '../../theme';
import { diaCorto, hoyISO, numeroDia } from './fechas';

const ANCHO = 54;

export function SelectorDias({
  dias,
  elegido,
  onElegir,
  listos,
  completos,
}: {
  dias: string[];
  elegido: string;
  onElegir: (d: string) => void;
  listos: Set<string>;
  completos: Set<string>;
}) {
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const hoy = hoyISO();

  useEffect(() => {
    const i = dias.indexOf(elegido);
    if (i > 2) scroll.current?.scrollTo({ x: (i - 2) * (ANCHO + space.sm), animated: true });
  }, [elegido, dias]);

  return (
    <ScrollView ref={scroll} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.fila}>
      {dias.map((d) => {
        const activo = d === elegido;
        const listo = listos.has(d);
        return (
          <Pressable
            key={d}
            onPress={() => onElegir(d)}
            accessibilityRole="button"
            accessibilityState={{ selected: activo }}
            accessibilityLabel={`Día ${numeroDia(d)}`}
            style={[s.dia, activo && s.activo, !listo && s.pendiente]}
          >
            <Text style={[s.semana, activo && s.textoActivo]}>{d === hoy ? 'Hoy' : diaCorto(d)}</Text>
            <Text style={[s.numero, activo && s.textoActivo]}>{numeroDia(d)}</Text>
            <View style={[s.punto, completos.has(d) && s.puntoHecho, activo && completos.has(d) && { backgroundColor: colors.lemon }]} />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  fila: { gap: space.sm, paddingHorizontal: space.xl, paddingVertical: space.xs },
  dia: {
    width: ANCHO,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    gap: 2,
    borderWidth: 1.5,
    borderColor: colors.line,
  },
  activo: { backgroundColor: colors.ink, borderColor: colors.ink },
  pendiente: { opacity: 0.45 },
  semana: { fontSize: 12, fontWeight: '700', color: colors.muted },
  numero: { fontSize: 19, fontWeight: '700', color: colors.ink },
  textoActivo: { color: '#fff' },
  punto: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'transparent', marginTop: 2 },
  puntoHecho: { backgroundColor: colors.olive },
});
