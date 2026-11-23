import React, { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Glow } from './Glow';
import { RATIO } from '../lib/ratios';
import { C, F } from '../lib/theme';

/**
 * Le convoi : des produits du catalogue, dans l'ordre où ils passent sur l'arche. Ce sont les
 * photos déjà présentes dans l'application, aucune image n'a été ajoutée.
 */
const CONVOY: { id: string; tint: string; image: number }[] = [
  { id: 'mangue', tint: '#D9A93A', image: require('../assets/produce/mangue.webp') },
  { id: 'ananas', tint: '#E3AE3F', image: require('../assets/produce/ananas.webp') },
  { id: 'melon', tint: '#F2A766', image: require('../assets/produce/melon.webp') },
  { id: 'avocat', tint: '#C3CB2C', image: require('../assets/produce/avocat.webp') },
  { id: 'orange', tint: '#F7971F', image: require('../assets/produce/orange.webp') },
];

/** Durée d'une traversée complète de l'arche, du Sénégal à la table. */
const CROSSING_MS = 26000;
/** Les produits cheminent un peu à l'extérieur du pointillé, sur le dos de l'arche. */
const OUTSIDE = 12;
/** Position du convoi quand rien ne bouge (animations réduites) : un produit au sommet. */
const STILL = 0.1;

/** Les trois temps de l'histoire. Ils reprennent ce que fait réellement l'application. */
const CHAPTERS = [
  { n: '01', title: 'Le verger', text: 'Fruits et légumes du Sénégal et d’Afrique.' },
  { n: '02', title: 'La route', text: 'Du Sénégal vers l’international, par avion ou par bateau.' },
  {
    n: '03',
    title: 'La table',
    text: 'La vôtre, ou celle de vos clients : particuliers et professionnels.',
  },
];

type Arch = { cx: number; base: number; rx: number; ry: number };

function Traveller({
  item,
  phase,
  size,
  arch,
  clock,
}: {
  item: (typeof CONVOY)[number];
  phase: number;
  size: number;
  arch: Arch;
  clock: SharedValue<number>;
}) {
  const ratio = RATIO[item.id] ?? 1;
  // Même « poids » à l'œil pour toutes les silhouettes : une mangue large, un ananas haut.
  const w = Math.min(size * 1.3, size * Math.sqrt(ratio));
  const h = Math.min(size * 1.2, w / ratio);

  const style = useAnimatedStyle(() => {
    const u = (clock.value + phase) % 1;
    // De gauche (0) à droite (1) en passant par le sommet de l'arche.
    const angle = Math.PI * (1 - u);
    const lift = Math.sin(Math.PI * u);
    return {
      // Le produit apparaît en quittant le Sénégal et s'efface en arrivant à table.
      opacity: Math.min(1, u / 0.07, (1 - u) / 0.07),
      transform: [
        // Il chemine sur le dos de l'arche, juste à l'extérieur du pointillé : le titre, sous
        // l'arche, reste toujours dégagé.
        { translateX: arch.cx + Math.cos(angle) * (arch.rx + OUTSIDE) },
        { translateY: arch.base - Math.sin(angle) * (arch.ry + OUTSIDE) },
        // Il se redresse en montant : il suit la pente de l'arche.
        { rotate: `${(u - 0.5) * 34}deg` },
        // Il grandit jusqu'au sommet, où il est au plus près, puis s'éloigne.
        { scale: 0.34 + 0.66 * Math.pow(lift, 1.5) },
      ],
    };
  });

  return (
    <Animated.View
      style={[{ position: 'absolute', left: -w / 2, top: -h / 2, width: w, height: h }, style]}
    >
      <Glow
        color={item.tint}
        width={size * 1.9}
        opacity={0.3}
        style={{ left: (w - size * 1.9) / 2, top: (h - size * 1.9) / 2 }}
      />
      <Image
        source={item.image}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        accessible={false}
      />
    </Animated.View>
  );
}

