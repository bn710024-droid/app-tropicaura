import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Pressable } from './Tap';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeIn } from 'react-native-reanimated';
import { GhostButton } from './Buttons';
import { Bump } from './Motion';
import { TEST_TOOLS } from '../lib/config';
import { TrackView, useStore } from '../lib/store';
import { C, F, PAD, R } from '../lib/theme';
import { useFrame } from '../lib/useFrame';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

type Props = {
  title: string;
  date: string;
  view: TrackView;
  messageLabel: string;
  info: { icon: IconName; text: string }[];
  /** Détail des lignes, en clair (demandes professionnelles : mode, quantité, équivalent). */
  lines?: string[];
  lineIds: string[];
  totalOver: string;
  total: string;
  action?: { label: string; icon: IconName; onPress: () => void };
  onOpenProduct: (id: string) => void;
  /** Annulation par le client, avec confirmation en deux temps. */
  onCancel?: () => void;
  /** Mode test : simule l'étape suivante à la place de l'équipe. */
  onTest?: () => void;
};

/** Carte de suivi : une commande de particulier ou une demande de professionnel. */
export function TrackCard({
  title,
  date,
  view,
  messageLabel,
  info,
  lines,
  lineIds,
  totalOver,
  total,
  action,
  onOpenProduct,
  onCancel,
  onTest,
}: Props) {
  const [confirming, setConfirming] = useState(false);
  // Écran étroit : quatre libellés ne tiennent plus sous les barres, on résume en une ligne.
  const narrow = useFrame().width < 360;
  const { baseById } = useStore();
  // Une photo par produit, même s'il figure sur plusieurs lignes (avion et bateau).
  const productIds = [...new Set(lineIds.map((id) => id.split(':')[0]))];
  const shown = productIds.slice(0, 5);
  const more = productIds.length - shown.length;

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.heading}>
          <Text style={styles.number}>{title}</Text>
          <Text style={styles.date}>{date}</Text>
        </View>
        <Bump value={view.label}>
          <View
            style={[
              styles.status,
              view.active && styles.statusActive,
              view.cancelled && styles.statusCancelled,
            ]}
          >
            {view.active && <View style={styles.statusDot} />}
            <Text
              style={[
                styles.statusText,
                view.active && { color: C.leaf },
                view.cancelled && { color: C.danger },
              ]}
            >
              {view.label}
            </Text>
          </View>
        </Bump>
      </View>

      {!view.cancelled && (
        <View accessible accessibilityLabel={`Suivi : ${view.label}`}>
          <View style={styles.steps}>
            {view.steps.map((label, i) => {
              const reached = i < view.done;
              return (
                <View key={label} style={styles.step}>
                  <View style={styles.stepBar}>
                    {reached && (
                      <Animated.View
                        entering={FadeIn.duration(320)}
                        style={[StyleSheet.absoluteFill, styles.stepFill]}
                      />
                    )}
                  </View>
                  {!narrow && (
                    <Text
                      style={[styles.stepLabel, reached && { color: C.text }]}
                      numberOfLines={1}
                    >
                      {label}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
          {narrow && (
            <Text style={styles.stepCaption}>
              {view.done === 0
                ? `Prochaine étape : ${view.steps[0].toLowerCase()}`
                : `Étape ${view.done} sur ${view.steps.length} · ${view.steps[view.done - 1]}`}
            </Text>
          )}
        </View>
      )}

      <View style={styles.message}>
        <Ionicons name="mail-outline" size={16} color={C.leaf} style={{ marginTop: 2 }} />
        <View style={{ flex: 1 }}>
          <Text style={styles.messageOver}>{messageLabel}</Text>
          <Text style={styles.messageText}>{view.message}</Text>
        </View>
      </View>

      {info.map((row) => (
        <View key={row.text} style={styles.info}>
          <Ionicons name={row.icon} size={16} color={C.textDim} />
          <Text style={styles.infoText} numberOfLines={3}>
            {row.text}
          </Text>
        </View>
      ))}

      {!!lines && lines.length > 0 && (
        <View style={styles.lines}>
          {lines.map((text) => (
            <Text key={text} style={styles.lineText}>
              {text}
            </Text>
          ))}
        </View>
      )}

      <View style={styles.thumbs}>
        {shown.map((id) => {
          const p = baseById[id];
          if (!p) return null;
          return (
            <Pressable
              key={id}
              scaleTo={0.9}
              onPress={() => onOpenProduct(id)}
              accessibilityRole="button"
              accessibilityLabel={`Voir la fiche ${p.name}`}
              style={({ pressed }) => [styles.thumb, pressed && { opacity: 0.6 }]}
            >
              <Image
                source={p.image}
                style={styles.thumbImage}
                contentFit="contain"
                accessible={false}
              />
            </Pressable>
          );
        })}
        {more > 0 && (
          <View style={[styles.thumb, styles.moreChip]}>
            <Text style={styles.more}>+{more}</Text>
          </View>
        )}
      </View>

      <View style={styles.cardBottom}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.totalOver} numberOfLines={3}>
            {totalOver}
          </Text>
          <Text style={styles.total}>{total}</Text>
        </View>
        {action && (
          <GhostButton
            label={action.label}
            icon={action.icon}
            onPress={action.onPress}
            style={{ minHeight: 46, paddingHorizontal: 16, flexShrink: 0 }}
          />
        )}
      </View>

      {onCancel && (
        <View style={styles.cancelRow}>
          {confirming ? (
            <>
              <Pressable
                onPress={() => {
                  setConfirming(false);
                  onCancel();
                }}
                accessibilityRole="button"
                style={({ pressed }) => [styles.linkHit, pressed && { opacity: 0.6 }]}
              >
                <Text style={[styles.link, { color: C.danger }]}>Confirmer l’annulation</Text>
              </Pressable>
              <Pressable
                onPress={() => setConfirming(false)}
                accessibilityRole="button"
                style={({ pressed }) => [styles.linkHit, pressed && { opacity: 0.6 }]}
              >
                <Text style={styles.link}>Garder la demande</Text>
              </Pressable>
            </>
          ) : (
            <Pressable
              onPress={() => setConfirming(true)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.linkHit, pressed && { opacity: 0.6 }]}
            >
              <Text style={styles.link}>Annuler la demande</Text>
            </Pressable>
          )}
        </View>
      )}

      {TEST_TOOLS && onTest && view.next && !view.cancelled && (
        <Pressable
          onPress={onTest}
          accessibilityRole="button"
          accessibilityLabel="Mode test : simuler l’étape suivante"
          style={({ pressed }) => [styles.test, pressed && { opacity: 0.6 }]}
        >
          <Ionicons name="flask-outline" size={15} color={C.textDim} />
          <Text style={styles.testText}>Mode test · simuler l’étape suivante</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: PAD,
    marginBottom: 14,
    padding: 18,
    borderRadius: R.lg,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.line,
  },
  cardTop: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: 10 },
  heading: { flexGrow: 1 },
  number: { color: C.text, fontFamily: F.bold, fontSize: 16.5, lineHeight: 22 },
  date: { marginTop: 2, color: C.textFaint, fontFamily: F.medium, fontSize: 13 },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 30,
    paddingHorizontal: 12,
    borderRadius: 15,
    backgroundColor: C.surfaceStrong,
  },
  statusActive: { backgroundColor: C.leafWash },
  statusCancelled: { backgroundColor: 'rgba(255,132,117,0.14)' },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.leaf },
  statusText: { color: C.textDim, fontFamily: F.bold, fontSize: 12.5 },

  steps: { flexDirection: 'row', gap: 6, marginTop: 18 },
  step: { flex: 1, gap: 7 },
  stepBar: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  stepFill: { backgroundColor: C.leaf },
  stepLabel: { color: C.textFaint, fontFamily: F.semi, fontSize: 11.5 },
  stepCaption: { marginTop: 9, color: C.textDim, fontFamily: F.semi, fontSize: 12.5 },

  message: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.22)',
    borderWidth: 1,
    borderColor: C.line,
  },
  messageOver: { color: C.textFaint, fontFamily: F.semi, fontSize: 12, lineHeight: 16 },
  messageText: {
    marginTop: 2,
    color: C.text,
    fontFamily: F.medium,
    fontSize: 13.5,
    lineHeight: 20,
  },
  info: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 12 },
  infoText: { flex: 1, color: C.textDim, fontFamily: F.semi, fontSize: 13.5, lineHeight: 19 },

  lines: { marginTop: 14, gap: 4 },
  lineText: { color: C.text, fontFamily: F.semi, fontSize: 13.5, lineHeight: 19 },
  thumbs: { flexDirection: 'row', gap: 8, marginTop: 16 },
  thumb: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },
  moreChip: { borderRadius: 23, backgroundColor: C.surfaceStrong },
  thumbImage: { width: 42, height: 42 },
  more: { color: C.textDim, fontFamily: F.bold, fontSize: 13 },

  cardBottom: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: C.line,
  },
  totalOver: { color: C.textFaint, fontFamily: F.semi, fontSize: 12.5, lineHeight: 17 },
  total: {
    marginTop: 2,
    color: C.text,
    fontFamily: F.heavy,
    fontSize: 21,
    fontVariant: ['tabular-nums'],
  },

  cancelRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 18, marginTop: 8 },
  linkHit: { minHeight: 44, justifyContent: 'center' },
  link: {
    color: C.textDim,
    fontFamily: F.semi,
    fontSize: 13.5,
    textDecorationLine: 'underline',
  },
  test: {
    marginTop: 10,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: R.pill,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: C.lineStrong,
  },
  testText: { color: C.textDim, fontFamily: F.semi, fontSize: 13 },
});
