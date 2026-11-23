import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Platform, StyleSheet, Text, View } from 'react-native';
import { BumpText } from '../components/Motion';
import { Pressable } from '../components/Tap';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import Animated, {
  Easing,
  Extrapolation,
  FadeIn,
  FadeInDown,
  FadeOut,
  SharedValue,
  cancelAnimation,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ArcCarousel, ArcDims, REST_ANGLE, THUMB, ringHeight } from '../components/ArcCarousel';
import { RoundButton } from '../components/Buttons';
import { Glow } from '../components/Glow';
import { HeartButton } from '../components/HeartButton';
import { OfferPicker } from '../components/OfferPicker';
import { PressableScale } from '../components/PressableScale';
import { SeasonStrip } from '../components/SeasonStrip';
import { Stepper } from '../components/Stepper';
import { useFlight } from '../lib/flight';
import { CATEGORY_LABEL, Product } from '../lib/data';
import {
  MONTHS,
  addedMessage,
  currentMonth,
  euro,
  isAllYear,
  isInSeason,
  lineTotalText,
  maxQty as maxOf,
  minQty as minOf,
  nextSeasonStart,
  priceText,
  qtyFull,
  qtyLabel,
  round2,
  stepperLabel,
  unitShort,
  unitTiny,
} from '../lib/format';
import type { Nav, RootStackParamList } from '../lib/navigation';
import { RATIO } from '../lib/ratios';
import { useStore } from '../lib/store';
import { C, CLIP, F, R, shadow } from '../lib/theme';
import { useToast } from '../lib/toast';
import { useFrame } from '../lib/useFrame';
import { success, tick } from '../lib/haptics';

const LEAF = require('../assets/decor/leaf.webp');
const LEAF_SOFT = require('../assets/decor/leaf-soft.webp');
const LEAF_BLUR = require('../assets/decor/leaf-blur.webp');

const comma = (n: number | string) => String(n).replace('.', ',');

const SNAP = { damping: 26, stiffness: 210, mass: 1 };

function FloatingLeaf({
  source,
  size,
  rotate,
  drift,
  duration,
  delay,
  enter,
  style,
}: {
  source: number;
  size: number;
  rotate: number;
  drift: number;
  duration: number;
  delay: number;
  enter: SharedValue<number>;
  style: object;
}) {
  const t = useSharedValue(0.5);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) return;
    t.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration, easing: Easing.inOut(Easing.sin) }), -1, true),
    );
  }, [reduced, delay, duration, t]);

  const animated = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [
      { translateY: (t.value - 0.5) * drift + (1 - enter.value) * 40 },
      { translateX: (t.value - 0.5) * drift * 0.45 },
      { rotate: `${rotate + (t.value - 0.5) * 14}deg` },
      { scale: 0.6 + enter.value * 0.4 },
    ],
  }));

  return (
    <Animated.View
      style={[
        { position: 'absolute', width: size, height: size, pointerEvents: 'none' },
        style,
        animated,
      ]}
    >
      <Image
        source={source}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        accessible={false}
      />
    </Animated.View>
  );
}

