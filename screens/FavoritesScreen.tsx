import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Pressable } from '../components/Tap';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { EmptyState } from '../components/EmptyState';
import { PAGE_SCROLL } from '../components/PageSwipe';
import { ProductCard } from '../components/ProductCard';
import { Reels } from '../components/Reels';
import { TAB_BAR_SPACE } from '../components/TabBar';
import { TabHeader } from '../components/TabHeader';
import { addedMessage, inCartLabel } from '../lib/format';
import type { Nav } from '../lib/navigation';
import { useStore } from '../lib/store';
import { C, F, PAD, R } from '../lib/theme';
import { useToast } from '../lib/toast';
import { useFrame } from '../lib/useFrame';
import { tick } from '../lib/haptics';

const GAP = 12;

type View_ = 'favoris' | 'decouvrir';
const VIEWS: { id: View_; label: string }[] = [
  { id: 'favoris', label: 'Mes favoris' },
  { id: 'decouvrir', label: 'Découvrir' },
];

export function FavoritesScreen() {
  const nav = useNavigation<Nav>();
  const { favorites, cart, byId, isPro, tab, newVideoCount, toggleFavorite, addStep, setTab } =
    useStore();
  const focused = useIsFocused();
  // Deux espaces dans l'onglet : les produits gardés, et les vidéos de l'équipe.
  const [view, setView] = useState<View_>('favoris');
  const toast = useToast();
  const { width, top, bottom } = useFrame();
  const cardW = Math.floor((width - PAD * 2 - GAP) / 2);

  const list = useMemo(() => favorites.map((id) => byId[id]).filter(Boolean), [favorites, byId]);

  const open = useCallback(
    (id: string, fly?: boolean) => nav.navigate('Product', fly ? { id, fly: true } : { id }),
    [nav],
  );

  const onFav = useCallback(
    (id: string) => {
      const added = toggleFavorite(id);
      if (!added) {
        toast('Retiré de vos favoris', {
          icon: 'heart-dislike-outline',
          tint: C.textDim,
          action: { label: 'Annuler', onPress: () => toggleFavorite(id) },
        });
      }
    },
    [toggleFavorite, toast],
  );

  const onAdd = useCallback(
    (id: string) => {
      // Plusieurs offres (avion, bateau) : le choix se fait sur la fiche du produit.
      if ((byId[id]?.offers?.length ?? 0) > 1) {
        open(id);
        return;
      }
      const added = addStep(id);
      if (!added) return;
      toast(addedMessage(added.product, added.qty, isPro), {
        image: added.product.image,
        action: {
          label: isPro ? 'Voir la demande' : 'Voir le panier',
          onPress: () => setTab('cart'),
        },
      });
    },
    [addStep, byId, open, isPro, toast, setTab],
  );

  const segments = (
    <View style={styles.segments}>
      {VIEWS.map((v) => {
        const on = v.id === view;
        const count = v.id === 'decouvrir' ? newVideoCount : 0;
        return (
          <Pressable
            key={v.id}
            onPress={() => {
              if (on) return;
              tick();
              setView(v.id);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            aria-pressed={on}
            accessibilityLabel={
              count > 0
                ? `${v.label}, ${count} nouvelle${count > 1 ? 's' : ''} vidéo${count > 1 ? 's' : ''}`
                : v.label
            }
            style={({ pressed }) => [
              styles.segment,
              on && styles.segmentOn,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={[styles.segmentText, on && styles.segmentTextOn]}>{v.label}</Text>
            {count > 0 && (
              <View style={[styles.count, on && styles.countOn]}>
                <Text style={[styles.countText, on && { color: C.leaf }]}>
                  {count > 9 ? '9+' : count}
                </Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );

  // Découvrir : les vidéos de l'équipe, directement, en plein écran. Les deux boutons restent
  // en haut pour revenir aux favoris, et la barre de navigation reste utilisable en bas.
  if (view === 'decouvrir') {
    return (
      <View style={styles.reels}>
        <Reels active={tab === 'favorites' && focused} top={top + 66} />
        <LinearGradient
          colors={['rgba(0,0,0,0.72)', 'rgba(0,0,0,0)']}
          style={[styles.reelsShade, { height: top + 96 }]}
        />
        <View style={[styles.reelsTop, { top: top + 8 }]}>{segments}</View>
      </View>
    );
  }

  const header = (
    <View>
      <TabHeader
        title="Mes"
        accent="favoris"
        subtitle={
          list.length > 0
            ? `${list.length} produit${list.length > 1 ? 's' : ''} gardé${list.length > 1 ? 's' : ''} sous le coude`
            : undefined
        }
      />
      <View style={styles.segmentsWrap}>{segments}</View>
    </View>
  );

  return (
    <FlatList
      data={list}
      style={PAGE_SCROLL}
      keyExtractor={(p) => p.id}
      numColumns={2}
      showsVerticalScrollIndicator={false}
      columnWrapperStyle={styles.column}
      contentContainerStyle={{ paddingBottom: TAB_BAR_SPACE + bottom + 16, flexGrow: 1 }}
      ListHeaderComponent={<View style={{ marginBottom: -6 }}>{header}</View>}
      renderItem={({ item, index }) => (
        <ProductCard
          product={item}
          width={cardW}
          index={index}
          fav
          qty={cart[(item.offers?.length === 1 ? item.offers[0] : item).id] ?? 0}
          cartLabel={inCartLabel(item, cart)}
          onOpen={open}
          onToggleFav={onFav}
          onAdd={onAdd}
        />
      )}
      ListEmptyComponent={
        <View style={{ marginTop: 34 }}>
          <EmptyState
            title="Pas encore de favoris"
            body="Touchez le cœur d’un produit pour le retrouver ici et le recommander en un geste."
            cta={isPro ? 'Parcourir le catalogue' : 'Parcourir l’étal'}
            onPress={() => setTab('home')}
            image={require('../assets/produce/fraise.webp')}
            tint="#B8303A"
          />
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  column: { gap: GAP, paddingHorizontal: PAD, marginBottom: 2 },
  segmentsWrap: { marginHorizontal: PAD, marginBottom: 20 },
  reels: { flex: 1, backgroundColor: '#000000' },
  reelsShade: { position: 'absolute', top: 0, left: 0, right: 0, pointerEvents: 'none' },
  reelsTop: { position: 'absolute', left: PAD, right: PAD },
  segments: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: R.pill,
    backgroundColor: 'rgba(27,31,22,0.92)',
    borderWidth: 1,
    borderColor: C.line,
  },
  segment: {
    flex: 1,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: R.pill,
  },
  segmentOn: { backgroundColor: C.leaf },
  segmentText: { color: C.textDim, fontFamily: F.bold, fontSize: 14.5 },
  segmentTextOn: { color: C.onLeaf, fontFamily: F.heavy },
  count: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.leaf,
  },
  countOn: { backgroundColor: C.onLeaf },
  countText: { color: C.onLeaf, fontFamily: F.heavy, fontSize: 11, lineHeight: 14 },
});
