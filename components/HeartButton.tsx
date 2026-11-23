import React from 'react';
import { StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { Pressable } from './Tap';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../lib/theme';
import { tick } from '../lib/haptics';

type Props = {
  active: boolean;
  onToggle: () => void;
  name: string;
  size?: number;
  /** 'bare' : icône seule. 'glass' : pastille translucide. */
  variant?: 'bare' | 'glass';
  style?: StyleProp<ViewStyle>;
};

export function HeartButton({ active, onToggle, name, size = 22, variant = 'bare', style }: Props) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const box = variant === 'glass' ? size + 26 : size + 12;

  return (
    <Pressable
      scaleTo={0.84}
      onPress={() => {
        tick();
        scale.value = withSequence(
          withTiming(0.72, { duration: 80 }),
          withSpring(1, { damping: 7, stiffness: 320 }),
        );
        onToggle();
      }}
      hitSlop={variant === 'glass' ? 6 : 10}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={active ? `Retirer ${name} des favoris` : `Ajouter ${name} aux favoris`}
      style={[
        { width: box, height: box, alignItems: 'center', justifyContent: 'center' },
        variant === 'glass' && styles.glass,
        variant === 'glass' && { borderRadius: box / 2 },
        style,
      ]}
    >
      <Animated.View style={animated}>
        <Ionicons
          name={active ? 'heart' : 'heart-outline'}
          size={size}
          color={active ? C.heart : C.text}
        />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  glass: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
});
