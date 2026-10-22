// Tarjeta grande de la próxima comida (como en Mi Dieta): foto, cuándo toca, plato y acciones.
import { router } from 'expo-router';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Boton } from '../../components';
import { colors, radius, shadow, space } from '../../theme';
import { hoyISO, sumarDias } from './fechas';
import { TIPOS, type Comida } from './tipos';

// Hora orientativa de cada toma, en minutos desde medianoche.
export const HORA_TOMA: Record<string, number> = { desayuno: 8 * 60, media_manana: 11 * 60, almuerzo: 14 * 60, merienda: 17 * 60 + 30, cena: 21 * 60 };
const horaTexto = (min: number) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`;

// Igual que en Mi Dieta: la primera comida de hoy sin hacer que aún esté a tiempo; si no, la pendiente; si no, la primera de mañana.
export function proximaComida(comidas: Comida[]): { comida: Comida; cuando: string } | null {
  const ahora = new Date();
  const minutos = ahora.getHours() * 60 + ahora.getMinutes();
  const hoy = hoyISO();
  const deHoy = comidas.filter((c) => c.fecha === hoy).sort((a, b) => a.orden - b.orden);
  for (const c of deHoy) {
    if (c.hecha) continue;
    const t = HORA_TOMA[c.tipo_comida] ?? 13 * 60;
    if (t + 90 > minutos) return { comida: c, cuando: t <= minutos ? 'Ahora toca' : `Próxima comida, a las ${horaTexto(t)}` };
  }
  const pendiente = deHoy.find((c) => !c.hecha);
  if (pendiente && minutos < 23 * 60) return { comida: pendiente, cuando: 'Pendiente de marcar' };
  const manana = comidas.filter((c) => c.fecha === sumarDias(hoy, 1)).sort((a, b) => a.orden - b.orden);
  return manana.length ? { comida: manana[0], cuando: 'Mañana' } : null;
}

export function ProximaComida({ comida, cuando, onMarcar }: { comida: Comida; cuando: string; onMarcar: () => void }) {
  const t = TIPOS[comida.tipo_comida] ?? TIPOS.otro;
  const abrir = () => {
    if (comida.receta_id) router.push({ pathname: '/receta/[id]', params: { id: String(comida.receta_id), comida: String(comida.id) } });
  };
  return (
    <View>
      <Text style={s.cuando}>{cuando}</Text>
      <View style={s.tarjeta}>
        <View style={[s.foto, { backgroundColor: t.fondo }]}>
          {comida.receta?.imagen ? (
            <Image source={{ uri: comida.receta.imagen }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityLabel={`Foto de ${comida.receta.nombre}`} />
          ) : (
            <Text style={{ fontSize: 72 }}>{t.emoji}</Text>
          )}
        </View>
        <View style={s.cuerpo}>
          <Text style={s.tipo}>
            {t.emoji} {t.texto}
            {comida.receta?.minutos ? <Text style={{ color: colors.muted }}> · {comida.receta.minutos} min</Text> : null}
          </Text>
          <Text style={s.nombre}>{comida.receta?.nombre ?? 'Plato sin receta'}</Text>
          <View style={s.botones}>
            <View style={{ flex: 1 }}>
              <Boton texto="Ver receta" onPress={abrir} />
            </View>
            <Boton texto={comida.hecha ? '✓ Hecha' : 'Hecha'} variante="suave" onPress={onMarcar} />
          </View>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  cuando: { fontSize: 20, fontWeight: '700', color: colors.ink, letterSpacing: -0.2, marginBottom: space.md },
  tarjeta: { borderRadius: radius.xl, overflow: 'hidden', backgroundColor: colors.surface, ...shadow },
  foto: { aspectRatio: 4 / 3, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  cuerpo: { padding: space.lg, paddingTop: space.md },
  tipo: { fontSize: 14, fontWeight: '700', color: colors.olive },
  nombre: { fontSize: 24, fontWeight: '700', color: colors.ink, letterSpacing: -0.3, lineHeight: 28, marginTop: 4, marginBottom: space.md },
  botones: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
});
