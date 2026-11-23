import React from 'react';
import { ActivityIndicator, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { PressableScale } from './PressableScale';
import { C, F, R } from '../lib/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

type PrimaryProps = {
  label: string;
  onPress: () => void;
  trailing?: string;
  icon?: IconName;
  disabled?: boolean;
  /** Action en cours : le bouton montre qu'il travaille et n'accepte pas de second appui. */
  loading?: boolean;
  loadingLabel?: string;
  style?: StyleProp<ViewStyle>;
};

export function PrimaryButton({
  label,
  onPress,
  trailing,
  icon,
  disabled,
  loading,
  loadingLabel,
  style,
}: PrimaryProps) {
  const shown = loading ? (loadingLabel ?? label) : label;
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      scaleTo={0.97}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled || !!loading, busy: !!loading }}
      aria-busy={!!loading}
      accessibilityLabel={trailing && !loading ? `${shown}, ${trailing}` : shown}
      style={[styles.primary, disabled && { opacity: 0.4 }, loading && { opacity: 0.85 }, style]}
    >
      <View style={styles.primaryLeft}>
        {icon && !loading && <Ionicons name={icon} size={19} color={C.onLeaf} />}
        <Text style={styles.primaryText}>{shown}</Text>
      </View>
      {loading ? (
        <View style={styles.spinner}>
          <ActivityIndicator color={C.onLeaf} />
        </View>
      ) : trailing ? (
        <View style={styles.trailing}>
          <Text style={styles.trailingText}>{trailing}</Text>
        </View>
      ) : (
        <Ionicons name="arrow-forward" size={19} color={C.onLeaf} />
      )}
    </PressableScale>
  );
}

type GhostProps = {
  label: string;
  onPress: () => void;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
};

export function GhostButton({ label, onPress, icon, style }: GhostProps) {
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.97}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.ghost, style]}
    >
      {icon && <Ionicons name={icon} size={17} color={C.text} />}
      <Text style={styles.ghostText}>{label}</Text>
    </PressableScale>
  );
}

type RoundProps = {
  icon: IconName;
  onPress: () => void;
  label: string;
  badge?: number;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

export function RoundButton({ icon, onPress, label, badge, size = 46, style }: RoundProps) {
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.92}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={badge ? `${label}, ${badge} article${badge > 1 ? 's' : ''}` : label}
      style={[styles.round, { width: size, height: size, borderRadius: size / 2 }, style]}
    >
      <Ionicons name={icon} size={21} color={C.text} />
      {!!badge && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  primary: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: C.leaf,
    borderRadius: R.pill,
    paddingLeft: 24,
    paddingRight: 8,
    paddingVertical: 8,
  },
  spinner: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  primaryLeft: { flexDirection: 'row', alignItems: 'center', gap: 9, flexShrink: 1 },
  primaryText: { color: C.onLeaf, fontFamily: F.heavy, fontSize: 16 },
  trailing: {
    backgroundColor: C.onLeaf,
    borderRadius: R.pill,
    paddingHorizontal: 16,
    height: 42,
    justifyContent: 'center',
  },
  trailingText: {
    color: C.leaf,
    fontFamily: F.heavy,
    fontSize: 15,
    fontVariant: ['tabular-nums'],
  },
  ghost: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: R.pill,
    borderWidth: 1,
    borderColor: C.lineStrong,
    paddingHorizontal: 20,
  },
  ghostText: { color: C.text, fontFamily: F.bold, fontSize: 15 },
  round: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderWidth: 1,
    borderColor: C.line,
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.leaf,
    borderWidth: 2,
    borderColor: C.bg,
  },
  badgeText: { color: C.onLeaf, fontFamily: F.heavy, fontSize: 10.5, lineHeight: 13 },
});
