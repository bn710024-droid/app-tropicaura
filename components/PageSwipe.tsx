import React, { createContext, useContext } from 'react';
import { Platform, StyleProp, View, ViewStyle } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

/**
 * Horodatage du dernier toucher posé sur une zone qui garde ses propres gestes horizontaux
 * (carrousel, liste qui défile de côté, champ de saisie). Le glissement entre les pages
 * principales s'efface devant ces zones.
 */
const Guard = createContext<SharedValue<number> | null>(null);

export const PageSwipeGuardProvider = Guard.Provider;

/** Enveloppe un contenu dont les gestes horizontaux passent avant le changement de page. */
export function KeepsOwnSwipes({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const guard = useContext(Guard);
  return (
    <View
      style={style}
      // On ne prend pas la main : on note seulement que le toucher a commencé ici.
      onStartShouldSetResponderCapture={() => {
        if (guard) guard.value = Date.now();
        return false;
      }}
    >
      {children}
    </View>
  );
}

/**
 * À poser sur le défilement vertical de chaque page principale. Sur le web, il indique au
 * navigateur de ne gérer lui-même que le défilement vertical : les glissements horizontaux
 * restent ainsi disponibles pour passer d'une page à l'autre. Sans effet sur iOS et Android.
 */
export const PAGE_SCROLL = (
  Platform.OS === 'web' ? { touchAction: 'pan-y' } : null
) as ViewStyle | null;
