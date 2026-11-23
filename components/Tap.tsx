import React, { forwardRef, useState } from 'react';
import {
  GestureResponderEvent,
  PressableProps,
  PressableStateCallbackType,
  Pressable as RNPressable,
  StyleProp,
  View,
  ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(RNPressable);

type Props = PressableProps & {
  /**
   * 'scale' (par défaut) : l'élément s'enfonce légèrement sous le doigt puis revient.
   * 'none' : pas d'effet ajouté, pour les éléments qui ont déjà leur propre animation
   * ou qui ne doivent pas bouger (fond de fenêtre, zones invisibles).
   */
  feedback?: 'scale' | 'none';
  scaleTo?: number;
};

/**
 * Remplace `Pressable` partout dans l'application : même utilisation, avec en plus une réponse
 * immédiate au toucher. L'effet n'attend rien et ne bloque rien : l'action part au relâchement,
 * comme avant. Si le système demande moins d'animations, seul le changement d'opacité reste.
 */
export const Pressable = forwardRef<View, Props>(function Pressable(
  { style, children, onPressIn, onPressOut, feedback = 'scale', scaleTo = 0.97, ...rest },
  ref,
) {
  const [pressed, setPressed] = useState(false);
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const moves = feedback === 'scale' && !reduced;

  const state = { pressed } as PressableStateCallbackType;
  const resolved = (typeof style === 'function' ? style(state) : style) as StyleProp<ViewStyle>;

  return (
    <AnimatedPressable
      ref={ref}
      {...rest}
      onPressIn={(e: GestureResponderEvent) => {
        setPressed(true);
        if (moves) scale.value = withTiming(scaleTo, { duration: 80 });
        onPressIn?.(e);
      }}
      onPressOut={(e: GestureResponderEvent) => {
        setPressed(false);
        if (moves) scale.value = withSpring(1, { damping: 13, stiffness: 300 });
        onPressOut?.(e);
      }}
      style={moves ? [resolved, animated] : resolved}
    >
      {typeof children === 'function' ? children(state) : children}
    </AnimatedPressable>
  );
});
