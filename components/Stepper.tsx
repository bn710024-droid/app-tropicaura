import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { BumpText } from './Motion';
import { Pressable } from './Tap';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C, F, R } from '../lib/theme';
import { tick } from '../lib/haptics';

type Props = {
  label: string;
  onMinus: () => void;
  onPlus: () => void;
  canMinus?: boolean;
  canPlus?: boolean;
  /** Affiche une corbeille à la place du « moins » (dernière unité d'une ligne de panier). */
  minusRemoves?: boolean;
  compact?: boolean;
  labelMinWidth?: number;
  style?: StyleProp<ViewStyle>;
};

export function Stepper({
  label,
  onMinus,
  onPlus,
  canMinus = true,
  canPlus = true,
  minusRemoves = false,
  compact = false,
  labelMinWidth,
  style,
}: Props) {
  const btn = compact ? 34 : 40;
  return (
    <View style={[styles.root, compact && styles.rootCompact, style]}>
      <Pressable
        scaleTo={0.86}
        onPress={() => {
          tick();
          onMinus();
        }}
        disabled={!canMinus}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={minusRemoves ? 'Retirer du panier' : 'Diminuer la quantité'}
        style={({ pressed }) => [
          styles.btn,
          { width: btn, height: btn, borderRadius: btn / 2 },
          pressed && styles.pressed,
          !canMinus && styles.disabled,
        ]}
      >
        <Ionicons
          name={minusRemoves ? 'trash-outline' : 'remove'}
          size={minusRemoves ? 16 : 18}
          color={minusRemoves ? C.danger : C.text}
        />
      </Pressable>
      <BumpText
        value={label}
        amount={1.14}
        style={[
          styles.label,
          compact && styles.labelCompact,
          labelMinWidth != null && { minWidth: labelMinWidth },
        ]}
        numberOfLines={1}
        accessibilityLiveRegion="polite"
      >
        {label}
      </BumpText>
      <Pressable
        scaleTo={0.86}
        onPress={() => {
          tick();
          onPlus();
        }}
        disabled={!canPlus}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel="Augmenter la quantité"
        style={({ pressed }) => [
          styles.btn,
          styles.btnPlus,
          { width: btn, height: btn, borderRadius: btn / 2 },
          pressed && styles.pressed,
          !canPlus && styles.disabled,
        ]}
      >
        <Ionicons name="add" size={18} color={C.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: R.pill,
    padding: 5,
  },
  rootCompact: { padding: 4 },
  btn: { alignItems: 'center', justifyContent: 'center' },
  btnPlus: { backgroundColor: C.surfaceStrong },
  pressed: { opacity: 0.55 },
  disabled: { opacity: 0.3 },
  label: {
    minWidth: 62,
    paddingHorizontal: 4,
    textAlign: 'center',
    color: C.text,
    fontFamily: F.bold,
    fontSize: 15,
    fontVariant: ['tabular-nums'],
  },
  labelCompact: { minWidth: 56, fontSize: 14 },
});
