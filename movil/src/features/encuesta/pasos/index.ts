import type { ComponentType } from 'react';
import { PasoActividad } from './PasoActividad';
import { PasoCasa } from './PasoCasa';
import { PasoCocina } from './PasoCocina';
import { PasoGustos } from './PasoGustos';
import { PasoObjetivo } from './PasoObjetivo';
import { PasoSalud } from './PasoSalud';
import { PasoSobreTi } from './PasoSobreTi';
import type { PasoProps } from './tipos';

// El orden coincide con PASOS en modelo.ts.
export const COMPONENTES_PASO: ComponentType<PasoProps>[] = [
  PasoSobreTi,
  PasoObjetivo,
  PasoActividad,
  PasoSalud,
  PasoGustos,
  PasoCocina,
  PasoCasa,
];
