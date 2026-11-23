import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInRight,
  FadeOut,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { PrimaryButton } from './Buttons';
import { Glow } from './Glow';
import { buildSlides } from './HomeHero';
import { Pressable } from './Tap';
import { RATIO } from '../lib/ratios';
import { C, CLIP, F, R } from '../lib/theme';

const HEIGHT = 420;
const AUTO_MS = 7000;

/**
 * Bandeau d'accueil sur ordinateur : les campagnes de produits, en grand. Le nom du produit
 * s'affiche comme sur une affiche, sa photo voyage sur l'arche pointillée de la marque. Les
 * campagnes se succèdent toutes seules ; le survol, un clic sur une flèche ou sur un repère
 * mettent le défilement en pause.
 */
export function DesktopHero({ width, onOpen }: { width: number; onOpen: (id: string) => void }) {
  const slides = useMemo(buildSlides, []);
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const paused = useRef(false);
  const slide = slides[index % slides.length];

  useEffect(() => {
    if (reduced || slides.length < 2) return;
    const id = setInterval(() => {
      if (!paused.current) setIndex((i) => (i + 1) % slides.length);
    }, AUTO_MS);
    return () => clearInterval(id);
  }, [reduced, slides.length]);

  // La photo flotte doucement, comme dans les fiches produit.
  const float = useSharedValue(0.5);
  useEffect(() => {
    if (reduced) return;
    float.value = withRepeat(
      withTiming(1, { duration: 3800, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [reduced, float]);
  const floatStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: (float.value - 0.5) * -16 },
      { rotate: `${(float.value - 0.5) * 3}deg` },
    ],
  }));

  if (!slide) return null;

  const artW = Math.min(width * 0.46, 560);
  const ratio = RATIO[slide.back.id] ?? 1;
  const imgW = Math.min(artW * 0.82, (HEIGHT - 110) * ratio);
  const imgH = imgW / ratio;
  // L'arche : même motif que sur l'écran d'ouverture, de la gauche du visuel à sa droite.
  const rx = artW * 0.46;
  const ry = HEIGHT * 0.62;
  const cx = artW / 2;
  const base = HEIGHT - 44;
  const dots = Array.from({ length: 31 }, (_, i) => {
    const a = Math.PI * (1 - i / 30);
    return { x: cx + Math.cos(a) * rx, y: base - Math.sin(a) * ry };
  });
  const titleSize = Math.max(64, Math.min(112, (width - artW - 96) / (slide.title.length * 0.5)));

  const go = (next: number) => {
    paused.current = true;
    setIndex((next + slides.length) % slides.length);
  };

  return (
    <View
      style={[styles.card, { width, height: HEIGHT }]}
      // Au survol, les campagnes cessent de défiler : on a le temps de lire.
      {...({
        onMouseEnter: () => {
          paused.current = true;
        },
        onMouseLeave: () => {
          paused.current = false;
        },
      } as object)}
    >
      <LinearGradient
        colors={['#232B16', '#151A10', '#0D110A']}
        locations={[0, 0.55, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Visuel, à droite. */}
      <View style={[styles.art, { width: artW }]}>
        <Animated.View
          key={`glow-${slide.id}`}
          entering={FadeIn.duration(600)}
          exiting={FadeOut.duration(300)}
          style={StyleSheet.absoluteFill}
        >
          <Glow
            color={slide.back.tint}
            width={artW * 1.25}
            height={HEIGHT * 1.3}
            opacity={0.5}
            style={{ left: -artW * 0.125, top: -HEIGHT * 0.15 }}
          />
        </Animated.View>
        {dots.map((d, i) => (
          <View key={i} style={[styles.dot, { left: d.x - 1.5, top: d.y - 1.5 }]} />
        ))}
        <View style={[styles.end, { left: cx - rx - 5, top: base - 5 }]} />
        <View style={[styles.end, styles.endArrival, { left: cx + rx - 5, top: base - 5 }]} />
        <Text style={[styles.place, { left: cx - rx - 12, top: base + 12 }]}>
          {slide.back.origin}
        </Text>
        <Text style={[styles.place, { right: artW - (cx + rx) - 12, top: base + 12 }]}>
          Votre table
        </Text>
        <Animated.View
          key={`img-${slide.id}`}
          entering={reduced ? undefined : FadeInRight.duration(560)}
          exiting={reduced ? undefined : FadeOut.duration(220)}
          style={{
            position: 'absolute',
            left: (artW - imgW) / 2,
            top: (HEIGHT - 30 - imgH) / 2,
            width: imgW,
            height: imgH,
          }}
        >
          <Animated.View style={[StyleSheet.absoluteFill, floatStyle]}>
            <Image
              source={slide.back.image}
              style={StyleSheet.absoluteFill}
              contentFit="contain"
              priority="high"
              accessible={false}
            />
          </Animated.View>
        </Animated.View>
      </View>

      {/* Texte, à gauche. */}
      <Animated.View
        key={`copy-${slide.id}`}
        entering={reduced ? undefined : FadeInDown.duration(460)}
        exiting={reduced ? undefined : FadeOut.duration(160)}
        style={[styles.copy, { right: artW }]}
      >
        <Text style={styles.kicker}>{slide.kicker}</Text>
        <Text
          style={[styles.title, { fontSize: titleSize, lineHeight: titleSize * 0.96 }]}
          accessibilityRole="header"
          numberOfLines={1}
        >
          {slide.title}
        </Text>
        <Text style={[styles.accent, { fontSize: titleSize * 0.5, lineHeight: titleSize * 0.6 }]}>
          {slide.accent}
        </Text>
        <Text style={styles.body}>{slide.body}</Text>
        <PrimaryButton label={slide.cta} onPress={() => onOpen(slide.id)} style={styles.cta} />
      </Animated.View>

      {slides.length > 1 && (
        <View style={styles.pager}>
          <Pressable
            onPress={() => go(index - 1)}
            scaleTo={0.9}
            accessibilityRole="button"
            accessibilityLabel="Campagne précédente"
            style={styles.arrow}
          >
            <Ionicons name="chevron-back" size={18} color={C.text} />
          </Pressable>
          {slides.map((s, i) => (
            <Pressable
              key={s.id}
              onPress={() => go(i)}
              hitSlop={8}
              feedback="none"
              accessibilityRole="button"
              accessibilityState={{ selected: i === index }}
              accessibilityLabel={`Afficher la campagne ${i + 1} sur ${slides.length}`}
              style={[styles.mark, i === index && styles.markOn]}
            />
          ))}
          <Pressable
            onPress={() => go(index + 1)}
            scaleTo={0.9}
            accessibilityRole="button"
            accessibilityLabel="Campagne suivante"
            style={styles.arrow}
          >
            <Ionicons name="chevron-forward" size={18} color={C.text} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 36,
    borderWidth: 1,
    borderColor: 'rgba(168,213,79,0.2)',
    backgroundColor: C.raised,
    ...CLIP,
  },
  art: { position: 'absolute', right: 0, top: 0, bottom: 0 },
  dot: {
    position: 'absolute',
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(245,242,233,0.4)',
  },
  end: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: C.leaf,
    backgroundColor: '#151A10',
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
  copy: { position: 'absolute', left: 56, top: 0, bottom: 0, justifyContent: 'center' },
  kicker: {
    color: C.leaf,
    fontFamily: F.label,
    fontSize: 16,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 10,
    color: C.text,
    fontFamily: F.poster,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  accent: { color: C.leaf, fontFamily: F.posterItalic },
  body: {
    marginTop: 14,
    maxWidth: 440,
    color: C.textDim,
    fontFamily: F.medium,
    fontSize: 17,
    lineHeight: 26,
  },
  cta: { marginTop: 24, alignSelf: 'flex-start', minWidth: 250 },
  pager: {
    position: 'absolute',
    left: 56,
    bottom: 26,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  arrow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surfaceStrong,
    borderWidth: 1,
    borderColor: C.line,
  },
  mark: { width: 8, height: 8, borderRadius: R.pill, backgroundColor: 'rgba(245,242,233,0.3)' },
  markOn: { width: 26, backgroundColor: C.leaf },
});
