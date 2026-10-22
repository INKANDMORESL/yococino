// Familia en Progreso: selector de persona y formulario para añadir a alguien (solo adultos, con su permiso).
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Aparecer, Aviso, Boton, Campo, Casilla, Chip, Tarjeta } from '../../components';
import { colors, radius, space, type } from '../../theme';
import { MAX_MIEMBROS, crearMiembro, type Miembro } from './api';

export function SelectorPersona({
  miembros,
  persona,
  elegir,
  anadir,
  nombrePropio,
}: {
  miembros: Miembro[];
  persona: number | null;
  elegir: (id: number | null) => void;
  anadir: () => void;
  nombrePropio: string;
}) {
  const opciones: { id: number | null; texto: string }[] = [{ id: null, texto: nombrePropio }, ...miembros.map((m) => ({ id: m.id, texto: m.nombre }))];
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.selector}>
      {opciones.map((o) => {
        const activa = persona === o.id;
        return (
          <Pressable
            key={o.id ?? 'yo'}
            onPress={() => elegir(o.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: activa }}
            style={[s.persona, activa && s.personaActiva]}
          >
            <View style={[s.inicial, activa && s.inicialActiva]}>
              <Text style={[s.inicialTexto, activa && { color: colors.olive }]}>{o.texto.charAt(0).toUpperCase()}</Text>
            </View>
            <Text style={[s.personaTexto, activa && { color: '#fff' }]} numberOfLines={1}>
              {o.texto}
            </Text>
          </Pressable>
        );
      })}
      {miembros.length < MAX_MIEMBROS ? (
        <Pressable onPress={anadir} accessibilityRole="button" accessibilityLabel="Añadir a alguien de la familia" style={s.anadir}>
          <Text style={s.anadirTexto}>+ Añadir</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const numero = (t: string) => {
  const n = parseFloat(t.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

export function NuevoMiembro({ listo, cancelar }: { listo: (m: Miembro) => void; cancelar: () => void }) {
  const [nombre, setNombre] = useState('');
  const [altura, setAltura] = useState('');
  const [peso, setPeso] = useState('');
  const [objetivo, setObjetivo] = useState<'perder' | 'mantener' | 'musculo'>('mantener');
  const [pesoObjetivo, setPesoObjetivo] = useState('');
  const [adulto, setAdulto] = useState(false);
  const [permiso, setPermiso] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    setError(null);
    const a = numero(altura);
    const p = numero(peso);
    const po = objetivo === 'perder' ? numero(pesoObjetivo) : null;
    if (!nombre.trim()) return setError('Escribe su nombre.');
    if (a === null || a < 120 || a > 230) return setError('Escribe su altura en centímetros, por ejemplo 172.');
    if (p === null || p < 30 || p > 300) return setError('Escribe su peso en kilos, por ejemplo 80,5.');
    if (objetivo === 'perder') {
      if (po === null || po < 30 || po >= p) return setError('El peso objetivo tiene que ser menor que su peso actual.');
      const imc = po / (a / 100) ** 2;
      if (imc < 18.5) {
        const minimo = Math.ceil(18.5 * (a / 100) ** 2 * 10) / 10;
        return setError(`Por salud, el peso objetivo no puede bajar de ${String(minimo).replace('.', ',')} kg para su altura.`);
      }
    }
    if (!adulto) return setError('Por ahora solo se puede añadir a personas mayores de 18 años.');
    if (!permiso) return setError('Necesitamos que esa persona esté de acuerdo en guardar su peso y medidas.');
    setGuardando(true);
    try {
      listo(await crearMiembro({ nombre, altura_cm: a, peso_inicial_kg: p, objetivo, peso_objetivo_kg: po }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se ha podido guardar.');
      setGuardando(false);
    }
  };

  return (
    <Aparecer>
      <Tarjeta style={{ gap: space.md }}>
        <Text style={type.heading}>Añadir a alguien de la familia</Text>
        <Text style={type.small}>Cada persona tiene su propio peso, medidas y objetivo. Hasta {MAX_MIEMBROS} personas, todas mayores de edad.</Text>
        <Campo etiqueta="Nombre" grande={false} value={nombre} onChangeText={setNombre} autoCapitalize="words" maxLength={40} placeholder="Por ejemplo: Lucía" />
        <View style={{ flexDirection: 'row', gap: space.md }}>
          <View style={{ flex: 1 }}>
            <Campo etiqueta="Altura" sufijo="cm" grande={false} keyboardType="decimal-pad" value={altura} onChangeText={setAltura} maxLength={5} />
          </View>
          <View style={{ flex: 1 }}>
            <Campo etiqueta="Peso" sufijo="kg" grande={false} keyboardType="decimal-pad" value={peso} onChangeText={setPeso} maxLength={5} />
          </View>
        </View>
        <Text style={[type.label, { marginLeft: space.xs }]}>Objetivo</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {(
            [
              ['perder', 'Perder peso'],
              ['mantener', 'Mantenerse'],
              ['musculo', 'Ganar músculo'],
            ] as const
          ).map(([k, t]) => (
            <Chip key={k} texto={t} elegido={objetivo === k} onPress={() => setObjetivo(k)} />
          ))}
        </View>
        {objetivo === 'perder' ? (
          <Campo etiqueta="Peso objetivo" sufijo="kg" grande={false} keyboardType="decimal-pad" value={pesoObjetivo} onChangeText={setPesoObjetivo} maxLength={5} />
        ) : null}
        <Casilla marcada={adulto} onPress={() => setAdulto(!adulto)}>
          Es mayor de 18 años.
        </Casilla>
        <Casilla marcada={permiso} onPress={() => setPermiso(!permiso)}>
          Esta persona está de acuerdo en que guardemos su peso y sus medidas en tu cuenta. Podrás borrarlo cuando quieras.
        </Casilla>
        {error ? <Aviso tono="rosa" texto={error} /> : null}
        <Boton texto="Añadir" cargando={guardando} onPress={guardar} />
        <Boton texto="Cancelar" variante="linea" onPress={cancelar} />
      </Tarjeta>
    </Aparecer>
  );
}

const s = StyleSheet.create({
  selector: { gap: space.sm, paddingVertical: 2, paddingRight: space.xl },
  persona: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.line,
    maxWidth: 170,
  },
  personaActiva: { backgroundColor: colors.olive, borderColor: colors.olive },
  inicial: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.leaf, alignItems: 'center', justifyContent: 'center' },
  inicialActiva: { backgroundColor: '#fff' },
  inicialTexto: { fontWeight: '800', fontSize: 14, color: colors.oliveInk },
  personaTexto: { fontWeight: '700', fontSize: 15, color: colors.ink },
  anadir: {
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.olive,
  },
  anadirTexto: { fontWeight: '700', fontSize: 15, color: colors.olive },
});
