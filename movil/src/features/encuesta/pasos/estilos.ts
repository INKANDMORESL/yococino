import { StyleSheet } from 'react-native';
import { space } from '../../../theme';

export const ps = StyleSheet.create({
  columna: { gap: space.md },
  columnaAmplia: { gap: space.lg },
  fila: { flexDirection: 'row', gap: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
