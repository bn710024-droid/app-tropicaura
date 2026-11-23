import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { C, F, PAD } from '../lib/theme';
import { useFrame } from '../lib/useFrame';

export function TabHeader({
  title,
  accent,
  subtitle,
  right,
}: {
  title: string;
  accent?: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  const { top } = useFrame();
  return (
    <View style={[styles.root, { paddingTop: top + 18 }]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.title} accessibilityRole="header">
          {title}
          {accent ? <Text style={styles.accent}> {accent}</Text> : null}
        </Text>
        {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    paddingHorizontal: PAD,
    paddingBottom: 18,
  },
  title: { color: C.text, fontFamily: F.display, fontSize: 32, lineHeight: 38 },
  accent: { fontFamily: F.displayItalic, color: C.textDim },
  subtitle: {
    marginTop: 6,
    color: C.textDim,
    fontFamily: F.medium,
    fontSize: 14.5,
    lineHeight: 20,
  },
});
