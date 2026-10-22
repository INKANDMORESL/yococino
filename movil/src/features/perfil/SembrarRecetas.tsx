// Herramienta del dueño: llenar el recetario y hacer sus fotos por LOTES (a mitad de precio).
// Los lotes tardan desde minutos hasta unas horas; al volver aquí se recogen solos.
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Aviso, Boton, Chip, Tarjeta } from '../../components';
import { colors, radius, space, type } from '../../theme';
import { ErrorMenu, sembrarRecetas, type EstadoLotes } from '../menu/api';

const OPCIONES = [50, 100, 200];
const fecha = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
};
const euros = (usd?: number) => `${((usd ?? 0) * 0.9).toFixed(2).replace('.', ',')} €`;

export function SembrarRecetas() {
  const [cantidad, setCantidad] = useState(200);
  const [datos, setDatos] = useState<EstadoLotes | null>(null);
  const [ocupado, setOcupado] = useState<'estado' | 'enviar' | 'fotos' | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const hacer = useCallback(async (accion: 'estado' | 'enviar' | 'fotos', n?: number) => {
    setOcupado(accion);
    setMensaje(null);
    try {
      const r = await sembrarRecetas(accion, n);
      setDatos(r);
      if (r.aviso) setMensaje(r.aviso);
      else if (accion === 'enviar' && r.enviadas) setMensaje(`Enviadas ${r.enviadas} recetas a la cola. Estarán listas en unos minutos o unas horas.`);
      else if (accion === 'fotos' && r.enviadas) setMensaje(`Enviadas ${r.enviadas} fotos a la cola.`);
      if (r.errores?.length) setMensaje(`Detalle técnico: ${r.errores[0]}`);
    } catch (e) {
      setMensaje(e instanceof ErrorMenu ? `${e.message}${e.detalle ? ` (${e.detalle})` : ''}` : 'Se ha cortado la conexión.');
    } finally {
      setOcupado(null);
    }
  }, []);

  useEffect(() => {
    hacer('estado');
  }, [hacer]);

  const abiertos = datos?.lotes.filter((l) => l.estado === 'enviado').length ?? 0;

  return (
    <Tarjeta style={{ gap: space.md }}>
      <Text style={type.heading}>Llenar el recetario</Text>
      <Text style={type.small}>
        Las recetas y fotos que creas tú van por lotes, a mitad de precio. Tardan desde unos minutos hasta unas horas; no hace falta dejar la pantalla
        abierta. Al volver aquí, lo terminado se guarda solo.
      </Text>
      {datos ? (
        <Text style={[type.body, { color: colors.ink }]}>
          Recetas nuevas este mes: {datos.cupo.usadas} de {datos.cupo.tope}
        </Text>
      ) : null}

      <View style={s.chips}>
        {OPCIONES.map((n) => (
          <Chip key={n} texto={`${n} recetas`} elegido={cantidad === n} onPress={() => setCantidad(n)} />
        ))}
      </View>
      <Boton texto="Crear recetas (lote)" variante="suave" cargando={ocupado === 'enviar'} desactivado={!!ocupado} onPress={() => hacer('enviar', cantidad)} />
      <Boton texto="Hacer 20 fotos que faltan (lote)" variante="linea" cargando={ocupado === 'fotos'} desactivado={!!ocupado} onPress={() => hacer('fotos', 20)} />

      {mensaje ? <Aviso tono="hoja" texto={mensaje} /> : null}

      {datos?.lotes.length ? (
        <View style={{ gap: space.sm }}>
          <View style={s.fila}>
            <Text style={s.subtitulo}>Lotes</Text>
            <Boton texto={abiertos ? 'Comprobar ahora' : 'Actualizar'} variante="linea" cargando={ocupado === 'estado'} desactivado={!!ocupado} onPress={() => hacer('estado')} />
          </View>
          {datos.lotes.map((l) => (
            <View key={l.id} style={s.lote}>
              <Text style={s.loteTitulo}>
                {l.tipo === 'recetas' ? '📖' : '📷'} {l.cantidad} {l.tipo === 'recetas' ? 'recetas' : 'fotos'} · {fecha(l.created_at)}
              </Text>
              <Text style={type.small}>
                {l.estado === 'enviado'
                  ? 'En la cola…'
                  : l.estado === 'fallido'
                    ? 'No se completó (se puede volver a pedir).'
                    : l.tipo === 'recetas'
                      ? `Listo: ${l.resultado?.creadas ?? 0} guardadas, ${l.resultado?.descartadas ?? 0} descartadas · ${euros(l.resultado?.coste_usd)}`
                      : `Listo: ${l.resultado?.guardadas ?? 0} fotos · ${euros(l.resultado?.coste_usd)}`}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </Tarjeta>
  );
}

const s = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  fila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  subtitulo: { fontSize: 16, fontWeight: '700', color: colors.ink },
  lote: { backgroundColor: colors.leafSoft, borderRadius: radius.md, padding: space.md, gap: 2 },
  loteTitulo: { fontSize: 15, fontWeight: '700', color: colors.ink },
});
