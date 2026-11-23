import React, { useEffect, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Backdrop } from '../components/Backdrop';
import { GhostButton, PrimaryButton } from '../components/Buttons';
import { Glow } from '../components/Glow';
import { CelebrationItem, OrderCelebration } from '../components/OrderCelebration';
import { countryName } from '../lib/countries';
import { euro, requestLineText } from '../lib/format';
import type { Nav, RootStackParamList } from '../lib/navigation';
import { TabId, confirmationMessage, useStore } from '../lib/store';
import { C, F, PAD, R } from '../lib/theme';
import { useFrame } from '../lib/useFrame';

/** Onde qui s'élargit derrière la pastille. `loop` : attente (demande pro) plutôt que réussite. */
function Ring({ delay, color, loop }: { delay: number; color: string; loop?: boolean }) {
  const t = useSharedValue(0);
  useEffect(() => {
    const run = withTiming(1, { duration: loop ? 2200 : 1100, easing: Easing.out(Easing.cubic) });
    t.value = withDelay(delay, loop ? withRepeat(run, -1, false) : run);
  }, [t, delay, loop]);
  const style = useAnimatedStyle(() => ({
    opacity: (1 - t.value) * 0.55,
    transform: [{ scale: 0.7 + t.value * 1.5 }],
  }));
  return <Animated.View style={[styles.ring, { borderColor: color }, style]} />;
}

