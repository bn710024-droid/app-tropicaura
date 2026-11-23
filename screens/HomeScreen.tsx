import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Platform, StyleSheet, Text, View } from 'react-native';
import { Pressable } from '../components/Tap';
import { TextInput } from '../components/Input';
import { useNavigation } from '@react-navigation/native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BrandLogo } from '../components/BrandLogo';
import { RoundButton } from '../components/Buttons';
import { EmptyState } from '../components/EmptyState';
import { Glow } from '../components/Glow';
import { DesktopHero } from '../components/DesktopHero';
import { HomeHero } from '../components/HomeHero';
import { INCOTERM_SHORT, IncotermToggle } from '../components/IncotermToggle';
import { KeepsOwnSwipes, PAGE_SCROLL } from '../components/PageSwipe';
import { PressableScale } from '../components/PressableScale';
import { ProductCard } from '../components/ProductCard';
import { TAB_BAR_SPACE } from '../components/TabBar';
import { FILTERS, FilterId, PRODUCT_BY_ID, Photo, Product } from '../lib/data';
import {
  MONTHS,
  addedMessage,
  currentMonth,
  inCartLabel,
  isAllYear,
  isInSeason,
  normalize,
  priceText,
  proRulesText,
  unitTiny,
} from '../lib/format';
import type { Nav } from '../lib/navigation';
import { RATIO } from '../lib/ratios';
import { useStore } from '../lib/store';
import { C, F, PAD, R } from '../lib/theme';
import { useToast } from '../lib/toast';
import { useFrame } from '../lib/useFrame';
import { tick } from '../lib/haptics';

const GAP = 12;
const LOGO_GAP = 10;

/** Photo de chaque rayon. « De saison » montre un produit réellement de saison ce mois-ci. */
const SEASON_PHOTO =
  ['kaki', 'abricot', 'radis', 'potimarron'].find((id) => isInSeason(PRODUCT_BY_ID[id])) ?? 'kaki';

const photo = (id: string) => ({ source: PRODUCT_BY_ID[id].image, ratio: RATIO[id] ?? 1 });

const FILTER_PHOTO: Record<FilterId, { source: Photo; ratio: number }> = {
  tout: { source: require('../assets/categories/tout.webp'), ratio: 1.018 },
  saison: photo(SEASON_PHOTO),
  fruits: photo('pomme'),
  legumes: photo('brocoli'),
  agrumes: photo('orange'),
  rouges: photo('cerise'),
  exotiques: photo('kiwi'),
  aromates: photo('basilic'),
};

/** Taille d'affichage à « poids visuel » constant, quelle que soit la silhouette. */
function photoSize(ratio: number) {
  const w = Math.min(50, 38 * Math.sqrt(ratio));
  return { width: Math.round(w), height: Math.round(w / ratio) };
}

