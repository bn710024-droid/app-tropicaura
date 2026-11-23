import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { C, F } from '../lib/theme';

/**
 * Emplacement du logo de la marque, en haut à gauche de l'accueil.
 *
 * Pour l'afficher : déposez le fichier dans assets/images/ puis remplacez `null`
 * par `require('../assets/images/logo.png')`. Le logo est ajusté sans déformation
 * dans l'emplacement (prévoir un PNG ou WebP à fond transparent, lisible sur fond sombre).
 */
const LOGO: number | null = null;

export const LOGO_HEIGHT = 48;

export function BrandLogo({ width }: { width: number }) {
  if (LOGO != null) {
    return (
      <Image
        source={LOGO}
        style={{ width, height: LOGO_HEIGHT }}
        contentFit="contain"
        contentPosition="left"
        accessibilityRole="image"
        accessibilityLabel="Logo de la marque"
      />
    );
  }
  return (
    <View
      style={[styles.slot, { width }]}
      accessible
      accessibilityLabel="Emplacement réservé au logo de la marque"
    >
      <Text style={styles.label} numberOfLines={1}>
        Logo
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    height: LOGO_HEIGHT,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: C.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: C.textFaint,
    fontFamily: F.bold,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
});
