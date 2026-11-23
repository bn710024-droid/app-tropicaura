import React, { memo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Pressable } from './Tap';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Glow } from './Glow';
import { HeartButton } from './HeartButton';
import { MODE_ICON } from './OfferPicker';
import { useFlight } from '../lib/flight';
import { RATIO } from '../lib/ratios';
import type { Product } from '../lib/data';
import { minQty, priceText, qtyLabel, unitShort, unitTiny } from '../lib/format';
import { C, F, R } from '../lib/theme';
import { thump } from '../lib/haptics';

const LIFT = 54;
const IMG_H = 128;
/** Largeur du duo cœur (33) + espace (2) + « + » (36). */
const ACTIONS_W = 71;
/** Marge de la photo dans la carte : elle est centrée et dépasse toujours du haut de la carte. */
const IMG_PAD = 6;

type Props = {
  product: Product;
  width: number;
  index: number;
  fav: boolean;
  /** Quantité déjà au panier de la ligne que le bouton « + » ajoute. */
  qty: number;
  /** Ce qui est déjà au panier ou dans la demande pour ce produit, en clair. */
  cartLabel?: string | null;
  onOpen: (id: string, fly?: boolean) => void;
  onToggleFav: (id: string) => void;
  onAdd: (id: string) => void;
};

