// Herramienta del dueño: llenar el recetario compartido por tandas, respetando el cupo del mes.
import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Aviso, Boton, Chip, Tarjeta } from '../../components';
import { colors, space, type } from '../../theme';
import { ErrorMenu, sembrarRecetas } from '../menu/api';

const OPCIONES = [50, 100, 200];

export function SembrarRecetas() {
  const [objetivo, setObjetivo] = useState(200);
  const [hechas, setHechas] = useState(0);
  const [coste, setCoste] = useState(0);
  const [ultimas, setUltimas] = useState<string[]>([]);
  const [enMarcha, setEnMarcha] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const parar = useRef(false);

  const empezar = async () => {
    parar.current = false;
    setEnMarcha(true);
    setMensaje(null);
    setHechas(0);
    setCoste(0);
    let total = 0;
    let gastado = 0;
    let vaciasSeguidas = 0;
    try {
      while (!parar.current && total < objetivo) {
        const r = await sembrarRecetas(Math.min(8, objetivo - total));
        total += r.creadas.length;
        gastado += r.coste_usd;
        setHechas(total);
        setCoste(gastado);
        if (r.creadas.length) setUltimas(r.creadas.slice(-3));
        if (r.quedan_cupo <= 0) {
          setMensaje(`Se ha llegado al límite de este mes (${r.tope} recetas nuevas).`);
          break;
        }
        vaciasSeguidas = r.creadas.length ? 0 : vaciasSeguidas + 1;
        if (vaciasSeguidas >= 2) {
          setMensaje(`No se han podido crear más recetas ahora.${r.errores?.length ? ` Detalle técnico: ${r.errores[0]}` : ''}`);
          break;
        }
      }
      if (!parar.current && total >= objetivo) setMensaje('¡Listo! Recetario cargado.');
    } catch (e) {
      setMensaje(e instanceof ErrorMenu ? `${e.message}${e.detalle ? ` (${e.detalle})` : ''}` : 'Se ha cortado la conexión. Puedes volver a empezar.');
    } finally {
      setEnMarcha(false);
    }
  };

  return (
    <Tarjeta style={{ gap: space.md }}>
      <Text style={type.heading}>Llenar el recetario</Text>
      <Text style={type.small}>
        Crea recetas nuevas para todos, por tandas de 8. Respeta el límite del mes (600 al mes los 7 primeros meses, luego 200). Deja esta pantalla
        abierta mientras trabaja: unas 200 recetas tardan alrededor de media hora.
      </Text>
      {!enMarcha ? (
        <View style={s.chips}>
          {OPCIONES.map((n) => (
            <Chip key={n} texto={`${n} recetas`} elegido={objetivo === n} onPress={() => setObjetivo(n)} />
          ))}
        </View>
      ) : null}
      {enMarcha || hechas ? (
        <View style={{ gap: 4 }}>
          <Text style={[type.body, { color: colors.ink }]}>
            {hechas} de {objetivo} recetas creadas · gasto aprox. {(coste * 0.9).toFixed(2).replace('.', ',')} €
          </Text>
          {ultimas.length ? <Text style={type.small}>Últimas: {ultimas.join(', ')}</Text> : null}
        </View>
      ) : null}
      {mensaje ? <Aviso tono="hoja" texto={mensaje} /> : null}
      {enMarcha ? (
        <Boton
          texto="Parar después de esta tanda"
          variante="linea"
          onPress={() => {
            parar.current = true;
          }}
        />
      ) : (
        <Boton texto="Empezar" variante="suave" onPress={empezar} />
      )}
    </Tarjeta>
  );
}

const s = StyleSheet.create({ chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm } });
