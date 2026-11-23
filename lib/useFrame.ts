import { Platform, ViewStyle, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DESKTOP_WEB } from './config';
import { MAX_WIDTH } from './theme';

/**
 * À partir de cette largeur, dans un navigateur, l'application passe en mise en page
 * « ordinateur ». Tant que `DESKTOP_WEB` est faux (chantier en cours), ce seuil est hors
 * d'atteinte : les grands écrans gardent la colonne « téléphone » centrée.
 */
export const DESKTOP_MIN = DESKTOP_WEB ? 1024 : Infinity;
/** Hauteur de la barre de navigation du haut, sur ordinateur. */
export const DESKTOP_BAR = 76;
/** Largeur maximale du contenu d'une page, et d'une colonne de lecture (formulaires, suivis). */
const PAGE_MAX = 1240;
const COLUMN_MAX = 720;

/**
 * Dimensions utiles à la mise en page.
 *
 * - Téléphone (application ou navigateur) : une colonne, au plus `MAX_WIDTH` de large.
 * - Ordinateur (navigateur large) : `desktop` est vrai. `width` devient la largeur du contenu
 *   d'une page ; `page` et `column` sont les styles qui centrent un contenu dans la fenêtre.
 */
export function useFrame() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  if (Platform.OS === 'web' && width >= DESKTOP_MIN) {
    const pageW = Math.min(width - 64, PAGE_MAX);
    const columnW = Math.min(pageW, COLUMN_MAX);
    return {
      desktop: true,
      wide: false,
      windowWidth: width,
      width: pageW,
      columnW,
      height: height - DESKTOP_BAR,
      top: 8,
      bottom: 16,
      page: { width: pageW, alignSelf: 'center' } as ViewStyle,
      column: { width: columnW, alignSelf: 'center' } as ViewStyle,
    };
  }

  const w = Math.min(width, MAX_WIDTH);
  return {
    desktop: false,
    /** Écran plus large que la colonne de l'application (tablette). */
    wide: width > MAX_WIDTH,
    windowWidth: width,
    width: w,
    columnW: w,
    height,
    top: Math.max(insets.top, 14),
    bottom: Math.max(insets.bottom, 14),
    page: null as ViewStyle | null,
    column: null as ViewStyle | null,
  };
}
