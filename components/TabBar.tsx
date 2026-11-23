import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  SharedValue,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { TabId } from '../lib/store';
import { C, F, R, shadow } from '../lib/theme';
import { useFrame } from '../lib/useFrame';
import { tick } from '../lib/haptics';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

type Tab = { id: TabId; label: string; icon: IconName; iconOff: IconName; width: number };

const HOME: Tab = { id: 'home', label: 'Marché', icon: 'home', iconOff: 'home-outline', width: 56 };
const FAVORITES: Tab = {
  id: 'favorites',
  label: 'Favoris',
  icon: 'heart',
  iconOff: 'heart-outline',
  width: 54,
};
const ORDERS: Tab = {
  id: 'orders',
  label: 'Commandes',
  icon: 'receipt',
  iconOff: 'receipt-outline',
  width: 84,
};
const PROFILE: Tab = {
  id: 'profile',
  label: 'Profil',
  icon: 'person',
  iconOff: 'person-outline',
  width: 42,
};

/** Particuliers : un panier que l'on paie. */
const RETAIL_TABS: Tab[] = [
  HOME,
  FAVORITES,
  { id: 'cart', label: 'Panier', icon: 'bag-handle', iconOff: 'bag-handle-outline', width: 50 },
  ORDERS,
  PROFILE,
];

/** Professionnels : des demandes envoyées à l'équipe, puis des commandes prises en charge. */
const PRO_TABS: Tab[] = [
  HOME,
  FAVORITES,
  {
    id: 'requests',
    label: 'Demandes',
    icon: 'document-text',
    iconOff: 'document-text-outline',
    width: 74,
  },
  ORDERS,
  PROFILE,
];

/**
 * Saut direct d'un onglet à un autre (appui sur un bouton) : l'ancien bouton se referme pendant
 * que le nouveau s'étend, sans faire clignoter ceux qui se trouvent entre les deux.
 */
export type TabJump = { from: number; to: number; starts: number[] };

/**
 * Ouverture d'un bouton, de 0 (icône seule) à 1 (étendu, libellé visible), d'après la position
 * continue `p` entre les pages. Pendant un glissement du doigt, elle suit le doigt.
 */
export function tabOpen(i: number, p: number, jump: TabJump | null, count: number) {
  'worklet';
  if (jump && jump.to !== jump.from) {
    const t = Math.min(1, Math.max(0, (p - jump.from) / (jump.to - jump.from)));
    const start = jump.starts[i] ?? 0;
    return start + ((i === jump.to ? 1 : 0) - start) * t;
  }
  const clamped = Math.min(Math.max(p, 0), count - 1);
  return Math.max(0, 1 - Math.abs(clamped - i));
}

/** Dimensions de la barre : elle se resserre sur les écrans étroits pour garder le libellé. */
type Metrics = {
  icon: number;
  itemPad: number;
  gap: number;
  barPad: number;
  font: number;
  padL: number;
  padR: number;
};

const BASE_FONT = 14;
/** Largeur estimée d'un libellé, avant sa mesure réelle à l'écran. */
const estimate = (tab: Tab, font: number) => Math.ceil((tab.width * font) / BASE_FONT) + 2;

function metricsFor(width: number, tabs: Tab[]): Metrics {
  const compact = width < 384;
  const m = compact
    ? { itemPad: 2, gap: 0, barPad: 5, font: 13, padL: 6, padR: 9 }
    : { itemPad: 4, gap: 2, barPad: 6, font: 14, padL: 8, padR: 10 };
  // Le bouton le plus long, une fois étendu, doit tenir avec les autres dans l'écran.
  const widest = Math.max(...tabs.map((t) => estimate(t, m.font))) + m.padL + m.padR;
  const room = width - 16 - 2 * m.barPad - 2 - (tabs.length - 1) * m.gap - widest;
  const icon = Math.max(32, Math.min(40, Math.floor(room / tabs.length) - 2 * m.itemPad));
  return { ...m, icon };
}