function SimilarCard({ product: p, onPress }: { product: Product; onPress: () => void }) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${p.name}, ${priceText(p)} ${unitTiny(p)}`}
      style={styles.similar}
    >
      <View style={styles.similarArt}>
        <Glow color={p.tint} width={124} opacity={0.5} style={{ left: 6, top: 0 }} />
        <Image
          source={p.image}
          style={styles.similarImage}
          contentFit="contain"
          accessible={false}
        />
      </View>
      <Text style={styles.similarName} numberOfLines={1}>
        {p.name}
      </Text>
      <Text style={styles.similarPrice} numberOfLines={1}>
        {priceText(p)} <Text style={styles.similarUnit}>{unitTiny(p)}</Text>
      </Text>
    </PressableScale>
  );
}

export function ProductScreen() {
  const nav = useNavigation<Nav>();
  const { params } = useRoute<RouteProp<RootStackParamList, 'Product'>>();
  const {
    favorites,
    cart,
    cartCount,
    catalog,
    byId,
    isPro,
    incoterm,
    setIncoterm,
    toggleFavorite,
    addToCart,
    setTab,
  } = useStore();
  const first = byId[params.id] ?? catalog[0];
  // L'anneau parcouru en glissant, en boucle, depuis le produit ouvert : tout le catalogue de
  // l'espace, sans restriction de rayon ni de famille.
  const ring = catalog;
  const count = ring.length;
  const [index, setIndex] = useState(() =>
    Math.max(
      0,
      ring.findIndex((x) => x.id === first.id),
    ),
  );
  const p = ring[index] ?? first;
  const { width, height, top, bottom, wide } = useFrame();
  // Sur grand écran, les lueurs tiennent dans la colonne : elles s'éteignent avant ses bords.
  const glowW = wide ? width : width * 1.6;
  const oliveW = wide ? width : width * 1.8;
  const toast = useToast();
  const reduced = useReducedMotion();

  // Quantité et confirmation sont propres à un produit : elles repartent de zéro
  // dès qu'un autre produit arrive au centre.
  // Professionnels : un produit peut avoir plusieurs offres (avion, bateau). `o` est l'offre
  // choisie ; pour un particulier ou une offre unique, c'est le produit lui-même.
  const [choice, setChoice] = useState<Record<string, string>>({});
  const o = p.offers ? (p.offers.find((x) => x.id === choice[p.id]) ?? p.offers[0]) : p;
  const inCart = cart[o.id] ?? 0;
  // Première mise au panier : la quantité minimale. Ensuite : un palier de plus.
  const startQty = inCart > 0 ? o.step : minOf(o);
  const [qtyState, setQtyState] = useState({ id: o.id, qty: startQty });
  const qty = qtyState.id === o.id ? Math.max(qtyState.qty, startQty) : startQty;
  const setQty = (fn: (q: number) => number) =>
    setQtyState((s) => ({
      id: o.id,
      qty: fn(s.id === o.id ? Math.max(s.qty, startQty) : startQty),
    }));
  const [addedId, setAddedId] = useState<string | null>(null);
  const added = addedId === p.id;
  const addedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fav = favorites.includes(p.id);
  const maxQty = round2(maxOf(o) - inCart);
  const month = currentMonth();
  const inSeason = isInSeason(p);
  const allYear = isAllYear(p);
  // Le visuel occupe la place que réclame sa silhouette : un citron large n'a pas
  // besoin de la même hauteur qu'un ananas.
  const maxH = Math.round(Math.min(Math.max(height * 0.43, 300), 410)) - 12;
  const dims = useMemo<ArcDims[]>(
    () =>
      ring.map((x) => {
        const ratio = RATIO[x.id] ?? 1;
        const w = Math.round(Math.min(width * 0.82, maxH * ratio));
        const h = Math.round(w / ratio);
        return { w, h, heroH: Math.max(h + 12, 236) };
      }),
    [ring, width, maxH],
  );
  const heights = useMemo(() => dims.map((d) => d.heroH), [dims]);
  const heroH = heights[index];
  // La scène est dimensionnée pour le plus grand visuel du rayon ; le contenu remonte
  // sous les plus petits par simple translation (voir infoStyle).
  const stageH = Math.max(...heights);
  const leafH = (stageH + Math.min(...heights)) / 2;
  // Rayon du demi-cercle : les voisins restent dans l'écran et au-dessus du texte,
  // même sous le visuel le plus bas du rayon.
  const arcR = Math.min(
    width / 2 - 45,
    (Math.min(...heights) / 2 + 6) / (1 - Math.cos(REST_ANGLE)),
  );
  const dragW = width * 0.5;
  const compact = width < 350;
  // Le total du quai garde sa place : les grands montants (gros) s'écrivent plus petit.
  const totalText = lineTotalText(o, qty);
  const totalSize = compact
    ? Math.max(11, Math.min(17, 120 / totalText.length))
    : Math.min(20, 175 / totalText.length);

  const similar = useMemo(
    () => catalog.filter((x) => x.id !== p.id && (isPro || x.category === p.category)).slice(0, 8),
    [isPro, catalog, p],
  );

  // Entrée en scène + flottement lent du produit.
  const enter = useSharedValue(0);
  // Ouverte depuis une carte : la photo arrive de la carte, la fiche l'attend sans bouger.
  const flight = useFlight();
  const flying = !!params.fly && flight.expects(first.id);
  const flew = useSharedValue(flying ? 1 : 0);
  const cloak = useSharedValue(flying ? 1 : 0);
  useLayoutEffect(() => {
    if (!flew.value) return;
    const d = dims[index];
    const landed = flight.arrive(
      first.id,
      { x: width / 2 - d.w / 2, y: top + 52 + d.heroH / 2 - d.h / 2, w: d.w, h: d.h },
      () => {
        cloak.value = 0;
      },
    );
    if (!landed) {
      flew.value = 0;
      cloak.value = 0;
    }
    // Une seule fois, à l'ouverture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const float = useSharedValue(0.5);
  const scrollY = useSharedValue(0);
  // Position continue dans l'anneau (non bornée : le modulo fait la boucle).
  const progress = useSharedValue(index);
  const dragStart = useSharedValue(0);
  const infoFade = useSharedValue(1);

  const onCentered = useCallback(
    (i: number) => {
      setIndex(i);
      tick();
      infoFade.value = 0;
      infoFade.value = withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) });
    },
    [infoFade],
  );

  // Dès qu'un produit franchit le sommet de l'arc, sa fiche prend le relais.
  useAnimatedReaction(
    () => ((Math.round(progress.value) % count) + count) % count,
    (now, before) => {
      if (before !== null && now !== before) runOnJS(onCentered)(now);
    },
    [count, onCentered],
  );

  const lastDragAt = useSharedValue(0);
  const rootRef = useRef<View>(null);
  const similarRef = useRef<View>(null);

  // Le même geste est posé sur deux zones : le visuel et le bloc d'informations.
  // On glisse donc n'importe où sur la fiche (hors liste « Dans le même rayon »).
  const makePan = useCallback(
    () =>
      Gesture.Pan()
        .enabled(count > 1)
        .activeOffsetX([-10, 10])
        .failOffsetY([-14, 14])
        .onStart(() => {
          'worklet';
          cancelAnimation(progress);
          dragStart.value = progress.value;
        })
        .onUpdate((e) => {
          'worklet';
          progress.value = dragStart.value - e.translationX / dragW;
        })
        .onEnd((e) => {
          'worklet';
          // On prolonge un peu le geste selon sa vitesse, puis on se cale sur un produit
          // (au plus un cran au-delà de celui qui est sous le doigt).
          const near = Math.round(progress.value);
          const aimed = Math.round(progress.value - (e.velocityX * 0.16) / dragW);
          const target = Math.min(near + 1, Math.max(near - 1, aimed));
          lastDragAt.value = Date.now();
          progress.value = withSpring(target, { ...SNAP, velocity: -e.velocityX / dragW });
        }),
    [count, dragW, progress, dragStart, lastDragAt],
  );
  const panStage = useMemo(makePan, [makePan]);
  const panBody = useMemo(makePan, [makePan]);

  // Web : le glissement à deux doigts d'un pavé tactile (ou Maj + molette) n'émet pas de
  // « toucher » mais des événements de défilement horizontal. On les suit de la même façon :
  // un geste = un produit, avec le même calage en fin de course.
  useEffect(() => {
    if (Platform.OS !== 'web' || count < 2) return;
    const el = rootRef.current as unknown as HTMLElement | null;
    if (!el || typeof el.addEventListener !== 'function') return;
    let start = 0;
    let active = false;
    let locked = false;
    let lastAbs = 0;
    let idle: ReturnType<typeof setTimeout> | null = null;

    const settle = () => {
      idle = null;
      if (active && !locked) {
        const moved = progress.value - start;
        progress.value = withSpring(start + (Math.abs(moved) > 0.2 ? Math.sign(moved) : 0), SNAP);
      }
      active = false;
      locked = false;
      lastAbs = 0;
    };

    const onWheel = (e: WheelEvent) => {
      const list = similarRef.current as unknown as HTMLElement | null;
      if (list && list.contains(e.target as Node)) return; // cette liste défile toute seule
      const unit = e.deltaMode === 1 ? 32 : 1;
      const dx = e.deltaX * unit;
      if (Math.abs(dx) <= Math.abs(e.deltaY * unit)) return; // vertical : la page défile
      e.preventDefault(); // évite aussi le « retour arrière » du navigateur
      if (idle) clearTimeout(idle);
      idle = setTimeout(settle, 140);
      const abs = Math.abs(dx);
      if (locked) {
        // L'inertie du pavé tactile décroît ; un sursaut signale un nouveau geste.
        if (abs <= lastAbs * 1.6 + 6) {
          lastAbs = abs;
          return;
        }
        locked = false;
        active = false;
      }
      lastAbs = abs;
      if (!active) {
        active = true;
        cancelAnimation(progress);
        start = Math.round(progress.value);
      }
      const next = Math.min(start + 1, Math.max(start - 1, progress.value + dx / dragW));
      if (Math.abs(next - start) >= 0.45) {
        locked = true;
        active = false;
        progress.value = withSpring(start + Math.sign(next - start), SNAP);
      } else {
        progress.value = next;
      }
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
      if (idle) clearTimeout(idle);
    };
  }, [count, dragW, progress]);

  const step = (dir: 1 | -1) => {
    if (Date.now() - lastDragAt.value < 300) return; // fin de glissement : pas de double saut
    progress.value = withSpring(Math.round(progress.value) + dir, SNAP);
  };

  useEffect(() => {
    enter.value = withTiming(1, { duration: 720, easing: Easing.out(Easing.cubic) });
    if (!reduced) {
      float.value = withDelay(
        700,
        withRepeat(withTiming(1, { duration: 3400, easing: Easing.inOut(Easing.sin) }), -1, true),
      );
    }
    return () => {
      if (addedTimer.current) clearTimeout(addedTimer.current);
    };
  }, [enter, float, reduced]);

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  const heroStyle = useAnimatedStyle(() => {
    const shrink = interpolate(scrollY.value, [-120, 0, 300], [1.1, 1, 0.8], Extrapolation.CLAMP);
    // Avec la photo en vol, la scène est déjà en place ; sinon elle fait son entrée.
    const k = flew.value ? 1 : enter.value;
    return {
      opacity: k,
      transform: [
        { translateY: (1 - k) * 44 },
        { scale: (0.82 + k * 0.18) * shrink },
        { rotate: `${(1 - k) * -9}deg` },
      ],
    };
  });

  // Le contenu suit la hauteur du visuel en cours de passage, et se rafraîchit en fondu.
  const infoStyle = useAnimatedStyle(() => ({
    opacity: 0.2 + infoFade.value * 0.8,
    transform: [
      { translateY: ringHeight(heights, progress.value) - stageH + (1 - infoFade.value) * 10 },
    ],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    // La couleur du produit s'efface quand on fait défiler : la barre du haut, qui apparaît
    // alors, repose sur le même fond uni que le reste de la page.
    opacity:
      enter.value *
      interpolate(scrollY.value, [0, Math.max(60, heroH - 150)], [1, 0], Extrapolation.CLAMP),
    transform: [{ scale: 0.7 + enter.value * 0.3 }],
  }));

  const barStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [heroH - 150, heroH - 70], [0, 1], Extrapolation.CLAMP),
  }));

  const goToCart = () => {
    setTab('cart');
    nav.popToTop();
  };

  const add = () => {
    if (maxQty <= 0) {
      toast('Quantité maximale atteinte pour ce produit', {
        icon: 'information-circle-outline',
        tint: C.textDim,
      });
      return;
    }
    const q = Math.min(qty, maxQty);
    addToCart(o.id, q);
    success();
    setAddedId(p.id);
    if (addedTimer.current) clearTimeout(addedTimer.current);
    addedTimer.current = setTimeout(() => setAddedId(null), 1600);
    toast(addedMessage(o, q, isPro), {
      image: p.image,
      action: { label: isPro ? 'Voir la demande' : 'Voir le panier', onPress: goToCart },
    });
  };

  const seasonStatus = allYear
    ? 'Disponible toute l’année'
    : inSeason
      ? 'En pleine saison'
      : `Retour en ${MONTHS[nextSeasonStart(p) - 1]}`;

  return (
    <View ref={rootRef} style={styles.root}>
      {/* La lumière de l'écran prend la couleur du produit. */}
      <View style={[StyleSheet.absoluteFill, styles.stage, { pointerEvents: 'none' }]}>
        <Glow
          color={C.olive}
          width={oliveW}
          height={height * 0.5}
          opacity={0.5}
          style={{ left: (width - oliveW) / 2, top: height * 0.28 }}
        />
        <Animated.View
          style={[
            {
              position: 'absolute',
              left: (width - glowW) / 2,
              top: top - width * 0.34,
              width: glowW,
              height: width * 1.6,
            },
            glowStyle,
          ]}
        >
          <Animated.View
            key={p.id}
            entering={FadeIn.duration(380)}
            exiting={FadeOut.duration(380)}
            style={StyleSheet.absoluteFill}
          >
            <Glow
              color={p.tint}
              width={glowW}
              height={width * 1.6}
              opacity={0.44}
              style={{ position: 'relative' }}
            />
          </Animated.View>
        </Animated.View>
      </View>

      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 150 + bottom + 44 }}
      >
        <GestureDetector gesture={panStage} touchAction="pan-y">
          <View style={[styles.stage, { height: stageH + top + 96 }]}>
            <FloatingLeaf
              source={LEAF_BLUR}
              size={170}
              rotate={118}
              drift={22}
              duration={5200}
              delay={0}
              enter={enter}
              style={{ left: -66, top: top + leafH * 0.44 }}
            />
            <FloatingLeaf
              source={LEAF_SOFT}
              size={96}
              rotate={-42}
              drift={16}
              duration={4300}
              delay={500}
              enter={enter}
              style={{ right: -20, top: top + leafH * 0.36 }}
            />
            <FloatingLeaf
              source={LEAF_BLUR}
              size={130}
              rotate={205}
              drift={20}
              duration={6100}
              delay={900}
              enter={enter}
              style={{ right: -48, top: top + leafH * 0.82 }}
            />
            <FloatingLeaf
              source={LEAF}
              size={40}
              rotate={28}
              drift={12}
              duration={3600}
              delay={300}
              enter={enter}
              style={{ left: 34, top: top + leafH * 0.2 }}
            />

            <Animated.View style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }, heroStyle]}>
              <ArcCarousel
                ring={ring}
                dims={dims}
                heights={heights}
                progress={progress}
                float={float}
                radius={arcR}
                stageTop={top + 52}
                width={width}
                activeIndex={index}
                cloak={cloak}
                reveal={flying ? enter : undefined}
              />
            </Animated.View>
            {count > 1 &&
              ([-1, 1] as const).map((dir) => {
                const other = ring[(index + dir + count) % count];
                return (
                  <Pressable
                    key={dir}
                    feedback="none"
                    onPress={() => step(dir)}
                    accessibilityRole="button"
                    accessibilityLabel={`${dir < 0 ? 'Produit précédent' : 'Produit suivant'} : ${other.name}`}
                    style={{
                      position: 'absolute',
                      width: THUMB + 16,
                      height: THUMB + 16,
                      left: width / 2 + dir * arcR * Math.sin(REST_ANGLE) - (THUMB + 16) / 2,
                      top:
                        top + 52 + heroH / 2 + arcR * (1 - Math.cos(REST_ANGLE)) - (THUMB + 16) / 2,
                    }}
                  />
                );
              })}
            <HeartButton
              active={fav}
              name={p.name}
              variant="glass"
              size={22}
              onToggle={() => {
                const on = toggleFavorite(p.id);
                if (on) toast('Ajouté à vos favoris', { icon: 'heart', tint: C.heart });
              }}
              style={{ position: 'absolute', right: 19, top: top + 66 }}
            />
          </View>
        </GestureDetector>

        <Animated.View style={[{ marginBottom: heroH - stageH }, infoStyle]}>
          {count > 1 && (
            <View
              style={styles.pager}
              accessible
              accessibilityLabel={`Produit ${index + 1} sur ${count}. Glissez pour découvrir les autres produits.`}
            >
              {count <= 9 ? (
                ring.map((x, i) => (
                  <View key={x.id} style={[styles.pagerDot, i === index && styles.pagerDotOn]} />
                ))
              ) : (
                // Catalogue entier : un compteur remplace la rangée de points, trop longue.
                <Text style={styles.pagerCount}>
                  {index + 1} / {count}
                </Text>
              )}
            </View>
          )}
          <GestureDetector gesture={panBody} touchAction="pan-y">
            <View style={styles.body}>
              <Animated.View entering={FadeInDown.delay(120).duration(460)} style={styles.chips}>
                {p.bio && (
                  <View style={styles.chip}>
                    <Ionicons name="leaf-outline" size={13} color={C.textDim} />
                    <Text style={styles.chipText}>Bio</Text>
                  </View>
                )}
                {isPro ? (
                  // Pas de familles dans l'espace professionnel : on indique où l'on en est.
                  count > 1 && (
                    <View style={styles.chip}>
                      <Ionicons name="swap-horizontal" size={13} color={C.textDim} />
                      <Text style={styles.chipText}>
                        Produit {index + 1} sur {count} · glissez pour découvrir
                      </Text>
                    </View>
                  )
                ) : (
                  <View style={styles.chip}>
                    <Text style={styles.chipText}>{CATEGORY_LABEL[p.category]}</Text>
                  </View>
                )}
              </Animated.View>

              <Animated.View entering={FadeInDown.delay(180).duration(460)}>
                <View style={styles.titleRow}>
                  <Text style={styles.title} accessibilityRole="header">
                    {p.name}
                  </Text>
                  {!isPro && p.reviews > 0 && (
                    <View
                      style={styles.rating}
                      accessible
                      accessibilityLabel={`Note ${comma(p.rating)} sur 5, ${p.reviews} avis`}
                    >
                      <Ionicons name="star" size={17} color={C.star} />
                      <Text style={styles.ratingValue}>{comma(p.rating.toFixed(1))}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.variety}>
                  {p.variety} · {p.origin}
                </Text>
                <View style={styles.priceRow}>
                  <Text style={styles.price}>{priceText(o)}</Text>
                  <Text style={styles.priceUnit}>
                    {o.noPrice && (o.shownPrice ?? null) === null ? '' : unitShort(o)}
                    {o.mode ? ` · ${o.mode}` : ''}
                  </Text>
                  {!isPro && p.reviews > 0 && <Text style={styles.reviews}>{p.reviews} avis</Text>}
                </View>
              </Animated.View>

              {isPro && (
                <OfferPicker
                  product={p}
                  line={o}
                  onSelectLine={(id) => setChoice((c) => ({ ...c, [p.id]: id }))}
                  qty={qty}
                  onQty={(q) => setQty(() => q)}
                  inCart={inCart}
                  incoterm={incoterm}
                  onIncoterm={setIncoterm}
                />
              )}

              <Animated.View entering={FadeInDown.delay(240).duration(460)}>
                <Text style={styles.description}>{p.description}</Text>
              </Animated.View>

              <View style={styles.card}>
                <View style={styles.cardHead}>
                  <Text style={styles.cardTitle} accessibilityRole="header">
                    Saison
                  </Text>
                  <View style={styles.seasonStatus}>
                    <View
                      style={[styles.dot, { backgroundColor: inSeason ? C.leaf : C.textFaint }]}
                    />
                    <Text style={[styles.seasonStatusText, inSeason && { color: C.leaf }]}>
                      {seasonStatus}
                    </Text>
                  </View>
                </View>
                <SeasonStrip season={p.season} tint={p.tint} />
                {!inSeason && (
                  <Text style={styles.cardNote}>
                    Hors de sa pleine saison en {MONTHS[month - 1]} : le goût et le prix sont
                    meilleurs quand les mois ci-dessus sont colorés.
                  </Text>
                )}
              </View>
            </View>
          </GestureDetector>

          {similar.length > 0 && (
            <View ref={similarRef}>
              <Text style={[styles.cardTitle, styles.similarTitle]} accessibilityRole="header">
                {isPro ? 'Autres produits' : 'Dans le même rayon'}
              </Text>
              <FlatList
                horizontal
                data={similar}
                keyExtractor={(x) => x.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.similarList}
                renderItem={({ item }) => (
                  <SimilarCard
                    product={item}
                    onPress={() => nav.push('Product', { id: item.id })}
                  />
                )}
              />
            </View>
          )}
        </Animated.View>
      </Animated.ScrollView>

      {/* Barre haute */}
      <View style={[styles.topBar, { paddingTop: top + 4 }]}>
        <Animated.View style={[StyleSheet.absoluteFill, barStyle, { pointerEvents: 'none' }]}>
          <LinearGradient
            colors={[C.bg, C.bg, 'rgba(11,14,9,0)']}
            locations={[0, 0.72, 1]}
            style={[StyleSheet.absoluteFill, { bottom: -30 }]}
          />
        </Animated.View>
        <RoundButton icon="chevron-back" label="Retour" onPress={() => nav.goBack()} />
        <Animated.Text style={[styles.barTitle, barStyle]} numberOfLines={1}>
          {p.name}
        </Animated.Text>
        <RoundButton
          icon={isPro ? 'document-text-outline' : 'bag-handle-outline'}
          label={isPro ? 'Ouvrir ma demande en cours' : 'Ouvrir le panier'}
          badge={cartCount}
          onPress={goToCart}
        />
      </View>

      {/* Quai d'achat */}
      <View style={[styles.dock, { paddingBottom: bottom + 6 }]}>
        <LinearGradient
          colors={['rgba(11,14,9,0)', 'rgba(11,14,9,0.93)', C.bg]}
          locations={[0, 0.3, 0.5]}
          style={styles.dockFade}
        />
        <View style={[styles.dockRow, { paddingLeft: compact ? 14 : 20, gap: compact ? 8 : 12 }]}>
          <View>
            <Text style={styles.dockOver} numberOfLines={1}>
              {o.mode
                ? o.unit === 'kg'
                  ? `Quantité · ${o.mode}`
                  : `Conteneurs · ${o.mode}`
                : `Quantité${o.unit === 'unit' ? ` · ${o.noun[qty > 1 ? 1 : 0]}` : ''}`}
            </Text>
            <Stepper
              compact
              labelMinWidth={compact ? 46 : undefined}
              label={stepperLabel(o, qty)}
              canMinus={qty > startQty}
              canPlus={qty < Math.max(maxQty, startQty)}
              onMinus={() => setQty((q) => round2(Math.max(startQty, q - o.step)))}
              onPlus={() => setQty((q) => round2(q + o.step))}
            />
          </View>
          <View style={[styles.totalTile, compact && { paddingHorizontal: 8 }]}>
            <Text style={styles.dockOver}>Total</Text>
            <BumpText
              value={totalText}
              style={[styles.total, { fontSize: totalSize }]}
              numberOfLines={1}
            >
              {totalText}
            </BumpText>
          </View>
          <PressableScale
            onPress={add}
            scaleTo={0.94}
            accessibilityRole="button"
            accessibilityLabel={`Ajouter ${qtyFull(o, qty)}${o.mode ? ` par ${o.mode}` : ''} ${isPro ? 'à la demande' : 'au panier'}, ${o.noPrice ? 'prix à confirmer' : totalText}`}
            style={[styles.buy, shadow(10, 28, 0.5)]}
          >
            <LinearGradient
              colors={['#BDE365', '#86B833']}
              style={[StyleSheet.absoluteFill, styles.buyShape]}
            />
            <View style={styles.buyPlus}>
              <Ionicons name={added ? 'checkmark' : 'add'} size={24} color={C.onLeaf} />
            </View>
            <View style={styles.buyLabelBox}>
              <Text style={styles.buyLabel} numberOfLines={1}>
                {added ? 'Ajouté' : 'Ajouter'}
              </Text>
            </View>
          </PressableScale>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  // Les feuilles du décor dépassent sur les côtés : la scène les coupe net, sans créer de zone
  // que le navigateur pourrait faire défiler latéralement.
  stage: CLIP,
  body: { paddingHorizontal: 24 },
  pager: {
    position: 'absolute',
    top: -25,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
    pointerEvents: 'none',
  },
  pagerDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(245,242,233,0.3)' },
  pagerDotOn: { width: 16, backgroundColor: C.leaf },
  pagerCount: {
    color: C.textDim,
    fontFamily: F.bold,
    fontSize: 12.5,
    lineHeight: 16,
    fontVariant: ['tabular-nums'],
  },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 15,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.line,
  },
  chipText: { color: C.textDim, fontFamily: F.bold, fontSize: 12.5 },

  titleRow: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    flex: 1,
    color: C.text,
    fontFamily: F.display,
    fontSize: 36,
    lineHeight: 42,
    letterSpacing: -0.4,
  },
  termRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 7,
  },
  termName: { color: C.textDim, fontFamily: F.bold, fontSize: 14.5, letterSpacing: 0.3 },
  termPrice: { color: C.text, fontFamily: F.heavy, fontSize: 16, fontVariant: ['tabular-nums'] },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 11 },
  ratingValue: { color: C.text, fontFamily: F.heavy, fontSize: 18 },
  variety: { marginTop: 4, color: C.textDim, fontFamily: F.semi, fontSize: 15, lineHeight: 21 },
  priceRow: { marginTop: 14, flexDirection: 'row', alignItems: 'baseline', gap: 7 },
  price: { color: C.text, fontFamily: F.heavy, fontSize: 24, fontVariant: ['tabular-nums'] },
  priceUnit: { flex: 1, color: C.textDim, fontFamily: F.medium, fontSize: 14 },
  reviews: { color: C.textFaint, fontFamily: F.semi, fontSize: 13 },

  description: {
    marginTop: 18,
    color: C.textDim,
    fontFamily: F.medium,
    fontSize: 15.5,
    lineHeight: 25,
  },

  card: {
    marginTop: 14,
    padding: 18,
    borderRadius: R.lg,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.line,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 10,
  },
  cardTitle: { color: C.text, fontFamily: F.display, fontSize: 19, lineHeight: 24 },
  cardNote: {
    marginTop: 14,
    color: C.textFaint,
    fontFamily: F.medium,
    fontSize: 13,
    lineHeight: 19,
  },
  seasonStatus: { flexDirection: 'row', alignItems: 'center', gap: 7, flexShrink: 1 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  seasonStatusText: { color: C.textDim, fontFamily: F.bold, fontSize: 13 },

  similarTitle: { marginTop: 32, paddingHorizontal: 24, fontSize: 22, lineHeight: 28 },
  similarList: { paddingHorizontal: 24, paddingTop: 14, gap: 12 },
  similar: { width: 136 },
  similarArt: { height: 124, alignItems: 'center', justifyContent: 'center' },
  similarImage: { width: 100, height: 92 },
  similarName: { marginTop: 10, color: C.text, fontFamily: F.bold, fontSize: 14.5 },
  similarPrice: {
    marginTop: 2,
    color: C.text,
    fontFamily: F.heavy,
    fontSize: 13.5,
    fontVariant: ['tabular-nums'],
  },
  similarUnit: { color: C.textFaint, fontFamily: F.medium, fontSize: 12 },

  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 18,
    paddingBottom: 8,
  },
  barTitle: {
    flex: 1,
    textAlign: 'center',
    color: C.text,
    fontFamily: F.display,
    fontSize: 18,
  },

  dock: { position: 'absolute', left: 0, right: 0, bottom: 0, pointerEvents: 'box-none' },
  dockFade: { position: 'absolute', left: 0, right: 0, bottom: 0, top: -72, pointerEvents: 'none' },
  dockRow: { flexDirection: 'row', alignItems: 'center', pointerEvents: 'box-none' },
  dockOver: {
    marginBottom: 7,
    marginLeft: 4,
    color: C.textDim,
    fontFamily: F.semi,
    fontSize: 12.5,
    lineHeight: 16,
  },
  totalTile: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 24,
    backgroundColor: '#22271B',
    borderWidth: 1,
    borderColor: C.line,
  },
  total: {
    marginLeft: 4,
    color: C.text,
    fontFamily: F.heavy,
    fontSize: 20,
    lineHeight: 25,
    fontVariant: ['tabular-nums'],
  },
  buy: {
    width: 68,
    height: 140,
    alignItems: 'center',
    paddingTop: 9,
    borderTopLeftRadius: 34,
    borderBottomLeftRadius: 34,
  },
  buyShape: { borderTopLeftRadius: 34, borderBottomLeftRadius: 34 },
  buyPlus: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8F6EC',
  },
  // Le libellé vertical est plus large que le bouton avant sa rotation : on le contient, sinon
  // l'écran entier pouvait se décaler de quelques points sur le côté.
  buyLabelBox: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  buyLabel: {
    width: 84,
    textAlign: 'center',
    color: C.onLeaf,
    fontFamily: F.heavy,
    fontSize: 15.5,
    letterSpacing: 0.2,
    transform: [{ rotate: '-90deg' }],
  },
});
