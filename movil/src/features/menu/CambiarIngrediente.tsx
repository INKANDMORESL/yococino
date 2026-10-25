// Cambiar un ingrediente de la receta: se rehace entera (cantidades, tiempos y pasos) con el nuevo.
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Aparecer, Aviso, Boton, Campo, Chip } from '../../components';
import { colors, radius, space, type } from '../../theme';
import { ErrorMenu, cambiarIngrediente } from './api';
import type { Ingrediente } from './tipos';

const mayuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

export function CambiarIngrediente({
  recetaId,
  ingredientes,
  comidaId,
  listo,
}: {
  recetaId: number;
  ingredientes: Ingrediente[];
  comidaId: number | null;
  listo: (recetaId: number) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [elegido, setElegido] = useState<string | null>(null);
  const [por, setPor] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alternativas, setAlternativas] = useState<string[]>([]);
  const opciones = ingredientes.filter((i) => i.unidad !== 'al gusto');

  const adaptar = async (texto = por) => {
    if (!elegido) return setError('Elige qué ingrediente quieres cambiar.');
    if (!texto.trim()) return setError('Escribe por cuál lo quieres cambiar.');
    setError(null);
    setAlternativas([]);
    setCargando(true);
    try {
      const r = await cambiarIngrediente(recetaId, elegido, texto.trim(), comidaId);
      listo(r.receta_id);
    } catch (e) {
      setError(e instanceof ErrorMenu ? e.message : 'No hemos podido adaptar la receta.');
      // Si no es un ingrediente válido, se proponen otros que sí encajan.
      if (e instanceof ErrorMenu && e.codigo === 'ingrediente_no_valido') setAlternativas((e.detalle ?? '').split('|').filter(Boolean));
      setCargando(false);
    }
  };

  if (!abierto) {
    return (
      <Pressable onPress={() => setAbierto(true)} accessibilityRole="button" style={s.abrir}>
        <Text style={s.abrirTexto}>⇄ Cambiar un ingrediente</Text>
      </Pressable>
    );
  }

  return (
    <Aparecer style={s.caja}>
      <Text style={type.heading}>Cambiar un ingrediente</Text>
      <Text style={type.small}>Rehacemos la receta con el nuevo: cantidades, tiempo de cocción y pasos.</Text>
      <Text style={[type.label, { marginTop: space.xs }]}>¿Cuál quieres cambiar?</Text>
      <View style={s.chips}>
        {opciones.map((i) => (
          <Chip key={`${i.orden}-${i.nombre}`} texto={mayuscula(i.nombre)} elegido={elegido === i.nombre} onPress={() => setElegido(i.nombre)} />
        ))}
      </View>
      {elegido ? (
        <Campo
          etiqueta={`¿Por qué cambias ${elegido}?`}
          grande={false}
          value={por}
          onChangeText={setPor}
          placeholder="Por ejemplo: pavo, quinoa, brócoli"
          maxLength={60}
          autoCapitalize="none"
          onSubmitEditing={() => adaptar()}
          returnKeyType="done"
        />
      ) : null}
      {error ? <Aviso tono="rosa" texto={error} /> : null}
      {alternativas.length ? (
        <View style={s.chips}>
          {alternativas.map((a) => (
            <Chip
              key={a}
              texto={mayuscula(a)}
              elegido={false}
              onPress={() => {
                setPor(a);
                adaptar(a);
              }}
            />
          ))}
        </View>
      ) : null}
      <Boton texto={cargando ? 'Adaptando la receta…' : 'Adaptar la receta'} cargando={cargando} onPress={() => adaptar()} />
      {cargando ? <Text style={[type.small, { textAlign: 'center' }]}>Tarda unos 30 segundos.</Text> : null}
      {!cargando ? (
        <Pressable onPress={() => setAbierto(false)} accessibilityRole="button" style={s.abrir}>
          <Text style={[s.abrirTexto, { color: colors.muted }]}>Cancelar</Text>
        </Pressable>
      ) : null}
    </Aparecer>
  );
}

const s = StyleSheet.create({
  abrir: { alignSelf: 'flex-start', paddingVertical: space.md },
  abrirTexto: { color: colors.olive, fontWeight: '700', fontSize: 15 },
  caja: { marginTop: space.md, backgroundColor: colors.leafSoft, borderRadius: radius.lg, padding: space.lg, gap: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
