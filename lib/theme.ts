import { Platform, ViewStyle } from 'react-native';

export const C = {
  bg: '#0B0E09',
  bgDeep: '#060805',
  raised: '#151910',
  sheet: '#161A11',
  surface: 'rgba(255,255,255,0.055)',
  surfaceStrong: 'rgba(255,255,255,0.10)',
  line: 'rgba(255,255,255,0.08)',
  lineStrong: 'rgba(255,255,255,0.16)',
  text: '#F5F2E9',
  textDim: '#B9BDAB',
  textFaint: '#8D927F',
  leaf: '#A8D54F',
  leafDeep: '#7AAA2C',
  leafWash: 'rgba(168,213,79,0.14)',
  onLeaf: '#11180A',
  heart: '#FF5D62',
  star: '#F5C344',
  danger: '#FF8475',
  olive: '#5E4E1F',
  moss: '#33501C',
};

export const F = {
  display: 'Fraunces_600SemiBold',
  displayItalic: 'Fraunces_300Light_Italic',
  medium: 'Manrope_500Medium',
  semi: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  heavy: 'Manrope_800ExtraBold',
  // Voix « étiquette » de Primeur, inspirée des étiquettes de cagette et des bordereaux
  // d'expédition : capitales étroites pour le nom de la marque, les repères et les tampons.
  label: 'BigShoulders_700Bold',
  poster: 'BigShoulders_900Black',
  // L'italique charnue qui répond aux capitales dans les titres de la marque.
  posterItalic: 'Fraunces_900Black_Italic',
};

export const R = { sm: 12, md: 18, lg: 24, xl: 30, pill: 999 };

export const PAD = 20;
export const MAX_WIDTH = 480;

export const shadow = (y = 14, blur = 34, alpha = 0.5) =>
  Platform.select({
    android: { elevation: Math.round(y / 2) },
    default: { boxShadow: `0px ${y}px ${blur}px rgba(0,0,0,${alpha})` },
  }) as object;

const canClip =
  Platform.OS === 'web' &&
  typeof CSS !== 'undefined' &&
  typeof CSS.supports === 'function' &&
  CSS.supports('overflow', 'clip');

/**
 * Coupe ce qui dépasse d'un cadre. Sur le web, quand le navigateur le permet, la coupe se fait
 * sans créer de zone défilable : rien ne peut alors décaler l'écran sur le côté (une saisie dans
 * un champ, par exemple). Ailleurs, c'est le « overflow: hidden » habituel.
 */
export const CLIP = { overflow: canClip ? 'clip' : 'hidden' } as ViewStyle;
