// Animación corta al abrir la app (1,5-2 s): el logo sobre el mismo fondo que la pantalla de carga del móvil,
// late un poco, aparece el lema y se desvanece agrandándose. Mientras, Inicio se carga por detrás.
// Se espera también a saber si hay sesión (como mucho 3 s), para no enseñar una pantalla a medio cargar.
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Platform, StyleSheet, Text } from 'react-native';
import { colors } from '../theme';

const FONDO = '#F4ECDE'; // el mismo que la pantalla de carga (app.json → expo-splash-screen)
const ANCHO = 240; // imageWidth de la pantalla de carga: así el logo empieza exactamente donde estaba
const nativo = Platform.OS !== 'web';
const MINIMO = 1400;
const MAXIMO = 3000;

SplashScreen.preventAutoHideAsync().catch(() => {});

let yaVista = false;

export function Arranque({ listo }: { listo: boolean }) {
  const [visible, setVisible] = useState(!yaVista);
  const escala = useRef(new Animated.Value(1)).current;
  const lema = useRef(new Animated.Value(0)).current;
  const capa = useRef(new Animated.Value(1)).current;
  const inicio = useRef(Date.now()).current;
  const saliendo = useRef(false);

  // Al pintarse por primera vez, se quita la pantalla de carga del sistema (ya estamos encima, igual).
  const alPintar = () => {
    SplashScreen.hideAsync().catch(() => {});
    Animated.sequence([
      Animated.timing(escala, { toValue: 1.08, duration: 320, easing: Easing.out(Easing.back(2)), useNativeDriver: nativo }),
      Animated.timing(escala, { toValue: 1, duration: 260, easing: Easing.inOut(Easing.quad), useNativeDriver: nativo }),
    ]).start();
    Animated.timing(lema, { toValue: 1, duration: 450, delay: 350, useNativeDriver: nativo }).start();
  };

  useEffect(() => {
    if (!visible) {
      SplashScreen.hideAsync().catch(() => {});
      return;
    }
    const salir = () => {
      if (saliendo.current) return;
      saliendo.current = true;
      Animated.parallel([
        Animated.timing(capa, { toValue: 0, duration: 380, easing: Easing.in(Easing.quad), useNativeDriver: nativo }),
        Animated.timing(escala, { toValue: 1.25, duration: 380, easing: Easing.in(Easing.quad), useNativeDriver: nativo }),
      ]).start(() => {
        yaVista = true;
        setVisible(false);
      });
    };
    const pasado = Date.now() - inicio;
    const t = setTimeout(salir, listo ? Math.max(0, MINIMO - pasado) : Math.max(0, MAXIMO - pasado));
    return () => clearTimeout(t);
  }, [listo, visible, capa, escala, inicio]);

  if (!visible) return null;
  return (
    <Animated.View style={[StyleSheet.absoluteFill, s.capa, { opacity: capa }]} onLayout={alPintar} accessibilityLabel="Abriendo Yococino">
      <Animated.View style={{ transform: [{ scale: escala }] }}>
        <Image source={require('../../assets/splash.png')} style={{ width: ANCHO, height: (ANCHO * 825) / 865 }} resizeMode="contain" />
      </Animated.View>
      <Animated.View style={{ opacity: lema, transform: [{ translateY: lema.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }}>
        <Text style={s.lema}>Tu menú del mes, sin complicarte</Text>
      </Animated.View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  capa: { backgroundColor: FONDO, alignItems: 'center', justifyContent: 'center', zIndex: 1000, elevation: 1000 },
  lema: { marginTop: 18, fontSize: 16, fontWeight: '700', color: colors.olive, textAlign: 'center' },
});