/**
 * Écran d'ouverture : l'histoire de Primeur en une image et trois temps.
 *
 * Une arche pointillée relie le Sénégal à la table. Des produits du catalogue la parcourent
 * lentement, l'un après l'autre : le verger prend le large. L'arche reprend le demi-cercle des
 * fiches produit, qui devient ainsi le motif de la marque. Sous le titre, trois lignes
 * numérotées, composées comme une étiquette de cagette, disent d'où viennent les produits, par
 * où ils passent et à qui ils sont destinés.
 *
 * Seules des transformations et des opacités sont animées. Si le système demande moins
 * d'animations, tout s'affiche immobile, un produit au sommet de l'arche.
 */
export function WelcomeStory({
  width,
  compact,
  tall = false,
}: {
  /** Largeur utile de l'écran. */
  width: number;
  /** Écran haut : l'arche prend un peu plus de place. */
  tall?: boolean;
  /** Écran peu haut : tout se resserre pour que les boutons restent visibles. */
  compact: boolean;
}) {
  const reduced = useReducedMotion();
  const clock = useSharedValue(STILL);

  useEffect(() => {
    if (reduced) return;
    clock.value = withRepeat(
      withTiming(STILL + 1, { duration: CROSSING_MS, easing: Easing.linear }),
      -1,
      false,
    );
  }, [reduced, clock]);

  const stageH = compact ? 204 : tall ? 268 : 244;
  const fruit = compact ? 58 : 70;
  const arch = useMemo<Arch>(() => {
    const rx = Math.min(width / 2 - 40, 176);
    // Le sommet laisse au-dessus de lui la place du plus grand produit.
    return { cx: width / 2, base: stageH - 30, rx, ry: stageH - 30 - fruit * 0.6 - OUTSIDE - 8 };
  }, [width, stageH, fruit]);

  // L'arche : une suite de points, tracée de gauche à droite à l'ouverture.
  const dots = useMemo(
    () =>
      Array.from({ length: 27 }, (_, i) => {
        const a = Math.PI * (1 - i / 26);
        return { x: arch.cx + Math.cos(a) * arch.rx, y: arch.base - Math.sin(a) * arch.ry };
      }),
    [arch],
  );

  // Le titre tient sous l'arche, à l'écart du passage des produits.
  const titleSize = Math.min(compact ? 42 : 50, Math.floor((arch.rx * 2 - 96) / 4.1));
  const appear = (delay: number) => (reduced ? undefined : FadeInDown.delay(delay).duration(420));

  return (
    <View>
      <Animated.View entering={reduced ? undefined : FadeIn.duration(400)} style={styles.head}>
        <Text style={styles.wordmark} accessibilityRole="header">
          Primeur
        </Text>
        <View style={styles.rule} />
        <Text style={styles.strap} numberOfLines={1}>
          Fruits & légumes
        </Text>
      </Animated.View>

      <View
        style={{ width, height: stageH }}
        accessible
        accessibilityRole="image"
        accessibilityLabel="Des fruits et légumes voyagent du Sénégal jusqu’à votre table."
      >
        <Glow
          color={C.leafDeep}
          width={arch.rx * 2.2}
          height={arch.ry * 2.1}
          opacity={0.42}
          style={{ left: arch.cx - arch.rx * 1.1, top: arch.base - arch.ry * 1.45 }}
        />

        {dots.map((d, i) => (
          <Animated.View
            key={i}
            entering={reduced ? undefined : FadeIn.delay(120 + i * 22).duration(220)}
            style={[styles.dot, { left: d.x - 1.5, top: d.y - 1.5 }]}
          />
        ))}

        {/* Les deux bouts de la route. */}
        <View style={[styles.end, { left: arch.cx - arch.rx - 5, top: arch.base - 5 }]} />
        <View
          style={[
            styles.end,
            styles.endArrival,
            { left: arch.cx + arch.rx - 5, top: arch.base - 5 },
          ]}
        />
        <Text style={[styles.place, { left: arch.cx - arch.rx - 14, top: arch.base + 10 }]}>
          Sénégal
        </Text>
        <Text
          style={[
            styles.place,
            styles.placeRight,
            { right: width - (arch.cx + arch.rx) - 14, top: arch.base + 10 },
          ]}
        >
          Votre table
        </Text>

        {/* Le convoi suit le dos de l'arche, à l'écart du titre. */}
        <Animated.View
          entering={reduced ? undefined : FadeIn.delay(500).duration(600)}
          style={styles.convoy}
        >
          {CONVOY.map((item, i) => (
            <Traveller
              key={item.id}
              item={item}
              phase={i / CONVOY.length}
              size={fruit}
              arch={arch}
              clock={clock}
            />
          ))}
        </Animated.View>

        {/* Le titre, sous l'arche comme sous une enseigne. */}
        <View
          style={[styles.title, { top: arch.base - arch.ry + (compact ? 36 : tall ? 58 : 48) }]}
        >
          <Animated.Text
            entering={appear(260)}
            style={[styles.poster, { fontSize: titleSize, lineHeight: titleSize * 0.98 }]}
          >
            Le verger
          </Animated.Text>
          <Animated.Text
            entering={appear(380)}
            style={[styles.script, { fontSize: titleSize * 0.6, lineHeight: titleSize * 0.74 }]}
          >
            prend le large.
          </Animated.Text>
        </View>
      </View>

      <View style={[styles.chapters, compact && { marginTop: 10 }]}>
        {CHAPTERS.map((c, i) => (
          <Animated.View
            key={c.n}
            entering={appear(520 + i * 90)}
            style={[styles.chapter, compact && styles.chapterCompact, i > 0 && styles.chapterLine]}
          >
            <Text style={styles.number}>{c.n}</Text>
            <View style={{ flex: 1 }}>
              <View style={styles.chapterHead}>
                <Text style={styles.chapterTitle}>{c.title}</Text>
                {i === 1 && (
                  <View style={styles.modes}>
                    <Ionicons name="airplane-outline" size={14} color={C.textDim} />
                    <Ionicons name="boat-outline" size={14} color={C.textDim} />
                  </View>
                )}
              </View>
              <Text style={styles.chapterText}>{c.text}</Text>
            </View>
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 22,
    marginBottom: 6,
  },
  wordmark: {
    color: C.text,
    fontFamily: F.poster,
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  rule: { flex: 1, minWidth: 8, height: 1, backgroundColor: C.lineStrong },
  strap: {
    flexShrink: 0,
    color: C.leaf,
    fontFamily: F.label,
    fontSize: 14,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },

  dot: {
    position: 'absolute',
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(245,242,233,0.42)',
  },
  end: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: C.leaf,
    backgroundColor: C.bg,
  },
  endArrival: { backgroundColor: C.leaf },
  place: {
    position: 'absolute',
    color: C.textDim,
    fontFamily: F.label,
    fontSize: 13,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  placeRight: { textAlign: 'right' },

  title: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  poster: {
    color: C.text,
    fontFamily: F.poster,
    letterSpacing: 1,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  script: { color: C.leaf, fontFamily: F.posterItalic, textAlign: 'center' },
  convoy: { position: 'absolute', left: 0, top: 0, pointerEvents: 'none' },

  chapters: { marginTop: 18, paddingHorizontal: 22 },
  chapter: { flexDirection: 'row', gap: 14, paddingVertical: 11 },
  chapterCompact: { paddingVertical: 8 },
  chapterLine: { borderTopWidth: 1, borderTopColor: C.line },
  number: {
    width: 24,
    color: C.leaf,
    fontFamily: F.label,
    fontSize: 17,
    lineHeight: 21,
    letterSpacing: 0.6,
  },
  chapterHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  chapterTitle: {
    color: C.text,
    fontFamily: F.label,
    fontSize: 17,
    lineHeight: 21,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  modes: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chapterText: {
    marginTop: 2,
    color: C.textDim,
    fontFamily: F.medium,
    fontSize: 13.5,
    lineHeight: 19,
  },
});
