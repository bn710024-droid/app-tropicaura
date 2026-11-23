import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Glow } from './Glow';
import type { Photo } from '../lib/data';
import { RATIO } from '../lib/ratios';
import { C, F } from '../lib/theme';

/** Un produit de la commande. `image` vaut null quand sa photo n'est plus disponible. */
export type CelebrationItem = { id: string; name: string; image: Photo | null; tint: string };

/** Affichage de remplacement, discret : la feuille de la marque, jamais un autre produit. */
const LEAF = require('../assets/decor/leaf.webp');

const BADGE = 88;

/**
 * Places des miniatures autour du symbole, de la plus en vue à la plus discrète. Elles se
 * répartissent sur les côtés, là où l'écran est libre : rien ne descend sur le titre.
 * `dx`, `dy` : position par rapport au centre. `phase` : décalage du flottement.
 */
const SLOTS = [
  { dx: -100, dy: -30, size: 42, rotate: -14, phase: 0.0 },
  { dx: 102, dy: -24, size: 40, rotate: 12, phase: 2.1 },
  { dx: -132, dy: 26, size: 30, rotate: 10, phase: 4.0 },
  { dx: 134, dy: 30, size: 32, rotate: -8, phase: 1.2 },
  { dx: -62, dy: -56, size: 24, rotate: 22, phase: 3.1 },
  { dx: 66, dy: 54, size: 26, rotate: -18, phase: 5.2 },
];
type Slot = (typeof SLOTS)[number];

type Entry = { item: CelebrationItem } | { more: number };

/**
 * Qui occupe quelle place. Un à trois produits : six miniatures, réparties entre eux (six
 * mini-mangues pour une commande de mangues). Quatre à six : une miniature chacun. Au-delà :
 * les cinq premiers, puis une pastille « +3 » plutôt qu'un écran surchargé.
 */
function plan(items: CelebrationItem[]): Entry[] {
  const n = items.length;
  if (n === 0) return [];
  if (n > SLOTS.length) {
    const shown = SLOTS.length - 1;
    return [...items.slice(0, shown).map((item) => ({ item })), { more: n - shown }];
  }
  if (n >= 4) return items.map((item) => ({ item }));
  return SLOTS.map((_, i) => ({ item: items[n === 2 ? (i + Math.floor(i / 2)) % 2 : i % n] }));
}

/** Petits éclats qui partent du symbole puis s'éteignent. */
const SPARKS = Array.from({ length: 10 }, (_, i) => ({
  angle: ((i / 10) * 360 + (i % 2 ? 14 : -8)) * (Math.PI / 180),
  reach: 76 + ((i * 37) % 44),
  size: 3 + (i % 3),
  color: i % 5 === 0 ? C.star : i % 2 ? '#E4F5BE' : C.leaf,
}));

function Spark({ spark, t }: { spark: (typeof SPARKS)[number]; t: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const p = t.value;
    const r = BADGE / 2 + 4 + (spark.reach - BADGE / 2) * p;
    return {
      opacity: p <= 0 ? 0 : p < 0.15 ? p / 0.15 : (1 - p) / 0.85,
      transform: [
        { translateX: Math.cos(spark.angle) * r * 1.25 },
        { translateY: Math.sin(spark.angle) * r * 0.8 },
        { scale: 1.2 - 0.6 * p },
      ],
    };
  });
  return (
    <Animated.View
      style={[
        styles.spark,
        {
          left: -spark.size / 2,
          top: -spark.size / 2,
          width: spark.size,
          height: spark.size,
          borderRadius: spark.size / 2,
          backgroundColor: spark.color,
        },
        style,
      ]}
    />
  );
}

/** Onde qui s'élargit derrière le symbole, une seule fois. */
function Ring({ delay }: { delay: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(delay, withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic) }));
  }, [t, delay]);
  const style = useAnimatedStyle(() => ({
    opacity: (1 - t.value) * 0.55,
    transform: [{ scale: 0.7 + t.value * 1.5 }],
  }));
  return <Animated.View style={[styles.ring, style]} />;
}

