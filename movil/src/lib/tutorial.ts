// Recordar en el dispositivo si ya se vio el paso a paso de la primera vez.
import AsyncStorage from '@react-native-async-storage/async-storage';

const CLAVE = 'yococino:tutorial-visto';

export async function tutorialVisto(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(CLAVE)) === '1';
  } catch {
    return true; // Sin almacenamiento disponible: no se insiste.
  }
}

export async function marcarTutorialVisto() {
  try {
    await AsyncStorage.setItem(CLAVE, '1');
  } catch {
    // Sin almacenamiento: se puede volver a mostrar, no pasa nada.
  }
}
