// Animaciones reutilizables. Usan la API Animated de React Native, sin librerías extra.
import { useEffect, useRef, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';

const nativo = true;

// Respeta la opción de accesibilidad "Reducir movimiento" del móvil.
function useReducirMovimiento() {
  const reducir = useRef(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        reducir.current = v;
      })
      .catch(() => {});
  }, []);
  return reducir;
}

// Hace aparecer su contenido deslizándose hacia arriba y ganando opacidad.
export function Aparecer({
  children,
  retraso = 0,
  desde = 16,
  duracion = 420,
  style,
}: {
  children: ReactNode;
  retraso?: number;
  desde?: number;
  duracion?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const v = useRef(new Animated.Value(0)).current;
  const reducir = useReducirMovimiento();
  useEffect(() => {
    Animated.timing(v, {
      toValue: 1,
      duration: reducir.current ? 0 : duracion,
      delay: reducir.current ? 0 : retraso,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: nativo,
    }).start();
  }, [v, retraso, duracion, reducir]);
  return (
    <Animated.View
      style={[
        style,
        { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [desde, 0] }) }] },
      ]}
    >
      {children}
    </Animated.View>
  );
}

// Movimiento suave y continuo arriba y abajo (para el logotipo).
export function Flotar({ children, amplitud = 6 }: { children: ReactNode; amplitud?: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const bucle = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: nativo }),
        Animated.timing(v, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: nativo }),
      ]),
    );
    bucle.start();
    return () => bucle.stop();
  }, [v]);
  return (
    <Animated.View style={{ transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -amplitud] }) }] }}>
      {children}
    </Animated.View>
  );
}

// Crece de 0 a su tamaño con un pequeño rebote (para iconos de celebración).
export function Saltar({ children, retraso = 0 }: { children: ReactNode; retraso?: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.delay(retraso),
      Animated.spring(v, { toValue: 1, friction: 4, tension: 120, useNativeDriver: nativo }),
    ]).start();
  }, [v, retraso]);
  return <Animated.View style={{ transform: [{ scale: v }], opacity: v }}>{children}</Animated.View>;
}

// Escala al pulsar: se encoge un poco y vuelve con rebote.
export function usePulsacion() {
  const escala = useRef(new Animated.Value(1)).current;
  const entrar = () => Animated.spring(escala, { toValue: 0.96, speed: 40, bounciness: 0, useNativeDriver: nativo }).start();
  const salir = () => Animated.spring(escala, { toValue: 1, speed: 20, bounciness: 10, useNativeDriver: nativo }).start();
  return { escala, entrar, salir };
}

// Pequeño "latido" cada vez que cambia `valor` (para confirmar una selección).
export function useLatido(valor: unknown) {
  const escala = useRef(new Animated.Value(1)).current;
  const primero = useRef(true);
  useEffect(() => {
    if (primero.current) {
      primero.current = false;
      return;
    }
    Animated.sequence([
      Animated.timing(escala, { toValue: 1.04, duration: 90, useNativeDriver: nativo }),
      Animated.spring(escala, { toValue: 1, friction: 4, useNativeDriver: nativo }),
    ]).start();
  }, [valor, escala]);
  return escala;
}

// Sacudida horizontal para señalar un error.
export function useSacudida() {
  const x = useRef(new Animated.Value(0)).current;
  const sacudir = () =>
    Animated.sequence(
      [10, -10, 7, -7, 3, 0].map((toValue) => Animated.timing(x, { toValue, duration: 50, useNativeDriver: nativo })),
    ).start();
  return { x, sacudir };
}