function Mini({
  entry,
  slot,
  index,
  kx,
  ky,
  ks,
  clock,
  reduced,
}: {
  entry: Entry;
  slot: Slot;
  index: number;
  /** Échelles de la mise en place : largeur, hauteur et taille, selon l'écran. */
  kx: number;
  ky: number;
  ks: number;
  /** Avancement du flottement, de 0 à 1 ; à 1, tout est immobile. */
  clock: SharedValue<number>;
  reduced: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const enter = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) return;
    // Les miniatures partent du symbole l'une après l'autre et se posent avec un léger rebond.
    enter.value = withDelay(
      300 + index * 75,
      withSpring(1, { damping: 12, stiffness: 110, mass: 0.9 }),
    );
  }, [enter, index, reduced]);

  const dx = slot.dx * kx;
  const dy = slot.dy * ky;
  const style = useAnimatedStyle(() => {
    const e = enter.value;
    // Flottement léger qui s'amortit : à la fin, la miniature est exactement à sa place.
    const calm = Math.pow(1 - clock.value, 1.5) * e;
    const a = clock.value * Math.PI * 5 + slot.phase;
    return {
      opacity: Math.max(0, Math.min(1, e * 1.8)),
      transform: [
        { translateX: dx * e + Math.cos(a) * 3 * calm },
        { translateY: dy * e + Math.sin(a) * 6 * calm },
        { rotate: `${slot.rotate - (1 - e) * 70 + Math.sin(a) * 5 * calm}deg` },
        { scale: 0.2 + 0.8 * e },
      ],
    };
  });

  const s = slot.size * ks;

  if ('more' in entry) {
    // Pastille « +3 » : assez grande pour rester lisible, quelle que soit sa place.
    const c = Math.max(30, s);
    return (
      <Animated.View
        style={[styles.mini, { left: -c / 2, top: -c / 2, width: c, height: c }, style]}
      >
        <View style={[styles.more, { borderRadius: c / 2 }]}>
          <Text style={styles.moreText}>+{entry.more}</Text>
        </View>
      </Animated.View>
    );
  }

  const { item } = entry;
  const missing = !item.image || failed;
  // Même « poids » à l'œil pour toutes les silhouettes : un citron large, un ananas haut.
  const ratio = missing ? 0.8 : (RATIO[item.id] ?? 1);
  const w = Math.min(s * 1.35, s * Math.sqrt(ratio));
  const h = Math.min(s * 1.35, w / ratio);

  return (
    <Animated.View style={[styles.mini, { left: -w / 2, top: -h / 2, width: w, height: h }, style]}>
      {!missing && (
        <Glow
          color={item.tint}
          width={s * 1.8}
          opacity={0.34}
          style={{ left: (w - s * 1.8) / 2, top: (h - s * 1.8) / 2 }}
        />
      )}
      <Image
        source={missing ? LEAF : item.image}
        style={[StyleSheet.absoluteFill, missing && styles.fallback]}
        contentFit="contain"
        onError={() => setFailed(true)}
        accessible={false}
      />
    </Animated.View>
  );
}

/**
 * Célébration d'une commande enregistrée : le symbole de confirmation apparaît, une onde et
 * quelques éclats s'en échappent, puis de toutes petites images des produits réellement
 * commandés se déploient autour de lui, flottent un instant et se stabilisent.
 *
 * Tout se joue dans la hauteur de la scène : le titre, le récapitulatif et les boutons ne sont
 * jamais recouverts. Seules des transformations et des opacités sont animées, et tout s'arrête
 * au bout de quelques secondes. Si le système demande moins d'animations, la scène s'affiche
 * directement dans son état final.
 */