export function SuccessScreen() {
  const nav = useNavigation<Nav>();
  const { params } = useRoute<RouteProp<RootStackParamList, 'Success'>>();
  const { orders, requests, baseById, setTab } = useStore();
  const { top, bottom, width, height } = useFrame();
  // Écran peu haut : la scène se resserre pour que le récapitulatif reste sous les yeux.
  const compact = height < 700;
  const request = params.requestId ? requests.find((r) => r.id === params.requestId) : undefined;
  const order = request ? undefined : orders.find((o) => o.id === params.orderId);

  // Les produits réellement présents dans la commande, une fois chacun, dans l'ordre des lignes.
  const celebration = useMemo<CelebrationItem[]>(() => {
    if (!order) return [];
    const ids = [...new Set(order.lines.map((l) => l.id.split(':')[0]))];
    return ids.map((id) => {
      const product = baseById[id];
      return {
        id,
        name: product?.name ?? '',
        // Photo absente (produit retiré du catalogue) : la célébration affiche un remplacement.
        image: product?.image ?? null,
        tint: product?.tint ?? C.leaf,
      };
    });
  }, [order, baseById]);

  const pop = useSharedValue(0);
  useEffect(() => {
    pop.value = withSpring(1, { damping: 11, stiffness: 150 });
  }, [pop]);
  const badge = useAnimatedStyle(() => ({
    opacity: Math.min(1, pop.value * 1.4),
    transform: [{ scale: 0.5 + pop.value * 0.5 }],
  }));

  const leave = (tab: TabId) => {
    setTab(tab);
    nav.popToTop();
  };

  const steps = request
    ? [
        {
          done: true,
          title: 'Demande enregistrée',
          detail: `${request.number} · estimation ${euro(request.subtotal)} ${request.incoterm}${request.unpriced ? ' (hors lignes sans prix)' : ''} · rien n’est payé`,
        },
        {
          done: false,
          title: 'Réponse de notre équipe',
          detail: `Nous vous contactons au ${request.phone} ou à ${request.email} pour confirmer les détails et organiser le paiement.`,
        },
        {
          done: false,
          title: 'Commande suivie jusqu’à la livraison',
          detail:
            'Une fois confirmée, elle passe dans « Commandes » : préparation, expédition, livraison.',
        },
      ]
    : order
      ? [
          {
            done: true,
            title: 'Commande enregistrée',
            detail: `Paiement simulé de ${euro(order.total)} · ${order.payment}`,
          },
          {
            done: false,
            title: 'Validation par notre équipe',
            detail: 'Nous vérifions votre commande et vous écrivons dès qu’elle est validée.',
          },
          order.transport
            ? {
                done: false,
                title: 'Suivi jusqu’à la livraison',
                detail: `Transport inclus${order.country ? ` · ${countryName(order.country)}` : ''}`,
              }
            : {
                done: false,
                title: 'Suivi jusqu’à l’enlèvement',
                detail: 'Sans transport : mise à disposition à notre entrepôt au Sénégal.',
              },
        ]
      : [];

  return (
    <View style={styles.root}>
      <Backdrop tint={C.leafDeep} />
      {/* Le défilement part du haut de l'écran : le halo et les miniatures ne sont jamais coupés. */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.center, { paddingTop: top + (compact ? 4 : 12) }]}
        style={{ flex: 1 }}
      >
        {request ? (
          // Demande professionnelle : en attente, pas une réussite. Sablier et onde lente.
          <View style={styles.art}>
            <Glow color={C.olive} width={200} opacity={0.5} style={{ left: -40, top: -40 }} />
            <Ring delay={200} color={C.textDim} loop />
            <Animated.View style={[styles.badge, styles.badgeWaiting, badge]}>
              <Ionicons name="hourglass-outline" size={38} color={C.text} />
            </Animated.View>
          </View>
        ) : order ? (
          <OrderCelebration items={celebration} width={width - PAD * 2} compact={compact} />
        ) : (
          <View style={styles.art}>
            <View style={[styles.badge, styles.badgeWaiting]}>
              <Ionicons name="alert-circle-outline" size={40} color={C.danger} />
            </View>
          </View>
        )}

        <Animated.View
          entering={FadeInDown.delay(200).duration(460)}
          style={[styles.texts, !!order && styles.textsAfterStage]}
        >
          <Text
            style={[styles.title, width < 350 && styles.titleNarrow]}
            accessibilityRole="header"
          >
            {request
              ? 'Demande enregistrée'
              : order
                ? 'Commande enregistrée'
                : 'Commande introuvable'}
          </Text>
          {(order || request) && (
            <View style={styles.pill}>
              <Ionicons
                name={request ? 'time-outline' : 'flask-outline'}
                size={13}
                color={C.textDim}
              />
              <Text style={styles.pillText}>
                {request ? 'En attente de réponse' : 'Démonstration · paiement simulé'}
              </Text>
            </View>
          )}
          <Text style={styles.body}>
            {request
              ? 'Aucun paiement dans l’application : notre équipe vous recontacte pour confirmer les détails et organiser le paiement.'
              : order
                ? `Commande ${order.number}. Rien n’est prélevé dans cette démonstration. Notre équipe la valide, puis vous la suivez ${
                    order.transport ? 'jusqu’à la livraison' : 'jusqu’à son enlèvement'
                  }.`
                : 'Nous n’avons pas retrouvé cette commande : rien n’a été confirmé ni payé. Votre panier est intact.'}
          </Text>
        </Animated.View>

        {(order || request) && (
          <Animated.View
            entering={FadeInDown.delay(260).duration(460)}
            style={[styles.card, compact && styles.cardCompact]}
          >
            {(order
              ? [
                  [
                    `Produits · ${order.lines.length} article${order.lines.length > 1 ? 's' : ''}`,
                    euro(order.subtotal),
                  ],
                  order.transport
                    ? [
                        `Transport${order.country ? ` · ${countryName(order.country)}` : ''}`,
                        euro(order.transportCost),
                      ]
                    : ['Transport', 'Organisé par vos soins'],
                  [order.transport ? 'Total' : 'Total sans transport', euro(order.total)],
                ]
              : request
                ? [
                    ...request.lines.map((l): [string, string] => [
                      requestLineText(l, baseById[l.id.split(':')[0]]?.name ?? l.id).split(
                        ' — ',
                      )[0],
                      requestLineText(l, '').split(' — ')[1] ?? '',
                    ]),
                    [`Estimation ${request.incoterm}`, euro(request.subtotal)],
                  ]
                : []
            ).map(([label, value], i, all) => (
              <View key={label} style={[styles.recapRow, i === all.length - 1 && styles.recapLast]}>
                <Text style={[styles.recapLabel, !!request && styles.recapName]} numberOfLines={2}>
                  {label}
                </Text>
                <Text
                  style={[styles.recapValue, i === all.length - 1 && styles.recapTotal]}
                  numberOfLines={3}
                >
                  {value}
                </Text>
              </View>
            ))}
            {!!request?.unpriced && (
              <Text style={styles.recapNote}>
                Hors {request.unpriced} ligne{request.unpriced > 1 ? 's' : ''} dont le prix reste à
                confirmer par notre équipe.
              </Text>
            )}
          </Animated.View>
        )}

        {order && (
          <Animated.View
            entering={FadeInDown.delay(320).duration(460)}
            style={[styles.card, { marginTop: 12 }]}
          >
            <View style={styles.messageHead}>
              <Ionicons name="mail-outline" size={17} color={C.leaf} />
              <Text style={styles.messageOver} numberOfLines={2}>
                Message de confirmation (aperçu)
              </Text>
            </View>
            <Text style={styles.messageText}>{confirmationMessage(order)}</Text>
            <Text style={styles.proto}>
              Prototype : paiement simulé, rien n’est prélevé. Ce message s’affiche ici ; son envoi
              {order.email ? ` à ${order.email}` : ' par e-mail'} n’est pas encore connecté.
            </Text>
          </Animated.View>
        )}

        {request && (
          <Animated.View
            entering={FadeInDown.delay(320).duration(460)}
            style={[styles.card, { marginTop: 12 }]}
          >
            <View style={styles.messageHead}>
              <Ionicons name="cloud-offline-outline" size={17} color={C.textDim} />
              <Text style={[styles.messageOver, { color: C.textDim }]} numberOfLines={2}>
                Transmission pas encore connectée
              </Text>
            </View>
            <Text style={styles.messageText}>
              Prototype : le logiciel de notre équipe n’existe pas encore. Votre demande est
              enregistrée sur cet appareil et sera transmise dès que la liaison sera en place.
            </Text>
          </Animated.View>
        )}

        {(order || request) && (
          <Animated.View
            entering={FadeInDown.delay(380).duration(460)}
            style={[styles.card, { marginTop: 12, gap: 16 }]}
          >
            {steps.map((step, i) => (
              <View
                key={step.title}
                style={styles.step}
                accessible
                accessibilityLabel={`Étape ${i + 1}${step.done ? ', faite' : ', à venir'} : ${step.title}. ${step.detail}`}
              >
                <View style={[styles.stepDot, step.done && styles.stepDotDone]}>
                  {step.done ? (
                    <Ionicons name="checkmark" size={15} color={C.onLeaf} />
                  ) : (
                    <Text style={styles.stepNumber}>{i + 1}</Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  <Text style={styles.stepDetail}>{step.detail}</Text>
                </View>
              </View>
            ))}
          </Animated.View>
        )}
      </ScrollView>

      <Animated.View
        entering={FadeInDown.delay(460).duration(460)}
        style={[styles.actions, { paddingBottom: bottom + 10 }]}
      >
        {/* Le contenu qui défile s'efface en douceur au-dessus des boutons, sans coupure nette. */}
        <LinearGradient colors={['rgba(11,14,9,0)', C.bg]} style={styles.fade} />
        {request ? (
          <PrimaryButton label="Voir mes demandes" onPress={() => leave('requests')} />
        ) : order ? (
          <PrimaryButton label="Suivre ma commande" onPress={() => leave('orders')} />
        ) : (
          <PrimaryButton label="Revenir au panier" onPress={() => leave('cart')} />
        )}
        <GhostButton
          label={request ? 'Retour au catalogue' : 'Retour à l’étal'}
          onPress={() => leave('home')}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  center: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: PAD,
    paddingBottom: 26,
  },
  art: {
    width: 120,
    height: 120,
    marginTop: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.leaf,
  },
  texts: { alignItems: 'center', marginTop: 22 },
  // Sous la scène de célébration, qui réserve déjà sa propre hauteur.
  textsAfterStage: { marginTop: 12 },
  title: {
    color: C.text,
    fontFamily: F.display,
    fontSize: 30,
    lineHeight: 36,
    textAlign: 'center',
  },
  // Écran étroit : le titre tient sur une ligne, le récapitulatif remonte d'autant.
  titleNarrow: { fontSize: 24, lineHeight: 30 },
  body: {
    marginTop: 12,
    maxWidth: 340,
    color: C.textDim,
    fontFamily: F.medium,
    fontSize: 15.5,
    lineHeight: 24,
    textAlign: 'center',
  },
  card: {
    alignSelf: 'stretch',
    marginTop: 22,
    padding: 16,
    borderRadius: R.lg,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.line,
  },
  cardCompact: { marginTop: 16 },
  proto: {
    marginTop: 10,
    color: C.textFaint,
    fontFamily: F.medium,
    fontSize: 12.5,
    lineHeight: 18,
  },
  messageHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  messageOver: { flex: 1, color: C.leaf, fontFamily: F.bold, fontSize: 13 },
  messageText: {
    marginTop: 8,
    color: C.text,
    fontFamily: F.medium,
    fontSize: 14.5,
    lineHeight: 22,
  },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  stepDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: C.lineStrong,
  },
  stepDotDone: { backgroundColor: C.leaf, borderColor: C.leaf },
  stepNumber: { color: C.textDim, fontFamily: F.heavy, fontSize: 12.5 },
  stepTitle: { color: C.text, fontFamily: F.bold, fontSize: 14.5, lineHeight: 20 },
  stepDetail: {
    marginTop: 2,
    color: C.textDim,
    fontFamily: F.medium,
    fontSize: 13.5,
    lineHeight: 19,
  },
  actions: { gap: 10, paddingTop: 10, paddingHorizontal: PAD },
  fade: { position: 'absolute', left: 0, right: 0, top: -22, height: 22, pointerEvents: 'none' },
  ring: {
    position: 'absolute',
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
  },
  badgeWaiting: {
    backgroundColor: '#20261A',
    borderWidth: 1.5,
    borderColor: C.lineStrong,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    height: 28,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: C.surfaceStrong,
  },
  pillText: { color: C.textDim, fontFamily: F.bold, fontSize: 12.5 },
  recapRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 5,
  },
  recapLast: { marginTop: 6, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.line },
  recapLabel: { flexShrink: 1, color: C.textDim, fontFamily: F.semi, fontSize: 14 },
  // Demande professionnelle : le nom de la ligne garde sa place, la quantité passe à la ligne.
  recapName: { flexShrink: 0, maxWidth: '46%', color: C.text },
  recapNote: {
    marginTop: 8,
    color: C.textFaint,
    fontFamily: F.medium,
    fontSize: 12.5,
    lineHeight: 18,
  },
  recapValue: {
    flexShrink: 1,
    textAlign: 'right',
    color: C.text,
    fontFamily: F.bold,
    fontSize: 14.5,
    fontVariant: ['tabular-nums'],
  },
  recapTotal: { fontFamily: F.heavy, fontSize: 19 },
});
