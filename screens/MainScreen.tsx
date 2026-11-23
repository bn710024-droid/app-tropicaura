import React, {
  memo,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  SharedValue,
  cancelAnimation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Backdrop } from '../components/Backdrop';
import { PageSwipeGuardProvider } from '../components/PageSwipe';
import { TabBar, TabJump, tabOpen } from '../components/TabBar';
import { SWIPE_FORWARD } from '../lib/config';
import { TabId, useStore } from '../lib/store';
import { C, CLIP, F } from '../lib/theme';
import { useFrame } from '../lib/useFrame';
import { tick } from '../lib/haptics';
import { CartScreen } from './CartScreen';
import { FavoritesScreen } from './FavoritesScreen';
import { HomeScreen } from './HomeScreen';
import { OrdersScreen } from './OrdersScreen';
import { ProfileScreen } from './ProfileScreen';
import { RequestsScreen } from './RequestsScreen';

const SCREENS: Record<TabId, React.ComponentType> = {
  home: HomeScreen,
  favorites: FavoritesScreen,
  cart: CartScreen,
  requests: RequestsScreen,
  orders: OrdersScreen,
  profile: ProfileScreen,
};

const RETAIL: TabId[] = ['home', 'favorites', 'cart', 'orders', 'profile'];
const PRO: TabId[] = ['home', 'favorites', 'requests', 'orders', 'profile'];

/** Sens du geste (voir lib/config) : -1 = le doigt part vers la gauche pour avancer. */
const DIR = SWIPE_FORWARD;
const SETTLE = { stiffness: 260, damping: 30, mass: 1 };
const CORNER = 30;
const EDGE = 28;

/**
 * Une page du paquet. Les pages sont empilées comme des cartes : celle du dessus suit le doigt
 * et s'écarte, la suivante attend dessous, un peu en retrait et dans l'ombre, puis vient
 * prendre sa place. Seules des transformations sont animées, jamais la mise en page.
 */
const Page = memo(function Page({
  id,
  index,
  count,
  width,
  active,
  near,
  progress,
}: {
  id: TabId;
  index: number;
  count: number;
  width: number;
  active: boolean;
  /** Page affichée ou voisine : elle seule garde un calque prêt pour le geste. */
  near: boolean;
  progress: SharedValue<number>;
}) {
  const Body = SCREENS[id];
  const ref = useRef<View>(null);

  // Web : une page qui n'est pas au premier plan sort de l'ordre de tabulation.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const node = ref.current as unknown as { inert?: boolean } | null;
    if (node) node.inert = !active;
  }, [active]);

  const card = useAnimatedStyle(() => {
    const d = Math.min(Math.max(progress.value, 0), count - 1) - index;
    // Écartée : rangée juste hors de l'écran, déjà peinte, prête à revenir.
    if (d >= 1) return { transform: [{ translateX: width * DIR }, { scale: 1 }] };
    // Plus bas dans le paquet : à sa place, cachée par les cartes du dessus.
    if (d <= -1) return { transform: [{ translateX: 0 }, { scale: 1 }] };
    if (d >= 0) {
      // Carte du dessus : elle part avec le doigt.
      return { transform: [{ translateX: d * width * DIR }, { scale: 1 - 0.035 * d }] };
    }
    // Carte du dessous : elle remonte vers sa place.
    return { transform: [{ translateX: 0.14 * width * d * DIR }, { scale: 1 + 0.085 * d }] };
  });
  const face = useAnimatedStyle(() => {
    const d = Math.min(Math.max(progress.value, 0), count - 1) - index;
    return { borderRadius: interpolate(Math.abs(d), [0, 0.05, 1], [0, CORNER, CORNER], 'clamp') };
  });
  const edge = useAnimatedStyle(() => {
    const d = Math.min(Math.max(progress.value, 0), count - 1) - index;
    return { opacity: d > 0 && d < 1 ? Math.min(1, d * 14) : 0 };
  });

  return (
    <Animated.View
      ref={ref}
      style={[
        styles.page,
        near && styles.pageNear,
        { zIndex: count - index, pointerEvents: active ? 'auto' : 'none' },
        card,
      ]}
      aria-hidden={!active}
      importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}
    >
      <Animated.View style={[styles.edge, DIR > 0 ? { left: -EDGE } : { right: -EDGE }, edge]}>
        <LinearGradient
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.18)']}
          start={{ x: DIR > 0 ? 0 : 1, y: 0 }}
          end={{ x: DIR > 0 ? 1 : 0, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <Animated.View style={[styles.face, face]}>
        <Backdrop />
        <Body />
      </Animated.View>
    </Animated.View>
  );
});