export function OrderCelebration({
  items,
  width,
  compact = false,
}: {
  items: CelebrationItem[];
  /** Largeur disponible ; la scène s'y centre. */
  width: number;
  /** Écran peu haut : la scène se resserre pour laisser la place au récapitulatif. */
  compact?: boolean;
}) {
  const reduced = useReducedMotion();
  const entries = useMemo(() => plan(items), [items]);

  const height = compact ? 124 : 148;
  // Les miniatures restent dans l'écran, même étroit, et dans la hauteur de la scène.
  const kx = Math.min(1, (width / 2 - 8) / 150);
  const ky = compact ? 0.8 : 1;
  const ks = compact ? 0.9 : 1;
  const haloW = Math.min(width + 24, 330);
  const haloH = height + 48;

  const pop = useSharedValue(reduced ? 1 : 0);
  const check = useSharedValue(reduced ? 1 : 0);
  const sparks = useSharedValue(0);
  const clock = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) return;
    pop.value = withSpring(1, { damping: 11, stiffness: 150 });
    check.value = withDelay(140, withSpring(1, { damping: 9, stiffness: 200 }));
    sparks.value = withDelay(
      220,
      withTiming(1, { duration: 1000, easing: Easing.out(Easing.cubic) }),
    );
    clock.value = withDelay(1100, withTiming(1, { duration: 5200, easing: Easing.linear }));
  }, [reduced, pop, check, sparks, clock]);

  const haloStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, pop.value * 1.2),
    transform: [{ scale: 0.7 + 0.3 * pop.value }],
  }));
  const badgeStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, pop.value * 1.4),
    transform: [{ scale: 0.5 + pop.value * 0.5 }],
  }));
  const checkStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, check.value * 1.5),
    transform: [{ scale: 0.4 + check.value * 0.6 }, { rotate: `${(1 - check.value) * -18}deg` }],
  }));

  const names = [...new Set(items.map((i) => i.name).filter(Boolean))];
  const label =
    names.length === 0
      ? 'Commande enregistrée'
      : `Commande enregistrée. ${names.length > 1 ? 'Produits' : 'Produit'} : ${
          names.length > 3
            ? `${names.slice(0, 3).join(', ')} et ${names.length - 3} autre${names.length > 4 ? 's' : ''}`
            : names.join(', ')
        }`;

  return (
    <View
      style={{ width, height }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      testID="order-celebration"
    >
      {/* Tout est posé par rapport au centre de la scène. */}
      <View style={[styles.anchor, { left: width / 2, top: height / 2 }]}>
        <Animated.View style={[styles.layer, { left: -haloW / 2, top: -haloH / 2 }, haloStyle]}>
          <Glow
            color={C.leaf}
            width={haloW}
            height={haloH}
            opacity={0.4}
            style={{ position: 'relative' }}
          />
        </Animated.View>

        {!reduced && (
          <>
            <Ring delay={120} />
            <Ring delay={340} />
            {SPARKS.map((spark, i) => (
              <Spark key={i} spark={spark} t={sparks} />
            ))}
          </>
        )}

        {entries.slice(0, SLOTS.length).map((entry, i) => (
          <Mini
            key={i}
            entry={entry}
            slot={SLOTS[i]}
            index={i}
            kx={kx}
            ky={ky}
            ks={ks}
            clock={clock}
            reduced={reduced}
          />
        ))}

        <Animated.View style={[styles.badge, badgeStyle]}>
          <Animated.View style={checkStyle}>
            <Ionicons name="checkmark" size={42} color={C.onLeaf} />
          </Animated.View>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: { position: 'absolute', width: 0, height: 0, pointerEvents: 'none' },
  layer: { position: 'absolute' },
  badge: {
    position: 'absolute',
    left: -BADGE / 2,
    top: -BADGE / 2,
    width: BADGE,
    height: BADGE,
    borderRadius: BADGE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.leaf,
  },
  ring: {
    position: 'absolute',
    left: -BADGE / 2,
    top: -BADGE / 2,
    width: BADGE,
    height: BADGE,
    borderRadius: BADGE / 2,
    borderWidth: 2,
    borderColor: C.leaf,
  },
  spark: { position: 'absolute' },
  mini: { position: 'absolute' },
  fallback: { opacity: 0.55 },
  more: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#20261A',
    borderWidth: 1,
    borderColor: C.lineStrong,
  },
  moreText: { color: C.text, fontFamily: F.heavy, fontSize: 11.5 },
});
