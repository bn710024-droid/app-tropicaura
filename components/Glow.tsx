import React from 'react';
import { Platform, StyleProp, View, ViewStyle } from 'react-native';

type Props = {
  color: string;
  width: number;
  height?: number;
  opacity?: number;
  style?: StyleProp<ViewStyle>;
};

/** '#RRGGBB' (ou '#RGB') → 'rgba(r,g,b,a)'. */
function rgba(hex: string, alpha: number) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.round(alpha * 1000) / 1000})`;
}

/**
 * Halo radial doux : la « lumière » que chaque produit projette sur l'interface.
 * Simple vue peinte d'un dégradé radial (aucun SVG).
 */
export function Glow({ color, width, height = width, opacity = 0.5, style }: Props) {
  const gradient =
    `radial-gradient(ellipse closest-side, ${rgba(color, opacity)} 0%, ` +
    `${rgba(color, opacity * 0.42)} 45%, ${rgba(color, opacity * 0.12)} 75%, ${rgba(color, 0)} 100%)`;
  const paint = (
    Platform.OS === 'web'
      ? { backgroundImage: gradient }
      : { experimental_backgroundImage: gradient }
  ) as ViewStyle;
  return (
    <View style={[{ position: 'absolute', width, height, pointerEvents: 'none' }, paint, style]} />
  );
}
