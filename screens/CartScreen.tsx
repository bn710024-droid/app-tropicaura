import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { BumpText } from '../components/Motion';
import { Pressable } from '../components/Tap';
import { useNavigation } from '@react-navigation/native';
import Animated, { FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { PrimaryButton } from '../components/Buttons';
import { EmptyState } from '../components/EmptyState';
import { PAGE_SCROLL } from '../components/PageSwipe';
import { Glow } from '../components/Glow';
import { Stepper } from '../components/Stepper';
import { TAB_BAR_SPACE } from '../components/TabBar';
import { TabHeader } from '../components/TabHeader';
import { euro, linePrice, maxQty, qtyLabel, round2, stepperLabel, unitTiny } from '../lib/format';
import type { Nav } from '../lib/navigation';
import { useStore } from '../lib/store';
import { C, F, PAD, R } from '../lib/theme';
import { useToast } from '../lib/toast';
import { useFrame } from '../lib/useFrame';

export function CartScreen() {
  const nav = useNavigation<Nav>();
  const { cartLines, subtotal, byId, setQty, setTab } = useStore();
  const toast = useToast();
  const { bottom, width } = useFrame();
  // Écran étroit : l'unité figure déjà sous le nom (« 0,60 € la pièce »), on ne la répète pas.
  const narrow = width < 360;

  const remove = (id: string, qty: number) => {
    const p = byId[id];
    setQty(id, 0);
    toast(`${p.name} retiré du panier`, {
      icon: 'trash-outline',
      tint: C.textDim,
      action: { label: 'Annuler', onPress: () => setQty(id, qty) },
    });
  };

  return (
    <FlatList
      data={cartLines}
      style={PAGE_SCROLL}
      keyExtractor={(l) => l.id}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: TAB_BAR_SPACE + bottom + 16, flexGrow: 1 }}
      ListHeaderComponent={
        <View>
          <TabHeader
            title="Mon"
            accent="panier"
            subtitle={
              cartLines.length > 0
                ? `${cartLines.length} produit${cartLines.length > 1 ? 's' : ''} prêt${cartLines.length > 1 ? 's' : ''} à partir`
                : undefined
            }
          />
        </View>
      }
      renderItem={({ item, index }) => {
        const p = byId[item.id];
        const atMin = item.qty <= p.step;
        return (
          <Animated.View
            entering={FadeInDown.delay(Math.min(index, 6) * 50).duration(360)}
            exiting={FadeOut.duration(160)}
            layout={LinearTransition.duration(220)}
            style={styles.line}
          >
            <Pressable
              onPress={() => nav.navigate('Product', { id: p.id })}
              accessibilityRole="button"
              accessibilityLabel={`Voir la fiche ${p.name}`}
              style={({ pressed }) => [styles.art, pressed && { opacity: 0.75 }]}
            >
              <Glow color={p.tint} width={84} opacity={0.6} />
              <Image
                source={p.image}
                style={styles.image}
                contentFit="contain"
                accessible={false}
              />
            </Pressable>
            <View style={styles.info}>
              <Pressable
                onPress={() => nav.navigate('Product', { id: p.id })}
                accessibilityRole="button"
                accessibilityLabel={`${p.name}, ${euro(linePrice(p, item.qty))}. Voir la fiche`}
                style={({ pressed }) => [styles.infoTop, pressed && { opacity: 0.7 }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.name} numberOfLines={1}>
                    {p.name}
                  </Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    {euro(p.price)} {unitTiny(p)}
                  </Text>
                </View>
                <BumpText value={linePrice(p, item.qty)} style={styles.lineTotal}>
                  {euro(linePrice(p, item.qty))}
                </BumpText>
              </Pressable>
              <View style={styles.infoBottom}>
                <Stepper
                  compact
                  label={stepperLabel(p, item.qty)}
                  minusRemoves={atMin}
                  canPlus={item.qty < maxQty(p)}
                  onMinus={() =>
                    atMin ? remove(p.id, item.qty) : setQty(p.id, round2(item.qty - p.step))
                  }
                  onPlus={() => setQty(p.id, round2(item.qty + p.step))}
                />
                {p.unit === 'unit' && !narrow && (
                  <Text style={styles.qtyNoun} numberOfLines={1}>
                    {qtyLabel(p, item.qty).replace(/^\d+\s/, '')}
                  </Text>
                )}
              </View>
            </View>
          </Animated.View>
        );
      }}
      ListFooterComponent={
        cartLines.length > 0 ? (
          <View style={styles.footer}>
            <View style={styles.summary}>
              <View style={styles.sumRow}>
                <Text style={styles.sumLabel}>Sous-total</Text>
                <BumpText value={subtotal} style={styles.totalValue}>
                  {euro(subtotal)}
                </BumpText>
              </View>
              <Text style={styles.sumNote}>
                Avec ou sans transport : vous choisissez à l’étape suivante.
              </Text>
            </View>
            <PrimaryButton
              label="Commander"
              trailing={euro(subtotal)}
              onPress={() => nav.navigate('Checkout')}
              style={{ marginTop: 16 }}
            />
          </View>
        ) : null
      }
      ListEmptyComponent={
        <EmptyState
          title="Votre panier est vide"
          body="Un kilo de pommes, une botte de carottes, un bouquet de basilic : commencez par ce qui vous fait envie."
          cta="Parcourir l’étal"
          onPress={() => setTab('home')}
          image={require('../assets/produce/carotte.webp')}
          tint="#B5622A"
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  line: {
    flexDirection: 'row',
    gap: 14,
    marginHorizontal: PAD,
    marginBottom: 12,
    padding: 10,
    borderRadius: R.lg,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.line,
  },
  art: { width: 84, height: 84, alignItems: 'center', justifyContent: 'center' },
  image: { width: 70, height: 70 },
  info: { flex: 1, justifyContent: 'space-between', paddingVertical: 2, paddingRight: 4 },
  infoTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  infoBottom: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  name: { color: C.text, fontFamily: F.bold, fontSize: 16, lineHeight: 21 },
  meta: { marginTop: 1, color: C.textFaint, fontFamily: F.medium, fontSize: 12.5, lineHeight: 17 },
  lineTotal: {
    color: C.text,
    fontFamily: F.heavy,
    fontSize: 16,
    lineHeight: 21,
    fontVariant: ['tabular-nums'],
  },
  qtyNoun: { flexShrink: 1, color: C.textDim, fontFamily: F.semi, fontSize: 13 },

  footer: { paddingHorizontal: PAD, marginTop: 8 },
  summary: {
    padding: 18,
    borderRadius: R.lg,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.line,
    gap: 12,
  },
  sumRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  sumLabel: { color: C.textDim, fontFamily: F.semi, fontSize: 15 },
  sumNote: { color: C.textFaint, fontFamily: F.medium, fontSize: 13, lineHeight: 19 },
  totalValue: { color: C.text, fontFamily: F.heavy, fontSize: 24, fontVariant: ['tabular-nums'] },
});
