// Progreso: peso, tendencia semanal hacia el objetivo y medidas corporales, de la persona de la cuenta y de su familia.
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { guardarCache, leerCache } from '../../src/lib/cache';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Aparecer, Aviso, Boton, Campo, Chip, Tarjeta } from '../../src/components';
import { fechaLarga, hoyISO } from '../../src/features/menu/fechas';
import {
  MEDIDAS,
  borrarMedida,
  borrarMiembro,
  cargarMiembros,
  borrarPeso,
  cargarProgreso,
  guardarMedidas,
  guardarPeso,
  type ClaveMedida,
  type Medida,
  type Miembro,
  type PerfilPeso,
  type Peso,
} from '../../src/features/progreso/api';
import { kg, resumen } from '../../src/features/progreso/calculos';
import { NuevoMiembro, SelectorPersona } from '../../src/features/progreso/Familia';
import { Grafica } from '../../src/features/progreso/Grafica';
import { useAuth } from '../../src/lib/auth';
import { colors, radius, space, type } from '../../src/theme';

const numero = (t: string) => {
  const n = parseFloat(t.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

export default function Progreso() {
  const { sesion } = useAuth();
  type Guardado = { pesos: Peso[]; medidas: Medida[]; perfil: PerfilPeso | null; miembros: Miembro[] };
  const previo = leerCache<Guardado>('progreso:yo');
  const [pesos, setPesos] = useState<Peso[]>(previo?.pesos ?? []);
  const [medidas, setMedidas] = useState<Medida[]>(previo?.medidas ?? []);
  const [perfilPropio, setPerfilPropio] = useState<PerfilPeso | null>(previo?.perfil ?? null);
  const [miembros, setMiembros] = useState<Miembro[]>(previo?.miembros ?? []);
  const [persona, setPersona] = useState<number | null>(null);
  const [anadiendo, setAnadiendo] = useState(false);
  const [confirmarQuitar, setConfirmarQuitar] = useState(false);
  const miembro = persona === null ? null : (miembros.find((m) => m.id === persona) ?? null);
  const perfil = persona === null ? perfilPropio : miembro;
  const [nuevoPeso, setNuevoPeso] = useState('');
  const [nota, setNota] = useState('');
  const [nuevasMedidas, setNuevasMedidas] = useState<Partial<Record<ClaveMedida, string>>>({});
  const [verMedidas, setVerMedidas] = useState(false);
  const [rango, setRango] = useState<'1m' | '3m' | 'todo'>('3m');
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const [d, fam] = await Promise.all([cargarProgreso(persona), cargarMiembros()]);
      guardarCache(`progreso:${persona ?? 'yo'}`, { pesos: d.pesos, medidas: d.medidas, perfil: d.perfil, miembros: fam });
      setPesos(d.pesos);
      setMedidas(d.medidas);
      setPerfilPropio(d.perfil);
      setMiembros(fam);
      if (persona !== null && !fam.some((m) => m.id === persona)) setPersona(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No hemos podido cargar tu progreso.');
    }
  }, [persona]);

  const elegirPersona = (id: number | null) => {
    if (id === persona) return;
    setError(null);
    setAviso(null);
    setAnadiendo(false);
    setConfirmarQuitar(false);
    setNuevoPeso('');
    setNota('');
    setNuevasMedidas({});
    const enMemoria = leerCache<{ pesos: Peso[]; medidas: Medida[] }>(`progreso:${id ?? 'yo'}`);
    setPesos(enMemoria?.pesos ?? []);
    setMedidas(enMemoria?.medidas ?? []);
    setPersona(id);
  };

  const quitarPersona = async () => {
    if (persona === null) return;
    try {
      await borrarMiembro(persona);
      setMiembros(miembros.filter((m) => m.id !== persona));
      elegirPersona(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se ha podido borrar.');
    }
  };

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  const quiereBajar = perfil?.objetivo === 'perder';
  const inicial = perfil?.peso_inicial_kg !== null && perfil?.peso_inicial_kg !== undefined ? Number(perfil.peso_inicial_kg) : null;
  const objetivo = quiereBajar && perfil?.peso_objetivo_kg ? Number(perfil.peso_objetivo_kg) : null;
  const r = resumen(pesos, inicial, objetivo, quiereBajar);

  const visibles = useMemo(() => {
    if (rango === 'todo') return pesos;
    const desde = new Date();
    desde.setDate(desde.getDate() - (rango === '1m' ? 31 : 92));
    const d = `${desde.getFullYear()}-${String(desde.getMonth() + 1).padStart(2, '0')}-${String(desde.getDate()).padStart(2, '0')}`;
    return pesos.filter((p) => p.fecha >= d);
  }, [pesos, rango]);

  const anotarPeso = async () => {
    if (!sesion) return;
    setError(null);
    setAviso(null);
    const v = numero(nuevoPeso);
    if (v === null || v < 30 || v > 300) {
      setError(miembro ? 'Escribe el peso en kilos, por ejemplo 94,8.' : 'Escribe tu peso en kilos, por ejemplo 94,8.');
      return;
    }
    setGuardando(true);
    try {
      await guardarPeso(sesion.user.id, persona, hoyISO(), v, nota);
      setNuevoPeso('');
      setNota('');
      await cargar();
      setAviso(miembro ? 'Peso guardado.' : 'Peso guardado. Tus próximos días de menú ya lo tendrán en cuenta.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se ha podido guardar.');
    } finally {
      setGuardando(false);
    }
  };

  const anotarMedidas = async () => {
    if (!sesion) return;
    setError(null);
    const valores: Partial<Record<ClaveMedida, number>> = {};
    for (const m of MEDIDAS) {
      const v = numero(nuevasMedidas[m.clave] ?? '');
      if (v !== null && v > 0 && v < 300) valores[m.clave] = v;
    }
    if (Object.keys(valores).length === 0) {
      setError('Escribe al menos una medida en centímetros.');
      return;
    }
    try {
      await guardarMedidas(sesion.user.id, persona, hoyISO(), valores);
      setNuevasMedidas({});
      await cargar();
      setAviso('Medidas guardadas.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se han podido guardar.');
    }
  };

  const quitarPeso = async (id: number) => {
    try {
      await borrarPeso(id);
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se ha podido borrar.');
    }
  };

  const quitarMedida = async (id: number) => {
    try {
      await borrarMedida(id);
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se ha podido borrar.');
    }
  };

  const filas = [...pesos].map((p, i) => ({ ...p, cambio: i > 0 ? p.peso_kg - pesos[i - 1].peso_kg : null })).reverse();
  const ultimaMedida = medidas[medidas.length - 1];
  const primeraMedida = medidas[0];

  return (
    <SafeAreaView style={s.pantalla} edges={['top']}>
      <ScrollView contentContainerStyle={s.contenido} keyboardShouldPersistTaps="handled">
        <Aparecer>
          <Text style={type.display}>{miembro ? `Progreso de ${miembro.nombre}` : 'Mi progreso'}</Text>
          <Text style={[type.body, { marginTop: 2 }]}>
            {quiereBajar && inicial !== null && objetivo !== null
              ? `De ${kg(inicial, 0)} a ${kg(objetivo, 0)} kg`
              : miembro
                ? 'Su evolución, semana a semana'
                : 'Tu evolución, semana a semana'}
          </Text>
        </Aparecer>

        <Aparecer retraso={30}>
          <SelectorPersona miembros={miembros} persona={persona} elegir={elegirPersona} anadir={() => setAnadiendo(true)} nombrePropio="Yo" />
        </Aparecer>

        {anadiendo ? (
          <NuevoMiembro
            cancelar={() => setAnadiendo(false)}
            listo={(m) => {
              setMiembros([...miembros, m]);
              setAnadiendo(false);
              elegirPersona(m.id);
            }}
          />
        ) : null}

        <Aparecer retraso={60}>
          <Tarjeta style={{ gap: space.md }}>
            <View style={s.fila}>
              <View>
                <Text style={type.small}>{pesos.length ? 'Peso actual' : 'Peso de partida'}</Text>
                <Text style={s.pesoGrande}>
                  {kg(r.actual)} <Text style={s.unidad}>kg</Text>
                </Text>
              </View>
              {r.porcentaje !== null ? (
                <View style={s.pastilla}>
                  <Text style={s.pastillaTexto}>{Math.round(r.porcentaje)}% del objetivo</Text>
                </View>
              ) : null}
            </View>

            {r.porcentaje !== null ? (
              <View>
                <View style={s.barra}>
                  <View style={[s.barraRelleno, { width: `${Math.max(r.porcentaje, 2)}%` as const }]} />
                </View>
                <View style={[s.fila, { marginTop: space.xs }]}>
                  <Text style={type.small}>{kg(inicial, 0)} kg</Text>
                  <Text style={type.small}>{kg(objetivo, 0)} kg</Text>
                </View>
              </View>
            ) : null}

            {quiereBajar ? (
              <View style={s.datos}>
                <View style={s.dato}>
                  <Text style={s.datoValor}>{kg(Math.max(0, r.perdido))} kg</Text>
                  <Text style={s.datoTexto}>perdidos</Text>
                </View>
                <View style={s.dato}>
                  <Text style={s.datoValor}>{kg(r.restante)} kg</Text>
                  <Text style={s.datoTexto}>para tu objetivo</Text>
                </View>
              </View>
            ) : null}
            {r.mensaje ? <Text style={[type.body, { color: colors.oliveInk }]}>{r.mensaje}</Text> : null}
          </Tarjeta>
        </Aparecer>

        <Aparecer retraso={120}>
          <Tarjeta style={{ gap: space.md }}>
            <Text style={type.heading}>{miembro ? `Anotar el peso de ${miembro.nombre} hoy` : 'Anotar el peso de hoy'}</Text>
            <View style={{ flexDirection: 'row', gap: space.md }}>
              <Campo etiqueta="Peso" sufijo="kg" keyboardType="decimal-pad" value={nuevoPeso} onChangeText={setNuevoPeso} placeholder={kg(r.actual)} maxLength={5} />
            </View>
            <Campo etiqueta="Nota (opcional)" grande={false} value={nota} onChangeText={setNota} placeholder="Por ejemplo: cena con amigos" maxLength={140} />
            <Boton texto="Guardar peso" cargando={guardando} onPress={anotarPeso} />
            <Text style={type.small}>Consejo: pésate una vez por semana, en ayunas y a la misma hora.</Text>
          </Tarjeta>
        </Aparecer>

        {error ? <Aviso tono="rosa" texto={error} /> : null}
        {aviso ? <Aviso tono="hoja" texto={aviso} /> : null}

        {pesos.length > 0 ? (
          <Aparecer retraso={160}>
            <View style={[s.fila, { marginBottom: space.sm }]}>
              <Text style={type.title}>Evolución</Text>
              <View style={{ flexDirection: 'row', gap: space.xs }}>
                {(['1m', '3m', 'todo'] as const).map((k) => (
                  <Chip key={k} texto={k === '1m' ? '1 mes' : k === '3m' ? '3 meses' : 'Todo'} elegido={rango === k} onPress={() => setRango(k)} />
                ))}
              </View>
            </View>
            <Tarjeta>
              <Grafica pesos={visibles} objetivo={objetivo} />
              <View style={s.leyenda}>
                <Text style={type.small}>
                  <Text style={{ color: colors.sea, fontWeight: '800' }}>━</Text> Tendencia semanal{'   '}
                  <Text style={{ color: '#C9D6D9', fontWeight: '800' }}>━</Text> Registros
                </Text>
              </View>
            </Tarjeta>
          </Aparecer>
        ) : null}

        {filas.length > 0 ? (
          <View>
            <Text style={[type.title, { marginBottom: space.sm }]}>Registros</Text>
            <View style={s.caja}>
              {filas.map((p, i) => (
                <View key={p.id} style={[s.registro, i > 0 && s.separador]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[type.body, { color: colors.ink }]}>{fechaLarga(p.fecha)}</Text>
                    {p.nota ? <Text style={type.small}>{p.nota}</Text> : null}
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={s.registroPeso}>{kg(p.peso_kg)} kg</Text>
                    {p.cambio !== null ? (
                      <Text style={[type.small, { color: p.cambio <= 0 ? colors.olive : '#A26A00' }]}>
                        {p.cambio > 0 ? '+' : p.cambio < 0 ? '−' : ''}
                        {kg(Math.abs(p.cambio))}
                      </Text>
                    ) : null}
                  </View>
                  <Pressable onPress={() => quitarPeso(p.id)} accessibilityRole="button" accessibilityLabel="Borrar registro" hitSlop={8} style={s.borrar}>
                    <Text style={s.borrarTexto}>×</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <Pressable onPress={() => setVerMedidas(!verMedidas)} accessibilityRole="button" style={s.desplegable}>
          <Text style={type.title}>Medidas corporales</Text>
          <Text style={[type.title, { color: colors.muted }]}>{verMedidas ? '−' : '+'}</Text>
        </Pressable>

        {verMedidas ? (
          <Aparecer style={{ gap: space.lg }}>
            {ultimaMedida ? (
              <View style={s.caja}>
                {MEDIDAS.filter((m) => ultimaMedida[m.clave] !== null && ultimaMedida[m.clave] !== undefined).map((m, i) => {
                  const actual = Number(ultimaMedida[m.clave]);
                  const inicio = primeraMedida && primeraMedida.id !== ultimaMedida.id ? primeraMedida[m.clave] : null;
                  const dif = inicio !== null && inicio !== undefined ? actual - Number(inicio) : null;
                  return (
                    <View key={m.clave} style={[s.registro, i > 0 && s.separador]}>
                      <Text style={[type.body, { flex: 1, color: colors.ink }]}>{m.texto}</Text>
                      <Text style={s.registroPeso}>{kg(actual)} cm</Text>
                      {dif !== null ? (
                        <Text style={[type.small, { width: 52, textAlign: 'right', color: dif <= 0 ? colors.olive : '#A26A00' }]}>
                          {dif > 0 ? '+' : dif < 0 ? '−' : ''}
                          {kg(Math.abs(dif))}
                        </Text>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            ) : null}
            <Tarjeta style={{ gap: space.md }}>
              <Text style={type.heading}>Anotar medidas de hoy</Text>
              <View style={s.rejilla}>
                {MEDIDAS.map((m) => (
                  <View key={m.clave} style={s.celda}>
                    <Campo
                      etiqueta={m.texto}
                      sufijo="cm"
                      grande={false}
                      keyboardType="decimal-pad"
                      value={nuevasMedidas[m.clave] ?? ''}
                      onChangeText={(t) => setNuevasMedidas({ ...nuevasMedidas, [m.clave]: t })}
                      maxLength={5}
                    />
                  </View>
                ))}
              </View>
              <Text style={type.small}>Rellena solo las que quieras.</Text>
              <Boton texto="Guardar medidas" variante="suave" onPress={anotarMedidas} />
            </Tarjeta>
            {medidas.length > 0 ? (
              <View style={s.caja}>
                {[...medidas].reverse().map((m, i) => (
                  <View key={m.id} style={[s.registro, i > 0 && s.separador]}>
                    <Text style={[type.small, { flex: 1 }]}>
                      {fechaLarga(m.fecha)}:{' '}
                      {MEDIDAS.filter((x) => m[x.clave] !== null && m[x.clave] !== undefined)
                        .map((x) => `${x.texto.toLowerCase()} ${kg(Number(m[x.clave]))}`)
                        .join(', ')}
                    </Text>
                    <Pressable onPress={() => quitarMedida(m.id)} accessibilityRole="button" accessibilityLabel="Borrar medidas" hitSlop={8} style={s.borrar}>
                      <Text style={s.borrarTexto}>×</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}
          </Aparecer>
        ) : null}

        {miembro ? (
          confirmarQuitar ? (
            <Tarjeta style={{ gap: space.md, borderWidth: 1.5, borderColor: colors.rose }}>
              <Text style={type.heading}>¿Quitar a {miembro.nombre}?</Text>
              <Text style={type.body}>Se borrarán para siempre su peso y sus medidas.</Text>
              <Boton texto="Sí, quitar y borrar" onPress={quitarPersona} />
              <Boton texto="Cancelar" variante="linea" onPress={() => setConfirmarQuitar(false)} />
            </Tarjeta>
          ) : (
            <Pressable onPress={() => setConfirmarQuitar(true)} accessibilityRole="button" style={s.quitar}>
              <Text style={s.quitarTexto}>Quitar a {miembro.nombre} y borrar sus datos</Text>
            </Pressable>
          )
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.bg },
  contenido: { padding: space.xl, gap: space.lg, paddingBottom: space.xxl },
  fila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pesoGrande: { fontSize: 44, fontWeight: '800', color: colors.ink, letterSpacing: -1 },
  unidad: { fontSize: 20, fontWeight: '700', color: colors.ink2 },
  pastilla: { backgroundColor: colors.lemonSoft, borderRadius: radius.pill, paddingVertical: 8, paddingHorizontal: 12 },
  pastillaTexto: { fontWeight: '700', color: colors.ink, fontSize: 14 },
  barra: { height: 14, borderRadius: radius.pill, backgroundColor: '#EFEDE4', overflow: 'hidden' },
  barraRelleno: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.lemon },
  datos: { flexDirection: 'row', gap: space.sm },
  dato: { flex: 1, backgroundColor: colors.leafSoft, borderRadius: radius.sm, padding: space.md },
  datoValor: { fontSize: 20, fontWeight: '800', color: colors.ink },
  datoTexto: { fontSize: 13, color: colors.ink2 },
  leyenda: { marginTop: space.sm },
  caja: { backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: space.lg },
  registro: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  separador: { borderTopWidth: 1, borderTopColor: colors.line },
  registroPeso: { fontSize: 16, fontWeight: '700', color: colors.ink },
  borrar: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#F3EFE6', alignItems: 'center', justifyContent: 'center' },
  borrarTexto: { fontSize: 18, color: colors.muted, lineHeight: 20 },
  desplegable: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: space.sm },
  rejilla: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  celda: { width: '47%' },
  quitar: { alignSelf: 'center', padding: space.md },
  quitarTexto: { color: colors.rose, fontWeight: '600', fontSize: 15 },
});