function TabItem({
  tab,
  index,
  count,
  progress,
  jump,
  active,
  badge,
  badgeNoun,
  metrics: m,
  onPress,
}: {
  tab: Tab;
  index: number;
  count: number;
  /** Position continue entre les pages : le bouton suit le doigt pendant un glissement. */
  progress: SharedValue<number>;
  jump: SharedValue<TabJump | null>;
  active: boolean;
  badge: number;
  badgeNoun: [string, string];
  metrics: Metrics;
  onPress: () => void;
}) {
  const reduced = useReducedMotion();
  // Largeur réelle du libellé, mesurée une fois : il n'est jamais coupé.
  const [measured, setMeasured] = useState<number | null>(null);
  const textW = measured ?? estimate(tab, m.font);
  const labelW = m.padL + textW + m.padR;

  const open = useDerivedValue(() => tabOpen(index, progress.value, jump.value, count));
  const press = useSharedValue(1);
  const pop = useSharedValue(1);

  // Petit rebond de l'icône quand le bouton devient l'onglet courant (appui ou glissement).
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (!active || reduced) return;
    pop.value = withSequence(
      withTiming(1.16, { duration: 110 }),
      withSpring(1, { damping: 9, stiffness: 260 }),
    );
  }, [active, reduced, pop]);

  const itemStyle = useAnimatedStyle(() => ({
    backgroundColor: `rgba(255,255,255,${0.1 * open.value})`,
    transform: [{ scale: press.value }],
  }));
  // Le bouton s'étend : la fenêtre du libellé s'élargit…
  const clipStyle = useAnimatedStyle(() => ({ width: open.value * labelW }));
  // … et le libellé y glisse en apparaissant.
  const textStyle = useAnimatedStyle(() => ({
    opacity: interpolate(open.value, [0.3, 1], [0, 1], 'clamp'),
    transform: [{ translateX: (open.value - 1) * 12 }],
  }));
  const discStyle = useAnimatedStyle(() => ({
    opacity: open.value,
    transform: [{ scale: (0.55 + 0.45 * open.value) * pop.value }],
  }));
  const onStyle = useAnimatedStyle(() => ({
    opacity: open.value,
    transform: [{ scale: pop.value }],
  }));
  const offStyle = useAnimatedStyle(() => ({ opacity: 1 - open.value }));

  const disc = { width: m.icon, height: m.icon, borderRadius: m.icon / 2 };

  return (
    <Pressable
      onPress={() => {
        tick();
        // Déjà sur cette page : l'icône sursaute quand même, pour confirmer l'appui.
        if (active && !reduced) {
          pop.value = withSequence(
            withTiming(1.2, { duration: 100 }),
            withSpring(1, { damping: 9, stiffness: 260 }),
          );
        }
        onPress();
      }}
      onPressIn={() => {
        press.value = withTiming(0.9, { duration: 80 });
      }}
      onPressOut={() => {
        press.value = withSpring(1, { damping: 11, stiffness: 320 });
      }}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      aria-selected={active}
      accessibilityLabel={
        badge ? `${tab.label}, ${badge} ${badgeNoun[badge > 1 ? 1 : 0]}` : tab.label
      }
    >
      <Animated.View
        style={[
          styles.item,
          { height: Math.max(44, m.icon + 8), paddingHorizontal: m.itemPad },
          itemStyle,
        ]}
      >
        <View style={disc}>
          <Animated.View style={[styles.iconLayer, styles.iconDisc, disc, discStyle]} />
          <Animated.View style={[styles.iconLayer, offStyle]}>
            <Ionicons name={tab.iconOff} size={20} color={C.textDim} />
          </Animated.View>
          <Animated.View style={[styles.iconLayer, onStyle]}>
            <Ionicons name={tab.icon} size={20} color={C.onLeaf} />
          </Animated.View>
          {badge > 0 && (
            <View style={[styles.badge, active && styles.badgeOn]}>
              <Text style={[styles.badgeText, active && { color: C.leaf }]}>
                {badge > 9 ? '9+' : badge}
              </Text>
            </View>
          )}
        </View>
        <Animated.View style={[styles.labelClip, clipStyle]} testID={`tab-label-${tab.id}`}>
          <Animated.View style={[{ width: labelW, paddingLeft: m.padL }, textStyle]}>
            <Text style={[styles.label, { width: textW, fontSize: m.font }]} numberOfLines={1}>
              {tab.label}
            </Text>
          </Animated.View>
        </Animated.View>
        {/* Mesure du libellé, hors écran : sert à dimensionner le bouton étendu. */}
        <View style={styles.measure} aria-hidden>
          <Text
            style={[styles.label, { fontSize: m.font }]}
            onLayout={(e) => {
              const w = Math.ceil(e.nativeEvent.layout.width);
              if (w > 0 && w !== measured) setMeasured(w);
            }}
          >
            {tab.label}
          </Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

export function TabBar({
  tab,
  progress,
  jump,
  onChange,
  cartCount,
  newVideos,
  pro,
}: {
  tab: TabId;
  progress: SharedValue<number>;
  jump: SharedValue<TabJump | null>;
  onChange: (t: TabId) => void;
  cartCount: number;
  /** Vidéos de l'équipe pas encore regardées : compteur posé sur Favoris. */
  newVideos: number;
  pro: boolean;
}) {
  const { bottom, width } = useFrame();
  const tabs = pro ? PRO_TABS : RETAIL_TABS;
  const metrics = metricsFor(width, tabs);
  return (
    <View style={styles.host}>
      <LinearGradient
        colors={['rgba(11,14,9,0)', 'rgba(11,14,9,0.86)', C.bg]}
        locations={[0, 0.55, 1]}
        style={[styles.fade, { height: 120 + bottom }]}
      />
      <View
        style={[
          styles.bar,
          shadow(16, 36, 0.6),
          { marginBottom: bottom + 2, padding: metrics.barPad, gap: metrics.gap },
        ]}
        accessibilityRole="tablist"
      >
        {tabs.map((t, i) => (
          <TabItem
            key={t.id}
            tab={t}
            index={i}
            count={tabs.length}
            progress={progress}
            jump={jump}
            active={tab === t.id}
            metrics={metrics}
            badge={
              t.id === 'favorites'
                ? newVideos
                : t.id === 'cart' || t.id === 'requests'
                  ? cartCount
                  : 0
            }
            badgeNoun={
              t.id === 'favorites'
                ? ['nouvelle vidéo', 'nouvelles vidéos']
                : ['article', 'articles']
            }
            onPress={() => onChange(t.id)}
          />
        ))}
      </View>
    </View>
  );
}

export const TAB_BAR_SPACE = 104;

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    pointerEvents: 'box-none',
  },
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0, pointerEvents: 'none' },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: R.pill,
    backgroundColor: '#1A1F14',
    borderWidth: 1,
    borderColor: C.lineStrong,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: R.pill,
  },
  iconLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconDisc: { backgroundColor: C.leaf },
  labelClip: { overflow: 'hidden' },
  label: { color: C.text, fontFamily: F.bold },
  measure: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 240,
    flexDirection: 'row',
    alignItems: 'flex-start',
    opacity: 0,
    pointerEvents: 'none',
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.leaf,
    borderWidth: 2,
    borderColor: '#1A1F14',
  },
  badgeOn: { backgroundColor: C.onLeaf, borderColor: C.leaf },
  badgeText: { color: C.onLeaf, fontFamily: F.heavy, fontSize: 9.5, lineHeight: 12 },
});
