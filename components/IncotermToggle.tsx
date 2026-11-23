import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Pressable } from './Tap';
import type { Incoterm } from '../lib/store';
import { C, F, R } from '../lib/theme';
import { tick } from '../lib/haptics';

export const INCOTERM_HELP: Record<Incoterm, string> = {
  EXW: 'Départ entrepôt : la marchandise est mise à votre disposition chez nous.',
  FOB: 'Chargée au port de départ : la suite du transport et l’assurance sont à votre charge.',
};

/** Version courte, pour les bandeaux où la place manque. */
export const INCOTERM_SHORT: Record<Incoterm, string> = {
  EXW: 'Départ de notre entrepôt',
  FOB: 'Chargée au port de départ',
};

const OPTIONS: Incoterm[] = ['EXW', 'FOB'];

/** Choix du prix affiché dans l'espace professionnel : EXW ou FOB (pas de CIF). */
export function IncotermToggle({
  value,
  onChange,
  style,
}: {
  value: Incoterm;
  onChange: (i: Incoterm) => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.root, style]} accessibilityRole="radiogroup">
      {OPTIONS.map((option) => {
        const on = option === value;
        return (
          <Pressable
            key={option}
            scaleTo={0.93}
            onPress={() => {
              if (on) return;
              tick();
              onChange(option);
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`Prix ${option}. ${INCOTERM_HELP[option]}`}
            style={({ pressed }) => [
              styles.option,
              on && styles.optionOn,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={[styles.text, on && styles.textOn]}>{option}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: R.pill,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.line,
  },
  option: {
    minWidth: 64,
    height: 40,
    paddingHorizontal: 16,
    borderRadius: R.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionOn: { backgroundColor: C.leaf },
  text: { color: C.textDim, fontFamily: F.bold, fontSize: 14, letterSpacing: 0.4 },
  textOn: { color: C.onLeaf, fontFamily: F.heavy },
});
