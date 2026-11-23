import React, { useEffect, useRef } from 'react';
import { StyleProp, StyleSheet, Text, TextStyle, ViewStyle } from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { C, F } from '../lib/theme';

/**
 * Petit sursaut quand une valeur change (montant, quantité, statut) : l'œil voit ce qui vient
 * de bouger. La valeur, elle, est affichée tout de suite ; l'effet ne retarde rien.
 */
export function Bump({
  value,
  children,
  style,
  amount = 1.08,
}: {
  value: string | number;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  amount?: number;
}) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (reduced) return;
    scale.value = withSequence(
      withTiming(amount, { duration: 90 }),
      withSpring(1, { damping: 11, stiffness: 260 }),
    );
  }, [value, reduced, amount, scale]);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}

/** Même effet, directement sur un texte (montants, quantités) : la mise en page ne change pas. */
export function BumpText({
  value,
  children,
  style,
  amount = 1.08,
  ...rest
}: React.ComponentProps<typeof Text> & { value: string | number; amount?: number }) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (reduced) return;
    scale.value = withSequence(
      withTiming(amount, { duration: 90 }),
      withSpring(1, { damping: 11, stiffness: 260 }),
    );
  }, [value, reduced, amount, scale]);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.Text {...rest} style={[style, animated]}>
      {children}
    </Animated.Text>
  );
}

/** Message d'erreur : il apparaît avec un léger mouvement et il est annoncé aux lecteurs d'écran. */
export function ErrorText({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <Animated.View entering={FadeInDown.duration(180)}>
      <Text
        style={[styles.error, style]}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
      >
        {children}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  error: {
    marginTop: 8,
    paddingHorizontal: 4,
    color: C.danger,
    fontFamily: F.semi,
    fontSize: 13.5,
    lineHeight: 19,
  },
});
