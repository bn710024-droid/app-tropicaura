import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Glow } from './Glow';
import { PrimaryButton } from './Buttons';
import { C, F } from '../lib/theme';

type Props = {
  title: string;
  body: string;
  cta?: string;
  onPress?: () => void;
  image?: number;
  tint?: string;
};

export function EmptyState({ title, body, cta, onPress, image, tint = C.leafDeep }: Props) {
  return (
    <View style={styles.root}>
      <View style={styles.art}>
        <Glow color={tint} width={260} opacity={0.5} style={{ left: -45, top: -45 }} />
        <Image
          source={image ?? require('../assets/decor/leaf.webp')}
          style={styles.image}
          contentFit="contain"
          accessible={false}
        />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      {cta && onPress && <PrimaryButton label={cta} onPress={onPress} style={styles.cta} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', paddingHorizontal: 32, paddingTop: 36 },
  art: { width: 170, height: 170, alignItems: 'center', justifyContent: 'center' },
  image: { width: 140, height: 140 },
  title: {
    marginTop: 18,
    color: C.text,
    fontFamily: F.display,
    fontSize: 24,
    lineHeight: 30,
    textAlign: 'center',
  },
  body: {
    marginTop: 10,
    color: C.textDim,
    fontFamily: F.medium,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 300,
  },
  cta: { marginTop: 26, alignSelf: 'stretch' },
});
