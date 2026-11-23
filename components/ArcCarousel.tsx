import React, { memo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Extrapolation,
  SharedValue,
  interpolate,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import type { Product } from '../lib/data';

/** Taille plein format d'un visuel (au centre) et hauteur de scène qu'il réclame. */
export type ArcDims = { w: number; h: number; heroH: number };

/** Angle de repos des deux voisins sur le demi-cercle (0° = sommet, 90° = extrémité). */
export const REST_ANGLE = (80 * Math.PI) / 180;
/** Côté d'un voisin au repos, en points. */
export const THUMB = 64;

/** Écart circulaire entre l'élément `i` et la position `p`, ramené dans ]-n/2, n/2]. */
export function ringDelta(i: number, p: number, n: number) {
  'worklet';
  let d = (i - p) % n;
  if (d > n / 2) d -= n;
  if (d <= -n / 2) d += n;
  return d;
}

/** Hauteur de scène interpolée entre les deux produits qui encadrent la position `p`. */
export function ringHeight(heights: number[], p: number) {
  'worklet';
  const n = heights.length;
  const f = Math.floor(p);
  const a = heights[((f % n) + n) % n];
  const b = heights[(((f + 1) % n) + n) % n];
  return a + (b - a) * (p - f);
}

type ItemProps = {
  product: Product;
  index: number;
  count: number;
  dims: ArcDims;
  radius: number;
  progress: SharedValue<number>;
  float: SharedValue<number>;
  centered: boolean;
  /** 1 : caché, le temps que la photo arrive de la carte (transition d'ouverture). */
  cloak?: SharedValue<number>;
  /** Apparition progressive des voisins à l'ouverture. */
  reveal?: SharedValue<number>;
};

const ArcItem = memo(function ArcItem({
  product,
  index,
  count,
  dims,
  radius,
  progress,
  float,
  centered,
  cloak,
  reveal,
}: ItemProps) {
  // Rôle fixé à l'ouverture : seul le produit ouvert attend sa photo.
  const [waits] = useState(centered);
  const thumbScale = THUMB / Math.max(dims.w, dims.h);

  const style = useAnimatedStyle(() => {
    const d = ringDelta(index, progress.value, count);
    const ad = Math.abs(d);
    if (ad > 1.3) {
      return { opacity: 0, zIndex: 2, transform: [{ translateX: 0 }, { translateY: radius }] };
    }
    // Position sur le cercle : le sommet est au centre de la scène.
    const angle = d * REST_ANGLE;
    const c = Math.max(0, 1 - ad * 2); // 1 au centre, 0 dès la mi-course
    const bob = (float.value - 0.5) * c;
    return {
      opacity:
        interpolate(ad, [0, 1, 1.25], [1, 0.92, 0], Extrapolation.CLAMP) *
        (waits ? 1 - (cloak ? cloak.value : 0) : reveal ? reveal.value : 1),
      // Les voisins passent devant le visuel central quand un produit large les frôle.
      zIndex: ad > 0.5 ? 2 : 1,
      transform: [
        { translateX: radius * Math.sin(angle) },
        { translateY: radius * (1 - Math.cos(angle)) + bob * -14 },
        { rotate: `${angle * 0.22 + bob * 0.045}rad` },
        {
          scale: interpolate(
            ad,
            [0, 1, 1.3],
            [1, thumbScale, thumbScale * 0.6],
            Extrapolation.CLAMP,
          ),
        },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: -dims.w / 2,
          top: -dims.h / 2,
          width: dims.w,
          height: dims.h,
        },
        style,
      ]}
    >
      <Image
        source={product.image}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        priority={centered ? 'high' : 'normal'}
        accessible={centered}
        accessibilityLabel={centered ? `Photo : ${product.name} ${product.variety}` : undefined}
      />
    </Animated.View>
  );
});

type Props = {
  ring: Product[];
  dims: ArcDims[];
  heights: number[];
  /** Position continue dans l'anneau : 2,5 = à mi-chemin entre les produits 2 et 3. */
  progress: SharedValue<number>;
  float: SharedValue<number>;
  radius: number;
  /** Ordonnée du haut de la scène ; le centre suit la hauteur interpolée. */
  stageTop: number;
  width: number;
  activeIndex: number;
  cloak?: SharedValue<number>;
  reveal?: SharedValue<number>;
};

/**
 * Carrousel en arc : les produits du rayon voyagent sur un demi-cercle. Celui du sommet
 * est en grand ; ses deux voisins attendent, réduits, près des extrémités de l'arc.
 * Tout est piloté par `progress` et ne touche qu'aux transformations (aucun recalcul
 * de mise en page pendant le geste).
 */
export function ArcCarousel({
  ring,
  dims,
  heights,
  progress,
  float,
  radius,
  stageTop,
  width,
  activeIndex,
  cloak,
  reveal,
}: Props) {
  const anchor = useAnimatedStyle(() => ({
    transform: [{ translateY: stageTop + ringHeight(heights, progress.value) / 2 }],
  }));

  return (
    <Animated.View style={[{ position: 'absolute', left: width / 2, top: 0 }, anchor]}>
      {ring.map((product, i) => {
        // Écart circulaire au produit affiché : on ne monte que lui et ses proches voisins.
        const gap = Math.abs(i - activeIndex);
        if (Math.min(gap, ring.length - gap) > 2) return null;
        return (
          <ArcItem
            key={product.id}
            product={product}
            index={i}
            count={ring.length}
            dims={dims[i]}
            radius={radius}
            progress={progress}
            float={float}
            centered={i === activeIndex}
            cloak={cloak}
            reveal={reveal}
          />
        );
      })}
    </Animated.View>
  );
}