/**
 * Une page sur ordinateur : pas de paquet de cartes ni de glissement. La page demandée apparaît
 * en fondu, avec un léger mouvement ; les autres restent montées (leur défilement est conservé)
 * mais invisibles et hors d'atteinte.
 */
function DesktopPage({ id, active }: { id: TabId; active: boolean }) {
  const Body = SCREENS[id];
  const ref = useRef<View>(null);
  const reduced = useReducedMotion();
  const shown = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    shown.value = reduced
      ? active
        ? 1
        : 0
      : withTiming(active ? 1 : 0, {
          duration: active ? 320 : 140,
          easing: Easing.out(Easing.cubic),
        });
    const node = ref.current as unknown as { inert?: boolean } | null;
    if (node) node.inert = !active;
  }, [active, reduced, shown]);

  const style = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ translateY: (1 - shown.value) * 14 }],
  }));

  return (
    <Animated.View
      ref={ref}
      style={[
        StyleSheet.absoluteFill,
        { zIndex: active ? 2 : 1, pointerEvents: active ? 'auto' : 'none' },
        style,
      ]}
      aria-hidden={!active}
    >
      <Body />
    </Animated.View>
  );
}

export function MainScreen() {
  const { tab, setTab, cartCount, newVideoCount, hydrated, isPro } = useStore();
  const { width, desktop } = useFrame();
  const focused = useIsFocused();
  const order = isPro ? PRO : RETAIL;
  const count = order.length;
  const index = Math.max(0, order.indexOf(tab));

  // Position continue dans le paquet : 1,4 = entre la 2ᵉ et la 3ᵉ page.
  const progress = useSharedValue(index);
  const guard = useSharedValue(0);
  // Saut en cours vers un onglet choisi au doigt dans la barre du bas (voir TabBar).
  const jump = useSharedValue<TabJump | null>(null);
  const downAt = useSharedValue(0);
  const downX = useSharedValue(0);
  const downY = useSharedValue(0);
  const grabX = useSharedValue(0);
  const startP = useSharedValue(0);
  const base = useSharedValue(index);
  const engaged = useSharedValue(false);
  // Deux repères récents (position, instant) pour estimer la vitesse du doigt au lâcher.
  const olderX = useSharedValue(0);
  const olderT = useSharedValue(0);
  const recentX = useSharedValue(0);
  const recentT = useSharedValue(0);
  const lastT = useSharedValue(0);

  // Les pages voisines sont montées peu après l'ouverture, pour être prêtes au premier geste.
  const [seen, setSeen] = useState<Partial<Record<TabId, boolean>>>({ [tab]: true });
  const [warm, setWarm] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setWarm(true), 450);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    setSeen((s) => (s[tab] ? s : { ...s, [tab]: true }));
  }, [tab]);

  const live = useRef({ index, order });
  live.current = { index, order };
  const fromSwipe = useRef<number | null>(null);
  // Vrai entre le début d'un glissement et le prochain appui : sert à ignorer le « clic » que
  // la souris émet en relâchant le glissement, sans jamais avaler un vrai appui.
  const swallowClick = useRef(false);
  const rootRef = useRef<View>(null);

  // Changement d'onglet venu d'ailleurs (barre du bas, bouton « Voir le panier »…) : le paquet
  // rejoint la page en glissant. Si l'écran n'est pas visible, il s'y place directement.
  useEffect(() => {
    if (fromSwipe.current === index) {
      fromSwipe.current = null;
      return;
    }
    fromSwipe.current = null;
    const distance = Math.abs(progress.value - index);
    if (distance < 0.001) return;
    if (!focused) {
      cancelAnimation(progress);
      jump.value = null;
      progress.value = index;
      return;
    }
    // La barre du bas passe directement de l'ancien bouton au nouveau.
    const from = progress.value;
    const before = jump.value;
    jump.value = {
      from,
      to: index,
      starts: live.current.order.map((_, i) => tabOpen(i, from, before, count)),
    };
    progress.value = withTiming(
      index,
      {
        duration: 320 + 90 * Math.max(0, distance - 1),
        easing: Easing.bezier(0.22, 1, 0.36, 1),
      },
      (finished) => {
        'worklet';
        if (finished) jump.value = null;
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const commit = useCallback(
    (target: number) => {
      const { index: current, order: tabs } = live.current;
      if (target === current || !tabs[target]) return;
      fromSwipe.current = target;
      tick();
      // Mise à jour non prioritaire : l'animation de fin de geste garde la main.
      startTransition(() => setTab(tabs[target]));
    },
    [setTab],
  );
  const markSwipe = useCallback(() => {
    swallowClick.current = true;
  }, []);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .manualActivation(true)
        .onTouchesDown((e) => {
          'worklet';
          const t = e.allTouches[0];
          engaged.value = false;
          downAt.value = Date.now();
          downX.value = t.absoluteX;
          downY.value = t.absoluteY;
        })
        .onTouchesMove((e, manager) => {
          'worklet';
          if (engaged.value) return; // le geste est lancé : il va à son terme
          if (e.numberOfTouches !== 1) {
            manager.fail();
            return;
          }
          // Le toucher a commencé sur un carrousel ou un champ : ce geste lui appartient.
          if (guard.value >= downAt.value - 40) {
            manager.fail();
            return;
          }
          const t = e.allTouches[0];
          const dx = t.absoluteX - downX.value;
          const dy = t.absoluteY - downY.value;
          if (Math.abs(dy) > 12 && Math.abs(dy) >= Math.abs(dx)) {
            manager.fail(); // vertical : la page défile
          } else if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.35) {
            manager.activate();
          }
        })
        .onStart((e) => {
          'worklet';
          engaged.value = true;
          jump.value = null;
          cancelAnimation(progress);
          grabX.value = e.translationX;
          startP.value = progress.value;
          base.value = Math.round(Math.min(Math.max(progress.value, 0), count - 1));
          const now = Date.now();
          olderX.value = recentX.value = 0;
          olderT.value = recentT.value = lastT.value = now;
          runOnJS(markSwipe)();
        })
        .onUpdate((e) => {
          'worklet';
          const moved = e.translationX - grabX.value;
          const now = Date.now();
          if (now - recentT.value > 45) {
            olderX.value = recentX.value;
            olderT.value = recentT.value;
            recentX.value = moved;
            recentT.value = now;
          }
          lastT.value = now;
          const raw = startP.value + (DIR * moved) / width;
          const lo = Math.max(0, base.value - 1);
          const hi = Math.min(count - 1, base.value + 1);
          // Aux deux bouts du paquet, la page résiste comme un élastique.
          if (raw < 0) progress.value = raw * 0.22;
          else if (raw > count - 1) progress.value = count - 1 + (raw - (count - 1)) * 0.22;
          else progress.value = Math.min(Math.max(raw, lo), hi);
        })
        .onEnd((e) => {
          'worklet';
          // Vitesse du doigt, en pages par seconde. On la mesure nous-mêmes sur les derniers
          // instants du geste : elle reste juste même si une image a tardé à s'afficher.
          const now = Date.now();
          const moved = e.translationX - grabX.value;
          const paused = now - lastT.value > 120;
          const pxPerSec = paused
            ? 0
            : ((moved - olderX.value) / Math.max(16, now - olderT.value)) * 1000;
          const speed = (DIR * pxPerSec) / width;
          const here = Math.min(Math.max(progress.value, 0), count - 1);
          // Où le geste « veut » aller : sa position, prolongée par son élan.
          const reach = here + Math.min(0.6, Math.max(-0.6, speed * 0.22)) - base.value;
          const step = reach > 0.3 ? 1 : reach < -0.3 ? -1 : 0;
          const target = Math.min(count - 1, Math.max(0, base.value + step));
          progress.value = withSpring(target, { ...SETTLE, velocity: speed });
          runOnJS(commit)(target);
        }),
    [
      count,
      width,
      progress,
      guard,
      downAt,
      downX,
      downY,
      grabX,
      startP,
      base,
      jump,
      engaged,
      olderX,
      olderT,
      recentX,
      recentT,
      lastT,
      commit,
      markSwipe,
    ],
  );

  // Web : souris et pavé tactile.
  useEffect(() => {
    if (Platform.OS !== 'web' || !hydrated) return;
    const el = rootRef.current as unknown as HTMLElement | null;
    if (!el || typeof el.addEventListener !== 'function') return;

    // À la souris, relâcher après un glissement ne doit pas « cliquer » ce qui est sous le pointeur.
    const onClick = (e: Event) => {
      if (!swallowClick.current) return;
      swallowClick.current = false;
      e.stopPropagation();
      e.preventDefault();
    };
    // Tout nouvel appui est un vrai appui : il n'est jamais ignoré.
    let downX = 0;
    let downY = 0;
    const onPointerDown = (e: PointerEvent) => {
      swallowClick.current = false;
      downX = e.clientX;
      downY = e.clientY;
    };
    // Si le pointeur a bougé entre l'appui et le relâchement (glissement, ou appui annulé en
    // s'écartant du bouton), le « clic » qui suit n'est pas un appui : on l'ignore. Passé un
    // court délai, plus rien n'est ignoré (un appui au clavier reste toujours pris en compte).
    const onPointerEnd = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 12) swallowClick.current = true;
      setTimeout(() => {
        swallowClick.current = false;
      }, 120);
    };
    // Pas de « fantôme » d'image arraché pendant un glissement à la souris.
    const onDragStart = (e: Event) => e.preventDefault();

    // Pavé tactile (ou Maj + molette) : un geste horizontal = une page.
    let start = 0;
    let active = false;
    let locked = false;
    let lastAbs = 0;
    let idle: ReturnType<typeof setTimeout> | null = null;
    const scrollsSideways = (target: EventTarget | null) => {
      let node = target as HTMLElement | null;
      while (node && node !== el) {
        if (node.scrollWidth > node.clientWidth + 1) {
          const overflow = getComputedStyle(node).overflowX;
          if (overflow === 'auto' || overflow === 'scroll') return true;
        }
        node = node.parentElement;
      }
      return false;
    };
    const settle = () => {
      idle = null;
      if (active && !locked) {
        // Geste court mais net : on va au bout. Sinon la page revient à sa place.
        const moved = progress.value - start;
        const target = Math.abs(moved) > 0.18 ? start + Math.sign(moved) : start;
        progress.value = withSpring(target, SETTLE);
        if (target !== start) commit(target);
      }
      active = false;
      locked = false;
      lastAbs = 0;
    };
    const onWheel = (e: WheelEvent) => {
      const unit = e.deltaMode === 1 ? 32 : 1;
      const dx = e.deltaX * unit;
      if (Math.abs(dx) <= Math.abs(e.deltaY * unit)) return; // vertical : la page défile
      if (scrollsSideways(e.target)) return; // carrousel ou liste : leur défilement d'abord
      e.preventDefault(); // évite aussi le « retour arrière » du navigateur
      if (idle) clearTimeout(idle);
      idle = setTimeout(settle, 140);
      const abs = Math.abs(dx);
      if (locked) {
        // L'inertie du pavé décroît ; un sursaut signale un nouveau geste.
        if (abs <= lastAbs * 1.6 + 6) {
          lastAbs = abs;
          return;
        }
        locked = false;
        active = false;
      }
      lastAbs = abs;
      const last = live.current.order.length - 1;
      if (!active) {
        active = true;
        jump.value = null;
        cancelAnimation(progress);
        start = Math.round(Math.min(Math.max(progress.value, 0), last));
      }
      // Deux doigts vers la gauche (dx > 0) équivalent à un doigt qui glisse vers la gauche.
      const raw = progress.value - (DIR * dx) / el.clientWidth;
      const next = Math.min(Math.min(last, start + 1), Math.max(Math.max(0, start - 1), raw));
      if (Math.abs(next - start) >= 0.3) {
        locked = true;
        active = false;
        const target = start + Math.sign(next - start);
        progress.value = withSpring(target, SETTLE);
        commit(target);
      } else {
        progress.value = next;
      }
    };

    el.addEventListener('click', onClick, true);
    el.addEventListener('pointerdown', onPointerDown, true);
    el.addEventListener('pointerup', onPointerEnd, true);
    el.addEventListener('pointercancel', onPointerEnd, true);
    el.addEventListener('dragstart', onDragStart);
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('click', onClick, true);
      el.removeEventListener('pointerdown', onPointerDown, true);
      el.removeEventListener('pointerup', onPointerEnd, true);
      el.removeEventListener('pointercancel', onPointerEnd, true);
      el.removeEventListener('dragstart', onDragStart);
      el.removeEventListener('wheel', onWheel);
      if (idle) clearTimeout(idle);
    };
  }, [hydrated, progress, jump, commit]);

  // Au-delà de la première et de la dernière page, tout le paquet cède un peu puis revient.
  const deck = useAnimatedStyle(() => {
    const over = progress.value - Math.min(Math.max(progress.value, 0), count - 1);
    return { transform: [{ translateX: over * width * DIR }] };
  });

  if (!hydrated) {
    return (
      <View style={styles.loading}>
        <Backdrop />
        <Text style={styles.brand}>Primeur</Text>
        <ActivityIndicator color={C.leaf} style={{ marginTop: 18 }} />
        <Text style={styles.loadingText}>On dresse l’étal…</Text>
      </View>
    );
  }

  // Ordinateur : la navigation est dans la barre du haut (voir DesktopBar).
  if (desktop) {
    return (
      <View style={styles.root}>
        <Backdrop />
        {order.map((id) =>
          seen[id] || id === tab ? <DesktopPage key={id} id={id} active={id === tab} /> : null,
        )}
      </View>
    );
  }

  return (
    <PageSwipeGuardProvider value={guard}>
      <GestureDetector gesture={pan} touchAction="pan-y">
        <View ref={rootRef} style={styles.root}>
          {/* Derrière les pages : le même fond qu'elles. Rien de plus sombre n'apparaît
              quand une page se déplace ou arrondit ses coins. */}
          <Backdrop />
          <Animated.View style={[StyleSheet.absoluteFill, deck]}>
            {order.map((id, i) =>
              warm || seen[id] || id === tab ? (
                <Page
                  key={id}
                  id={id}
                  index={i}
                  count={count}
                  width={width}
                  active={id === tab}
                  near={Math.abs(i - index) <= 1}
                  progress={progress}
                />
              ) : null,
            )}
          </Animated.View>
          <TabBar
            tab={tab}
            progress={progress}
            jump={jump}
            onChange={setTab}
            cartCount={cartCount}
            newVideos={newVideoCount}
            pro={isPro}
          />
        </View>
      </GestureDetector>
    </PageSwipeGuardProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg, ...CLIP },
  page: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  // Web : la page affichée et ses voisines gardent leur propre calque, pour un départ de geste
  // sans à-coup. Les autres n'en ont pas : moins de mémoire graphique mobilisée.
  pageNear: Platform.OS === 'web' ? ({ willChange: 'transform' } as object) : {},
  face: {
    flex: 1,
    ...CLIP,
    backgroundColor: C.bg,
    // Safari : sans cela, les coins arrondis ne découpent pas les contenus animés.
    ...(Platform.OS === 'web' ? ({ isolation: 'isolate' } as object) : null),
  },
  edge: { position: 'absolute', top: 0, bottom: 0, width: EDGE, pointerEvents: 'none' },
  loading: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  brand: { color: C.text, fontFamily: F.display, fontSize: 34 },
  loadingText: { marginTop: 12, color: C.textDim, fontFamily: F.semi, fontSize: 14 },
});
