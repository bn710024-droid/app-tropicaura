import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable } from './Tap';
import { initials } from '../lib/identity';
import { TabId, useStore } from '../lib/store';
import { C, F, R } from '../lib/theme';
import { DESKTOP_BAR, useFrame } from '../lib/useFrame';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
type Item = { id: TabId; label: string; icon: IconName; iconOff: IconName };

const RETAIL: Item[] = [
  { id: 'home', label: 'Marché', icon: 'home', iconOff: 'home-outline' },
  { id: 'favorites', label: 'Favoris', icon: 'heart', iconOff: 'heart-outline' },
  { id: 'cart', label: 'Panier', icon: 'bag-handle', iconOff: 'bag-handle-outline' },
  { id: 'orders', label: 'Commandes', icon: 'receipt', iconOff: 'receipt-outline' },
  { id: 'profile', label: 'Profil', icon: 'person', iconOff: 'person-outline' },
];
const PRO: Item[] = RETAIL.map((item) =>
  item.id === 'cart'
    ? { id: 'requests', label: 'Demandes', icon: 'document-text', iconOff: 'document-text-outline' }
    : item,
);

function Link({
  item,
  active,
  badge,
  badgeNoun,
  onPress,
}: {
  item: Item;
  active: boolean;
  badge: number;
  badgeNoun: [string, string];
  onPress: () => void;
}) {
  const reduced = useReducedMotion();
  const on = useSharedValue(active ? 1 : 0);
  const hover = useSharedValue(0);
  useEffect(() => {
    on.value = reduced
      ? active
        ? 1
        : 0
      : withSpring(active ? 1 : 0, { damping: 18, stiffness: 220 });
  }, [active, reduced, on]);

  // Le trait vert se déploie sous l'onglet ouvert ; un survol l'annonce en plus discret.
  const line = useAnimatedStyle(() => ({
    opacity: Math.max(on.value, hover.value * 0.45),
    transform: [{ scaleX: 0.2 + 0.8 * Math.max(on.value, hover.value) }],
  }));
  const tint = useAnimatedStyle(() => ({
    backgroundColor: `rgba(255,255,255,${0.09 * on.value + 0.05 * hover.value})`,
  }));

  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => {
        hover.value = withTiming(1, { duration: 140 });
      }}
      onHoverOut={() => {
        hover.value = withTiming(0, { duration: 180 });
      }}
      scaleTo={0.96}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      aria-selected={active}
      accessibilityLabel={
        badge ? `${item.label}, ${badge} ${badgeNoun[badge > 1 ? 1 : 0]}` : item.label
      }
    >
      <Animated.View style={[styles.link, tint]}>
        <Ionicons
          name={active ? item.icon : item.iconOff}
          size={18}
          color={active ? C.leaf : C.textDim}
        />
        <Text style={[styles.linkText, active && styles.linkTextOn]}>{item.label}</Text>
        {badge > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
          </View>
        )}
        <Animated.View style={[styles.line, line]} />
      </Animated.View>
    </Pressable>
  );
}

/**
 * Navigation du haut, sur ordinateur. Elle remplace la barre flottante du téléphone : mêmes
 * cinq destinations, mêmes compteurs, toujours visible, quelle que soit la page ouverte.
 */
export function DesktopBar({ onNavigate }: { onNavigate?: (tab: TabId) => void }) {
  const { account, isPro, tab, cartCount, newVideoCount } = useStore();
  const { width } = useFrame();
  const items = isPro ? PRO : RETAIL;

  return (
    <View style={styles.bar}>
      <View style={[styles.inner, { width }]}>
        <Pressable
          onPress={() => onNavigate?.('home')}
          disabled={!account}
          feedback="none"
          accessibilityRole="link"
          accessibilityLabel="Primeur, retour au marché"
          style={styles.brand}
        >
          <Text style={styles.wordmark}>Primeur</Text>
          <View style={styles.brandRule} />
          <Text style={styles.strap}>Fruits & légumes</Text>
        </Pressable>

        {account && (
          <View style={styles.links} accessibilityRole="tablist">
            {items.map((item) => (
              <Link
                key={item.id}
                item={item}
                active={tab === item.id}
                badge={
                  item.id === 'favorites'
                    ? newVideoCount
                    : item.id === 'cart' || item.id === 'requests'
                      ? cartCount
                      : 0
                }
                badgeNoun={
                  item.id === 'favorites'
                    ? ['nouvelle vidéo', 'nouvelles vidéos']
                    : ['article', 'articles']
                }
                onPress={() => onNavigate?.(item.id)}
              />
            ))}
          </View>
        )}

        {account ? (
          <Pressable
            onPress={() => onNavigate?.('profile')}
            scaleTo={0.97}
            accessibilityRole="button"
            accessibilityLabel={`Compte de ${account.name}, ${isPro ? 'professionnel' : 'particulier'}. Ouvrir le profil`}
            style={styles.account}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials(account.name)}</Text>
            </View>
            <View>
              <Text style={styles.accountName} numberOfLines={1}>
                {account.name}
              </Text>
              <Text style={styles.accountType}>{isPro ? 'Professionnel' : 'Particulier'}</Text>
            </View>
          </Pressable>
        ) : (
          <Text style={styles.origin}>Sénégal · Afrique · international</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: DESKTOP_BAR,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(11,14,9,0.86)',
    borderBottomWidth: 1,
    borderBottomColor: C.line,
    zIndex: 30,
  },
  inner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 24 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  wordmark: {
    color: C.text,
    fontFamily: F.poster,
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  brandRule: { width: 22, height: 1, backgroundColor: C.lineStrong },
  strap: {
    color: C.leaf,
    fontFamily: F.label,
    fontSize: 13.5,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  links: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  link: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 16,
    borderRadius: R.pill,
  },
  linkText: { color: C.textDim, fontFamily: F.semi, fontSize: 14.5 },
  linkTextOn: { color: C.text, fontFamily: F.bold },
  line: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 3,
    height: 2,
    borderRadius: 1,
    backgroundColor: C.leaf,
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.leaf,
  },
  badgeText: { color: C.onLeaf, fontFamily: F.heavy, fontSize: 11, lineHeight: 14 },
  account: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 48,
    paddingLeft: 5,
    paddingRight: 16,
    borderRadius: R.pill,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.surface,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.leaf,
  },
  avatarText: { color: C.onLeaf, fontFamily: F.heavy, fontSize: 13.5 },
  accountName: { maxWidth: 150, color: C.text, fontFamily: F.bold, fontSize: 13.5, lineHeight: 18 },
  accountType: { color: C.textFaint, fontFamily: F.semi, fontSize: 11.5, lineHeight: 15 },
  origin: {
    color: C.textDim,
    fontFamily: F.label,
    fontSize: 13.5,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
});
