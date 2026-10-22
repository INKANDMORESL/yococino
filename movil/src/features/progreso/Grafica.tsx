// Gráfica de peso: registros, tendencia semanal y línea del objetivo.
import { useState } from 'react';
import { type LayoutChangeEvent, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { colors } from '../../theme';
import type { Peso } from './api';
import { tendencia } from './calculos';

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const fechaCorta = (f: string) => `${Number(f.slice(8, 10))} ${MESES[Number(f.slice(5, 7)) - 1]}`;

export function Grafica({ pesos, objetivo, alto = 200 }: { pesos: Peso[]; objetivo: number | null; alto?: number }) {
  const [ancho, setAncho] = useState(320);
  const onLayout = (e: LayoutChangeEvent) => setAncho(e.nativeEvent.layout.width);
  if (pesos.length === 0) return null;

  const I = 34, D = 10, A = 14, B = 24;
  const ts = pesos.map((p) => new Date(`${p.fecha}T12:00:00`).getTime());
  let minX = Math.min(...ts), maxX = Math.max(...ts);
  if (maxX - minX < 6 * 864e5) {
    minX -= 3 * 864e5;
    maxX += 3 * 864e5;
  }
  const valores = pesos.map((p) => p.peso_kg).concat(objetivo !== null ? [objetivo] : []);
  let minY = Math.floor(Math.min(...valores) - 0.5), maxY = Math.ceil(Math.max(...valores) + 0.5);
  const paso = maxY - minY <= 6 ? 1 : maxY - minY <= 14 ? 2 : 5;
  minY = Math.floor(minY / paso) * paso;
  maxY = Math.ceil(maxY / paso) * paso;
  const x = (t: number) => I + ((t - minX) / (maxX - minX)) * (ancho - I - D);
  const y = (v: number) => A + (1 - (v - minY) / (maxY - minY)) * (alto - A - B);
  const linea = (puntos: [number, number][]) => puntos.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`).join('');

  const marcas: number[] = [];
  for (let v = minY; v <= maxY + 1e-9; v += paso) marcas.push(v);
  const tend = tendencia(pesos);
  const ultimo = tend[tend.length - 1];

  return (
    <View onLayout={onLayout} accessibilityRole="image" accessibilityLabel="Gráfica de la evolución de tu peso">
      <Svg width={ancho} height={alto}>
        {marcas.map((v) => (
          <Line key={`l${v}`} x1={I} x2={ancho - D} y1={y(v)} y2={y(v)} stroke={colors.line} strokeWidth={1} />
        ))}
        {marcas.map((v) => (
          <SvgText key={`t${v}`} x={I - 6} y={y(v) + 4} fontSize={11} fill={colors.muted} textAnchor="end">
            {v}
          </SvgText>
        ))}
        <SvgText x={I} y={alto - 6} fontSize={11} fill={colors.muted}>
          {fechaCorta(pesos[0].fecha)}
        </SvgText>
        <SvgText x={ancho - D} y={alto - 6} fontSize={11} fill={colors.muted} textAnchor="end">
          {fechaCorta(pesos[pesos.length - 1].fecha)}
        </SvgText>
        {objetivo !== null ? (
          <>
            <Line x1={I} x2={ancho - D} y1={y(objetivo)} y2={y(objetivo)} stroke={colors.olive} strokeWidth={1.5} strokeDasharray="5 5" />
            <SvgText x={ancho - D} y={y(objetivo) - 6} fontSize={11} fontWeight="700" fill={colors.olive} textAnchor="end">
              {`Objetivo ${objetivo.toLocaleString('es-ES')} kg`}
            </SvgText>
          </>
        ) : null}
        {pesos.length > 1 ? (
          <Path d={linea(pesos.map((p, i) => [x(ts[i]), y(p.peso_kg)]))} stroke="#C9D6D9" strokeWidth={1.5} fill="none" />
        ) : null}
        {pesos.map((p, i) => (
          <Circle key={p.id} cx={x(ts[i])} cy={y(p.peso_kg)} r={3.2} fill="#fff" stroke={colors.sea} strokeWidth={2} />
        ))}
        {tend.length > 1 ? (
          <Path d={linea(tend.map((p, i) => [x(ts[i]), y(p.valor)]))} stroke={colors.sea} strokeWidth={3.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        ) : null}
        {ultimo ? <Circle cx={x(ts[ts.length - 1])} cy={y(ultimo.valor)} r={5.5} fill={colors.sea} stroke="#fff" strokeWidth={2.5} /> : null}
      </Svg>
    </View>
  );
}
