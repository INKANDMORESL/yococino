// Añadir una receta a un día y una comida concretos del menú (sustituye lo que hubiera).
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Aparecer, Aviso, Boton } from '../../components';
import { colors, radius, space, type } from '../../theme';
import { ErrorMenu, asignarReceta, cargarComidas } from './api';
import { fechaLarga, hoyISO, nombreDia, sumarDias } from './fechas';
import { TIPOS, type Comida, type TipoComida } from './tipos';

export function AsignarDia({ recetaId, tipoReceta, listo }: { recetaId: number; tipoReceta: string; listo?: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const [comidas, setComidas] = useState<Comida[] | null>(null);
  const [fecha, setFecha] = useState<string | null>(null);
  const [tipo, setTipo] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<string | null>(null);

  const abrir = async () => {
    setAbierto(true);
    setHecho(null);
    if (comidas) return;
    try {
      const hoy = hoyISO();
      setComidas(await cargarComidas(hoy, sumarDias(hoy, 29)));
    } catch (e) {
      setError(e instanceof ErrorMenu ? e.message : 'No hemos podido cargar tu menú.');
    }
  };

  const dias = comidas ? [...new Set(comidas.map((c) => c.fecha))] : [];
  const delDia = fecha && comidas ? comidas.filter((c) => c.fecha === fecha) : [];

  const elegirDia = (f: string) => {
    setFecha(f);
    const delNuevo = (comidas ?? []).filter((c) => c.fecha === f);
    setTipo(delNuevo.some((c) => c.tipo_comida === tipoReceta) ? tipoReceta : null);
  };

  const guardar = async () => {
    if (!fecha || !tipo) return setError('Elige el día y la comida.');
    setError(null);
    setGuardando(true);
    try {
      await asignarReceta(recetaId, fecha, tipo);
      setHecho(`Añadida: ${fechaLarga(fecha)}, ${(TIPOS[tipo as TipoComida] ?? TIPOS.otro).texto.toLowerCase()}.`);
      setAbierto(false);
      setComidas(null);
      setFecha(null);
      setTipo(null);
      listo?.();
    } catch (e) {
      setError(e instanceof ErrorMenu ? e.message : 'No hemos podido añadirla a tu menú.');
    } finally {
      setGuardando(false);
    }
  };

  if (!abierto) {
    return (
      <View style={{ gap: space.sm }}>
        <Boton texto="📅 Añadir a un día de mi menú" variante="linea" onPress={abrir} />
        {hecho ? <Aviso tono="hoja" texto={hecho} /> : null}
      </View>
    );
  }

  return (
    <Aparecer style={s.caja}>
      <Text style={type.heading}>¿Qué día la quieres?</Text>
      {!comidas && !error ? <ActivityIndicator color={colors.olive} /> : null}
      {comidas ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
          {dias.map((d) => (
            <Pressable key={d} onPress={() => elegirDia(d)} accessibilityRole="button" accessibilityState={{ selected: fecha === d }} style={[s.dia, fecha === d && s.elegido]}>
              <Text style={[s.diaTexto, fecha === d && { color: '#fff' }]}>{nombreDia(d)}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      {fecha ? (
        <View style={{ gap: space.sm }}>
          <Text style={type.label}>¿En qué comida? Sustituye a la que haya.</Text>
          {delDia.map((c) => {
            const t = TIPOS[c.tipo_comida] ?? TIPOS.otro;
            const activa = tipo === c.tipo_comida;
            return (
              <Pressable
                key={c.id}
                onPress={() => setTipo(c.tipo_comida)}
                accessibilityRole="radio"
                accessibilityState={{ checked: activa }}
                style={[s.toma, activa && s.tomaElegida]}
              >
                <Text style={{ fontSize: 20 }}>{t.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.tomaTipo}>{t.texto}</Text>
                  <Text style={type.small} numberOfLines={1}>
                    Ahora: {c.receta?.nombre ?? '—'}
                  </Text>
                </View>
                <View style={[s.radio, activa && s.radioActivo]} />
              </Pressable>
            );
          })}
        </View>
      ) : null}
      {error ? <Aviso tono="rosa" texto={error} /> : null}
      <Boton texto="Poner en mi menú" cargando={guardando} onPress={guardar} />
      <Pressable onPress={() => setAbierto(false)} accessibilityRole="button" style={{ alignSelf: 'center', padding: space.sm }}>
        <Text style={{ color: colors.muted, fontWeight: '700' }}>Cancelar</Text>
      </Pressable>
    </Aparecer>
  );
}

const s = StyleSheet.create({
  caja: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg, gap: space.md, borderWidth: 1.5, borderColor: colors.line },
  dia: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.surface },
  elegido: { backgroundColor: colors.ink, borderColor: colors.ink },
  diaTexto: { fontSize: 15, fontWeight: '600', color: colors.ink2 },
  toma: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.line },
  tomaElegida: { borderColor: colors.olive, backgroundColor: colors.leafSoft },
  tomaTipo: { fontSize: 15, fontWeight: '700', color: colors.ink },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#D5D2C6' },
  radioActivo: { borderColor: colors.olive, backgroundColor: colors.olive },
});
