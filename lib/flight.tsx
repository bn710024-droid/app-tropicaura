import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { useFrame } from './useFrame';
import type { Photo } from './data';

type Rect = { x: number; y: number; w: number; h: number };
type Pending = {
  id: string;
  image: Photo;
  at: number;
  from?: Rect;
  to?: Rect;
  done?: () => void;
  started?: boolean;
  guard?: ReturnType<typeof setTimeout>;
};

type Api = {
  /** Depuis une carte : la photo du produit part de là. La navigation n'attend pas. */
  depart: (id: string, image: Photo, node: View | null, ratio: number) => void;
  /** La fiche qui s'ouvre attend-elle une photo en vol ? (réponse immédiate) */
  expects: (id: string) => boolean;
  /** Depuis la fiche : où la photo doit se poser, et quoi faire une fois posée. */
  arrive: (id: string, to: Rect, done: () => void) => boolean;
};

const Ctx = createContext<Api>({ depart: () => {}, expects: () => false, arrive: () => false });

/**
 * Transition « la photo suit » : en ouvrant un produit depuis une carte, sa photo glisse de la
 * carte jusqu'à sa place dans la fiche. La fiche s'ouvre tout de suite ; si la mesure de départ
 * manque ou tarde, elle s'affiche simplement comme d'habitude.
 */
export function FlightProvider({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion();
  // Sur ordinateur, la fiche s'ouvre en deux colonnes : la transition du téléphone ne s'applique pas.
  const { desktop } = useFrame();
  const host = useRef<View>(null);
  const pending = useRef<Pending | null>(null);
  const [shown, setShown] = useState<{ image: Photo; from: Rect; to: Rect } | null>(null);
  const t = useSharedValue(0);

  const finish = useCallback(() => {
    const p = pending.current;
    if (!p) return;
    pending.current = null;
    if (p.guard) clearTimeout(p.guard);
    p.done?.();
    // La vraie photo de la fiche est en place : on retire la copie juste après.
    setTimeout(() => setShown(null), 90);
  }, []);

  const start = useCallback(() => {
    const p = pending.current;
    if (!p || p.started || !p.from || !p.to) return;
    p.started = true;
    setShown({ image: p.image, from: p.from, to: p.to });
    t.value = 0;
    t.value = withTiming(
      1,
      { duration: 400, easing: Easing.bezier(0.33, 1, 0.68, 1) },
      (finished) => {
        'worklet';
        if (finished) runOnJS(finish)();
      },
    );
  }, [t, finish]);

  const api = useMemo<Api>(
    () => ({
      depart: (id, image, node, ratio) => {
        if (reduced || desktop || !node || !host.current) return;
        const mine: Pending = { id, image, at: Date.now() };
        pending.current = mine;
        const place = (x: number, y: number, w: number, h: number, hx: number, hy: number) => {
          if (pending.current !== mine || !(w > 0 && h > 0)) return;
          // La photo est « contenue » dans son cadre, centrée : on part de l'image
          // réellement dessinée, pas du cadre.
          const drawnW = Math.min(w, h * ratio);
          const drawnH = drawnW / ratio;
          mine.from = {
            x: x - hx + (w - drawnW) / 2,
            y: y - hy + (h - drawnH) / 2,
            w: drawnW,
            h: drawnH,
          };
          start();
        };
        // Web : mesure immédiate, avant que la page de départ ne soit masquée.
        const el = node as unknown as { getBoundingClientRect?: () => DOMRect };
        const hostEl = host.current as unknown as { getBoundingClientRect?: () => DOMRect };
        if (el.getBoundingClientRect && hostEl.getBoundingClientRect) {
          const r = el.getBoundingClientRect();
          const hr = hostEl.getBoundingClientRect();
          place(r.left, r.top, r.width, r.height, hr.left, hr.top);
          return;
        }
        node.measureInWindow((x, y, w, h) => {
          host.current?.measureInWindow((hx, hy) => place(x, y, w, h, hx, hy));
        });
      },
      expects: (id) => {
        const p = pending.current;
        return !!p && p.id === id && Date.now() - p.at < 800;
      },
      arrive: (id, to, done) => {
        const p = pending.current;
        if (!p || p.id !== id) return false;
        p.to = to;
        p.done = done;
        // Quoi qu'il arrive, la fiche montre sa photo au bout d'une demi-seconde.
        p.guard = setTimeout(finish, 520);
        start();
        return true;
      },
    }),
    [reduced, desktop, start, finish],
  );

  const style = useAnimatedStyle(() => {
    if (!shown) return { opacity: 0 };
    const { from, to } = shown;
    const k = 1 - t.value;
    return {
      opacity: 1,
      transform: [
        { translateX: (from.x + from.w / 2 - (to.x + to.w / 2)) * k },
        // Léger arc : la photo se soulève un peu en chemin.
        {
          translateY:
            (from.y + from.h / 2 - (to.y + to.h / 2)) * k - Math.sin(Math.PI * t.value) * 18,
        },
        { scale: 1 + (from.w / to.w - 1) * k },
      ],
    };
  }, [shown]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <View ref={host} testID="flight" style={[StyleSheet.absoluteFill, styles.host]}>
        {shown && (
          <Animated.View
            style={[
              {
                position: 'absolute',
                left: shown.to.x,
                top: shown.to.y,
                width: shown.to.w,
                height: shown.to.h,
              },
              style,
            ]}
          >
            <Image
              source={shown.image}
              style={StyleSheet.absoluteFill}
              contentFit="contain"
              accessible={false}
            />
          </Animated.View>
        )}
      </View>
    </Ctx.Provider>
  );
}

export const useFlight = () => useContext(Ctx);

const styles = StyleSheet.create({
  host: { pointerEvents: 'none', zIndex: 40 },
});
