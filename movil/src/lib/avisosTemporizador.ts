// Temporizadores de las recetas fuera de la app: mientras corre, una notificación fija en la barra y en la
// pantalla bloqueada («Termina a las 21:15»); al acabar, otra que suena y vibra aunque la app esté cerrada.
// Las dos usan el mismo identificador, así que la de «¡Tiempo!» sustituye a la fija al llegar a cero.
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const CANAL_FIN = 'temporizador-fin';
const CANAL_MARCHA = 'temporizador-marcha';

// Con la app abierta ya se avisa en pantalla: la notificación solo suena si llega estando fuera.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: false, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

let preparado: Promise<boolean> | null = null;

function preparar(): Promise<boolean> {
  preparado ??= (async () => {
    try {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync(CANAL_FIN, {
          name: 'Fin del temporizador',
          importance: Notifications.AndroidImportance.MAX,
          sound: 'default',
          vibrationPattern: [0, 600, 250, 600, 250, 600],
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        });
        await Notifications.setNotificationChannelAsync(CANAL_MARCHA, {
          name: 'Temporizador en marcha',
          importance: Notifications.AndroidImportance.LOW,
          sound: null,
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        });
      }
      const actual = await Notifications.getPermissionsAsync();
      if (actual.granted) return true;
      if (!actual.canAskAgain) return false;
      return (await Notifications.requestPermissionsAsync()).granted;
    } catch {
      return false;
    }
  })();
  return preparado;
}

const hora = (ms: number) => new Date(ms).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

// Programa el aviso de un temporizador (clave única por receta y paso). Si no hay permiso, no hace nada.
export async function avisarAlTerminar(clave: string, segundos: number, receta: string, paso: number) {
  if (!(await preparar())) return;
  const id = `temporizador-${clave}`;
  try {
    await quitar(clave);
    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: {
        title: `⏱️ ${receta}`,
        body: `Paso ${paso}: termina a las ${hora(Date.now() + segundos * 1000)}`,
        sticky: true,
        autoDismiss: false,
        sound: false,
      },
      trigger: Platform.OS === 'android' ? { channelId: CANAL_MARCHA } : null,
    });
    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: {
        title: `⏰ ¡Tiempo! ${receta}`,
        body: `Paso ${paso} listo.`,
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.MAX,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(1, Math.round(segundos)),
        channelId: CANAL_FIN,
      },
    });
  } catch {
    // Sin notificaciones: el temporizador sigue funcionando dentro de la app.
  }
}

// Quita el aviso programado y la notificación fija (al pausar, cancelar o terminar con la app abierta).
export async function quitar(clave: string) {
  const id = `temporizador-${clave}`;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
    await Notifications.dismissNotificationAsync(id);
  } catch {
    // Nada que quitar.
  }
}
