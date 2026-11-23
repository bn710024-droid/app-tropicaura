import React from 'react';
import { FlatList, Linking, StyleSheet, Text, View } from 'react-native';
import { Pressable } from '../components/Tap';
import { useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Backdrop } from '../components/Backdrop';
import { RoundButton } from '../components/Buttons';
import { CREDITS } from '../lib/credits';
import { PRODUCT_BY_ID } from '../lib/data';
import type { Nav } from '../lib/navigation';
import { C, F, PAD, R } from '../lib/theme';
import { useFrame } from '../lib/useFrame';

const LEAF = require('../assets/decor/leaf.webp');

export function CreditsScreen() {
  const nav = useNavigation<Nav>();
  const { top, bottom } = useFrame();

  return (
    <View style={styles.root}>
      <Backdrop />
      <View style={[styles.header, { paddingTop: top + 4 }]}>
        <RoundButton icon="chevron-back" label="Retour" onPress={() => nav.goBack()} />
        <Text style={styles.headerTitle} accessibilityRole="header">
          Crédits photo
        </Text>
        <View style={{ width: 46 }} />
      </View>
      <FlatList
        data={CREDITS}
        keyExtractor={(c) => c.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: PAD, paddingBottom: bottom + 24 }}
        ListHeaderComponent={
          <Text style={styles.intro}>
            Les photographies proviennent de Wikimedia Commons. Elles ont été détourées et recadrées
            pour l’application ; chacune reste sous sa licence d’origine. Touchez une ligne pour
            ouvrir la page source. Polices : Fraunces et Manrope (SIL Open Font License). Contours
            des pays, pour la détection par position : Natural Earth (domaine public). Vidéos de
            démonstration de la rubrique Découvrir : montées à partir de ces mêmes photos.
          </Text>
        }
        renderItem={({ item }) => {
          const p = PRODUCT_BY_ID[item.id];
          return (
            <Pressable
              onPress={() => Linking.openURL(item.url).catch(() => {})}
              accessibilityRole="link"
              accessibilityLabel={`${p?.name ?? 'Feuille décorative'}, photo de ${item.artist}, licence ${item.license}`}
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.65 }]}
            >
              <View style={styles.thumb}>
                <Image
                  source={p?.image ?? LEAF}
                  style={styles.thumbImage}
                  contentFit="contain"
                  accessible={false}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>
                  {p?.name ?? 'Feuille décorative'}
                </Text>
                <Text style={styles.meta} numberOfLines={2}>
                  {item.artist} · {item.license}
                </Text>
              </View>
              <Ionicons name="open-outline" size={17} color={C.textFaint} />
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 10,
  },
  headerTitle: { color: C.text, fontFamily: F.display, fontSize: 20 },
  intro: {
    marginTop: 10,
    marginBottom: 18,
    color: C.textDim,
    fontFamily: F.medium,
    fontSize: 14,
    lineHeight: 22,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 64,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  thumb: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },
  thumbImage: { width: 42, height: 42 },
  name: { color: C.text, fontFamily: F.bold, fontSize: 15 },
  meta: { marginTop: 2, color: C.textDim, fontFamily: F.medium, fontSize: 12.5, lineHeight: 17 },
});