function ProductCardBase({
  product: p,
  width,
  index,
  fav,
  qty,
  cartLabel,
  onOpen,
  onToggleFav,
  onAdd,
}: Props) {
  const pad = width < 160 ? 12 : 14;
  // Carte étroite : le prix prend toute la largeur, les boutons passent dessous.
  const narrow = width < 150;
  // Professionnels : un produit peut se commander par avion, par bateau, ou les deux. Avec
  // plusieurs offres, le « + » ouvre la fiche pour choisir ; sinon il ajoute l'offre unique.
  const offers = p.offers ?? [];
  const modes = offers.map((o) => o.mode).filter((m): m is 'avion' | 'bateau' => !!m);
  const choose = offers.length > 1;
  const target = offers.length === 1 ? offers[0] : p;
  const missing = !!p.noPrice && (p.shownPrice ?? null) === null;
  const flight = useFlight();
  const imageRef = useRef<View>(null);
  const press = useSharedValue(1);
  const addScale = useSharedValue(1);
  const cardStyle = useAnimatedStyle(() => ({ transform: [{ scale: press.value }] }));
  const imageStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - press.value) * -120 }, { scale: 2 - press.value }],
  }));
  const addStyle = useAnimatedStyle(() => ({ transform: [{ scale: addScale.value }] }));

  return (
    <Animated.View
      entering={FadeInDown.delay(index < 6 ? index * 55 : (index % 2) * 60).duration(420)}
      style={{ width }}
    >
      <Animated.View style={cardStyle}>
        {/* Toute la carte est le bouton : la photo, le nom et le prix sont DANS la zone
            tactile, qui ne dépend donc plus d'aucun « passage » des pressions à travers
            des calques (web, iOS et Android se comportent ainsi à l'identique). */}
        <Pressable
          feedback="none"
          onPress={() => {
            flight.depart(p.id, p.image, imageRef.current, RATIO[p.id] ?? 1);
            onOpen(p.id, true);
          }}
          onPressIn={() => {
            press.value = withTiming(0.97, { duration: 100 });
          }}
          onPressOut={() => {
            press.value = withSpring(1, { damping: 14, stiffness: 260 });
          }}
          accessibilityRole="button"
          accessibilityLabel={`${p.name} ${p.variety}, ${priceText(p)}${missing ? '' : ` ${unitShort(p)}`}${modes.length ? `, par ${modes.join(' ou ')}` : ''}`}
          accessibilityHint="Ouvre la fiche produit"
        >
          <View style={[styles.card, { marginTop: LIFT }]}>
            <View style={styles.clip}>
              <LinearGradient
                colors={['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.035)']}
                style={StyleSheet.absoluteFill}
              />
            </View>

            <View style={{ height: IMG_H - LIFT + 8, pointerEvents: 'none' }} />
            <View style={{ paddingHorizontal: pad, paddingBottom: pad }}>
              <View style={{ pointerEvents: 'none' }}>
                <Text style={styles.name} numberOfLines={1}>
                  {p.name}
                </Text>
                <View style={styles.subRow}>
                  <Text style={[styles.sub, !!cartLabel && styles.subInCart]} numberOfLines={1}>
                    {cartLabel ?? p.origin}
                  </Text>
                  {/* Professionnels : modes de transport proposés pour ce produit. */}
                  {!cartLabel &&
                    modes.map((mode) => (
                      <Ionicons key={mode} name={MODE_ICON[mode]} size={14} color={C.textDim} />
                    ))}
                </View>
              </View>
              <View style={[styles.bottom, narrow && styles.bottomNarrow]}>
                <View style={{ pointerEvents: 'none', flexShrink: 1 }}>
                  <Text
                    style={[styles.price, missing && styles.priceMissing]}
                    numberOfLines={missing ? 2 : 1}
                  >
                    {priceText(p)}
                  </Text>
                  {!missing && (
                    <Text style={styles.unit} numberOfLines={1}>
                      {unitTiny(p)}
                    </Text>
                  )}
                </View>
              </View>
            </View>
          </View>

          {/* Halo de couleur derrière la photo : entier, jamais coupé par le bord de la carte. */}
          <Glow
            color={p.tint}
            width={width - 4}
            height={IMG_H + 14}
            opacity={0.42}
            style={{ left: 2, top: -7 }}
          />
          <Animated.View
            ref={imageRef}
            style={[
              {
                position: 'absolute',
                top: 0,
                left: IMG_PAD,
                width: width - IMG_PAD * 2,
                height: IMG_H,
              },
              { pointerEvents: 'none' },
              imageStyle,
            ]}
          >
            <Image
              source={p.image}
              style={StyleSheet.absoluteFill}
              contentFit="contain"
              accessible={false}
            />
          </Animated.View>
        </Pressable>

        {/* Cœur et « + » : au-dessus de la carte, hors du bouton principal. */}
        <View style={[styles.actions, { right: pad + 1, bottom: pad + 1 }]}>
          <HeartButton active={fav} onToggle={() => onToggleFav(p.id)} name={p.name} size={21} />
          <Pressable
            scaleTo={0.86}
            onPress={() => {
              thump();
              addScale.value = withSequence(
                withTiming(0.8, { duration: 80 }),
                withSpring(1, { damping: 8, stiffness: 320 }),
              );
              onAdd(p.id);
            }}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={
              choose
                ? `Choisir ${modes.join(' ou ')} pour ${p.name}`
                : `Ajouter ${qtyLabel(target, qty > 0 ? target.step : minQty(target))} de ${p.name}${target.mode ? ` par ${target.mode}` : ''} ${p.pro ? 'à la demande' : 'au panier'}`
            }
          >
            <Animated.View style={[styles.add, addStyle]}>
              <Ionicons name="add" size={22} color={C.onLeaf} />
            </Animated.View>
          </Pressable>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

export const ProductCard = memo(ProductCardBase);

const styles = StyleSheet.create({
  card: {
    borderRadius: R.xl,
    borderWidth: 1,
    borderColor: C.line,
  },
  clip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: R.xl - 1,
    overflow: 'hidden',
    pointerEvents: 'none',
  },
  name: { color: C.text, fontFamily: F.bold, fontSize: 16, lineHeight: 21 },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  sub: { flexShrink: 1, color: C.textFaint, fontFamily: F.medium, fontSize: 12.5, lineHeight: 17 },
  priceMissing: { fontSize: 13, lineHeight: 17, color: C.star },
  subInCart: { color: C.leaf, fontFamily: F.bold },
  // La rangée du prix réserve à droite la place du cœur et du « + ».
  bottom: {
    marginTop: 12,
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: ACTIONS_W,
  },
  bottomNarrow: { paddingRight: 0, paddingBottom: 42, alignItems: 'flex-start' },
  price: {
    color: C.text,
    fontFamily: F.heavy,
    fontSize: 16.5,
    lineHeight: 21,
    fontVariant: ['tabular-nums'],
  },
  unit: { color: C.textFaint, fontFamily: F.medium, fontSize: 11.5, lineHeight: 15 },
  actions: {
    position: 'absolute',
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    pointerEvents: 'box-none',
  },
  add: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.leaf,
  },
});