function SeasonCard({ product: p, onPress }: { product: Product; onPress: () => void }) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${p.name} ${p.variety}, de saison, ${priceText(p)} ${unitTiny(p)}`}
      style={styles.seasonCard}
    >
      <View style={styles.seasonArt}>
        <Glow color={p.tint} width={76} opacity={0.6} />
        <Image
          source={p.image}
          style={styles.seasonImage}
          contentFit="contain"
          accessible={false}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.seasonName} numberOfLines={1}>
          {p.name}
        </Text>
        <Text style={styles.seasonOrigin} numberOfLines={1}>
          {p.origin}
        </Text>
        <Text style={styles.seasonPrice} numberOfLines={1}>
          {priceText(p)} <Text style={styles.seasonUnit}>{unitTiny(p)}</Text>
        </Text>
      </View>
    </PressableScale>
  );
}

export function HomeScreen() {
  const nav = useNavigation<Nav>();
  const {
    favorites,
    cart,
    cartCount,
    catalog,
    isPro,
    incoterm,
    setIncoterm,
    toggleFavorite,
    addStep,
    byId,
    rules,
    usesModes,
    setTab,
  } = useStore();
  const toast = useToast();
  const { width, top, bottom, desktop, page } = useFrame();
  const [filter, setFilter] = useState<FilterId>('tout');
  const [query, setQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  const month = currentMonth();
  // Téléphone : deux colonnes. Ordinateur : autant de colonnes que la page en accueille.
  const gap = desktop ? 18 : GAP;
  const cols = desktop ? Math.max(3, Math.floor((width - PAD * 2 + gap) / (232 + gap))) : 2;
  const cardW = Math.floor((width - PAD * 2 - gap * (cols - 1)) / cols);
  const searching = query.trim().length > 0;

  // En saisie, la recherche prend toute la largeur : l'emplacement du logo se replie.
  const logoW = width < 350 ? 64 : 88;
  const searchWide = searchFocused || searching;
  const roomy = width >= 390;
  const logoOpen = useSharedValue(1);
  useEffect(() => {
    logoOpen.value = withTiming(searchWide ? 0 : 1, { duration: 200 });
  }, [searchWide, logoOpen]);
  const logoStyle = useAnimatedStyle(() => ({
    width: (logoW + LOGO_GAP) * logoOpen.value,
    opacity: logoOpen.value,
  }));

  // Produits de saison d'abord, puis le reste, dans l'ordre de l'étal.
  const stall = useMemo(
    () => [...catalog].sort((a, b) => Number(isInSeason(b)) - Number(isInSeason(a))),
    [catalog],
  );
  // Seuls les rayons qui ont des produits dans cet espace sont proposés.
  const filters = useMemo(
    () =>
      FILTERS.filter(
        (f) =>
          f.id === 'tout' ||
          (f.id === 'saison'
            ? catalog.some((p) => isInSeason(p))
            : // Pas de familles de produits dans l'espace professionnel.
              !isPro && catalog.some((p) => p.category === f.id)),
      ),
    [catalog, isPro],
  );

  const list = useMemo(() => {
    const q = normalize(query);
    return stall.filter((p) => {
      if (filter === 'saison' && !isInSeason(p)) return false;
      if (filter !== 'tout' && filter !== 'saison' && p.category !== filter) return false;
      if (!q) return true;
      return normalize(`${p.name} ${p.variety} ${p.origin}`).includes(q);
    });
  }, [stall, filter, query]);

  const seasonal = useMemo(() => catalog.filter((p) => isInSeason(p) && !isAllYear(p)), [catalog]);

  const open = useCallback(
    (id: string, fly?: boolean) => nav.navigate('Product', fly ? { id, fly: true } : { id }),
    [nav],
  );

  const onFav = useCallback(
    (id: string) => {
      const added = toggleFavorite(id);
      if (added) toast('Ajouté à vos favoris', { icon: 'heart', tint: C.heart });
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

  const activeFilter = FILTERS.find((f) => f.id === filter)!;
  const sectionTitle = searching
    ? 'Résultats'
    : filter === 'tout'
      ? isPro
        ? 'Catalogue professionnel'
        : 'Tout l’étal'
      : filter === 'saison'
        ? `De saison en ${MONTHS[month - 1]}`
        : activeFilter.label;

  const searchField = (
    <KeepsOwnSwipes style={[styles.search, searchFocused && styles.searchFocused]}>
      <Ionicons name="search" size={19} color={C.textFaint} />
      <TextInput
        focusRing={false}
        value={query}
        onChangeText={setQuery}
        placeholder={
          roomy && searchWide
            ? 'Mangue, melon, Sénégal…'
            : roomy || searchWide
              ? 'Mangue, melon…'
              : 'Rechercher'
        }
        placeholderTextColor={C.textFaint}
        style={styles.searchInput}
        returnKeyType="search"
        onFocus={() => setSearchFocused(true)}
        onBlur={() => setSearchFocused(false)}
        autoCorrect={false}
        autoCapitalize="none"
        accessibilityLabel="Rechercher un fruit ou un légume"
      />
      {searching && (
        <Pressable
          scaleTo={0.85}
          onPress={() => setQuery('')}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Effacer la recherche"
        >
          <Ionicons name="close-circle" size={21} color={C.textDim} />
        </Pressable>
      )}
    </KeepsOwnSwipes>
  );

  const header = (
    <View>
      {desktop ? (
        // Ordinateur : la marque, le panier et le compte sont dans la barre du haut.
        !searching && (
          <View style={[styles.hero, { marginTop: 26 }]}>
            <DesktopHero width={width - PAD * 2} onOpen={open} />
          </View>
        )
      ) : (
        <>
          <View style={[styles.topBar, { paddingTop: top + 8 }]}>
            <Animated.View style={[styles.logoWrap, logoStyle]}>
              <BrandLogo width={logoW} />
            </Animated.View>
            {searchField}
            <RoundButton
              icon={isPro ? 'document-text-outline' : 'bag-handle-outline'}
              label={isPro ? 'Ouvrir ma demande en cours' : 'Ouvrir le panier'}
              badge={cartCount}
              onPress={() => setTab('cart')}
              size={48}
            />
          </View>

          {/* Pendant une recherche, la bannière s'efface pour laisser les résultats sous la barre. */}
          {!searching && (
            <KeepsOwnSwipes style={styles.hero}>
              <HomeHero width={width - PAD * 2} onOpen={open} />
            </KeepsOwnSwipes>
          )}
        </>
      )}

      {isPro && !searching && (
        <View style={styles.proBar}>
          <View style={{ flex: 1 }}>
            <Text style={styles.proTitle}>Prix de gros</Text>
            <Text style={styles.proHelp}>{proRulesText(rules, usesModes)}</Text>
            <Text style={styles.proHelp}>
              {incoterm} : {INCOTERM_SHORT[incoterm].toLowerCase()}
            </Text>
          </View>
          <IncotermToggle value={incoterm} onChange={setIncoterm} />
        </View>
      )}

      <KeepsOwnSwipes>
        <FlatList
          horizontal
          data={filters}
          keyExtractor={(f) => f.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
          renderItem={({ item: f }) => {
            const on = f.id === filter;
            return (
              <Pressable
                scaleTo={0.93}
                onPress={() => {
                  tick();
                  setFilter(f.id);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`Rayon ${f.label}`}
                style={({ pressed }) => [styles.filter, pressed && { opacity: 0.7 }]}
              >
                <View style={[styles.filterIcon, on && styles.filterIconOn]}>
                  <Image
                    source={FILTER_PHOTO[f.id].source}
                    style={photoSize(FILTER_PHOTO[f.id].ratio)}
                    contentFit="contain"
                    accessible={false}
                  />
                </View>
                <Text style={[styles.filterLabel, on && styles.filterLabelOn]} numberOfLines={1}>
                  {f.label}
                </Text>
              </Pressable>
            );
          }}
        />
      </KeepsOwnSwipes>

      {filter === 'tout' && !searching && seasonal.length > 0 && (
        <View>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle} accessibilityRole="header">
              En ce moment
            </Text>
            <View style={styles.monthChip}>
              <Text style={styles.monthChipText}>{MONTHS[month - 1]}</Text>
            </View>
          </View>
          <KeepsOwnSwipes>
            <FlatList
              horizontal
              data={seasonal}
              keyExtractor={(p) => p.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.seasonList}
              renderItem={({ item }) => <SeasonCard product={item} onPress={() => open(item.id)} />}
            />
          </KeepsOwnSwipes>
        </View>
      )}

      <View style={[styles.sectionHead, { marginBottom: 2 }]}>
        <Text style={styles.sectionTitle} accessibilityRole="header">
          {sectionTitle}
        </Text>
        <Text style={styles.count}>
          {list.length} produit{list.length > 1 ? 's' : ''}
        </Text>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={list}
        style={PAGE_SCROLL}
        keyExtractor={(p) => p.id}
        numColumns={2}
        ListHeaderComponent={header}
        columnWrapperStyle={styles.column}
        contentContainerStyle={{ paddingBottom: TAB_BAR_SPACE + bottom + 16 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={8}
        renderItem={({ item, index }) => (
          <ProductCard
            product={item}
            width={cardW}
            index={index}
            fav={favorites.includes(item.id)}
            qty={cart[(item.offers?.length === 1 ? item.offers[0] : item).id] ?? 0}
            cartLabel={inCartLabel(item, cart)}
            onOpen={open}
            onToggleFav={onFav}
            onAdd={onAdd}
          />
        )}
        ListEmptyComponent={
          <View style={{ marginTop: 30 }}>
            <EmptyState
              title="Rien à ce nom-là"
              body={
                searching
                  ? `Aucun produit ne correspond à « ${query.trim()} » dans ce rayon. Essayez un autre mot ou parcourez tout l’étal.`
                  : 'Ce rayon est vide pour le moment.'
              }
              cta="Voir tout l’étal"
              onPress={() => {
                setQuery('');
                setFilter('tout');
              }}
            />
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: PAD,
  },
  logoWrap: { height: 48, overflow: 'hidden' },

  hero: { paddingHorizontal: PAD, marginTop: 18 },
  proBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: PAD,
    marginTop: 14,
    padding: 14,
    borderRadius: R.lg,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.line,
  },
  proTitle: { color: C.text, fontFamily: F.bold, fontSize: 14.5, lineHeight: 20 },
  proHelp: { marginTop: 2, color: C.textDim, fontFamily: F.medium, fontSize: 12.5, lineHeight: 18 },

  search: {
    flex: 1,
    minWidth: 0,
    marginRight: 10,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    borderRadius: R.pill,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.line,
  },
  searchFocused: { borderColor: C.leaf, backgroundColor: 'rgba(255,255,255,0.08)' },
  searchInput: {
    flex: 1,
    minWidth: 0,
    height: '100%',
    color: C.text,
    fontFamily: F.semi,
    fontSize: 16,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
  },

  filters: { paddingHorizontal: PAD - 6, paddingTop: 22, paddingBottom: 4 },
  filter: { width: 76, alignItems: 'center', gap: 8 },
  filterIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.line,
  },
  filterIconOn: { backgroundColor: 'rgba(168,213,79,0.2)', borderColor: C.leaf, borderWidth: 2 },
  filterLabel: { color: C.textDim, fontFamily: F.semi, fontSize: 12, textAlign: 'center' },
  filterLabelOn: { color: C.text, fontFamily: F.heavy },

  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: PAD,
    marginTop: 28,
  },
  sectionTitle: { color: C.text, fontFamily: F.display, fontSize: 22, lineHeight: 28 },
  count: { color: C.textFaint, fontFamily: F.semi, fontSize: 13 },
  monthChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.leafWash,
  },
  monthChipText: {
    color: C.leaf,
    fontFamily: F.bold,
    fontSize: 12.5,
    textTransform: 'capitalize',
  },

  seasonList: { paddingHorizontal: PAD, paddingTop: 14, gap: 12 },
  seasonCard: {
    width: 232,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    paddingRight: 14,
    borderRadius: R.lg,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.line,
  },
  seasonArt: { width: 76, height: 76, alignItems: 'center', justifyContent: 'center' },
  seasonImage: { width: 64, height: 64 },
  seasonName: { color: C.text, fontFamily: F.bold, fontSize: 15.5, lineHeight: 20 },
  seasonOrigin: { marginTop: 1, color: C.textFaint, fontFamily: F.medium, fontSize: 12.5 },
  seasonPrice: {
    marginTop: 7,
    color: C.text,
    fontFamily: F.heavy,
    fontSize: 14.5,
    fontVariant: ['tabular-nums'],
  },
  seasonUnit: { color: C.textFaint, fontFamily: F.medium, fontSize: 12 },

  column: { gap: GAP, paddingHorizontal: PAD, marginBottom: 2 },
});
