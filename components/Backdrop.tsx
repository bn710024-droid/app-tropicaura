import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Glow } from './Glow';
import { C, CLIP } from '../lib/theme';
import { useFrame } from '../lib/useFrame';

/**
 * Fond d'écran : noir végétal traversé d'une lueur olive, comme un étal éclairé de nuit.
 *
 * La lueur s'éteint avant le bas de l'écran : les barres fixes (navigation, validation) reposent
 * ainsi sur la couleur de base, sans bande plus sombre. Sur un écran plus large que la colonne
 * de l'application, les lueurs tiennent entièrement dans la colonne : elles s'éteignent avant
 * ses bords, qui ne dessinent donc aucune bande.
 */
export function Backdrop({ tint }: { tint?: string }) {
  const frame = useFrame();
  const { height, wide, desktop } = frame;
  // Ordinateur : le fond couvre toute la fenêtre, les lueurs aussi.
  const width = desktop ? frame.windowWidth : frame.width;
  const mainW = desktop ? width * 0.86 : wide ? width : width * 1.7;
  const mossW = desktop ? width * 0.5 : wide ? width * 0.9 : width * 1.2;
  return (
    <View style={[StyleSheet.absoluteFill, styles.root]}>
      <Glow
        color={tint ?? C.olive}
        width={mainW}
        height={height * 0.7}
        opacity={tint ? 0.3 : 0.62}
        style={{ left: (width - mainW) / 2, top: height * 0.12 }}
      />
      <Glow
        color={C.moss}
        width={mossW}
        opacity={0.42}
        style={{ left: desktop ? -mossW * 0.2 : wide ? 0 : -width * 0.55, top: -mossW * 0.42 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { pointerEvents: 'none', backgroundColor: C.bg, ...CLIP },
});
