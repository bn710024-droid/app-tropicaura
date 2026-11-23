import React, { useEffect, useState } from 'react';
import { SectionList, StyleSheet, Text, View } from 'react-native';
import { BumpText } from '../components/Motion';
import { Pressable } from '../components/Tap';
import { TextInput } from '../components/Input';
import { useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { PrimaryButton } from '../components/Buttons';
import { Glow } from '../components/Glow';
import { INCOTERM_SHORT, IncotermToggle } from '../components/IncotermToggle';
import { KeepsOwnSwipes, PAGE_SCROLL } from '../components/PageSwipe';
import { TAB_BAR_SPACE } from '../components/TabBar';
import { TabHeader } from '../components/TabHeader';
import { TrackCard } from '../components/TrackCard';
import { MODE_ICON, missingPriceText, ruleText } from '../components/OfferPicker';
import { checkQuantity } from '../lib/catalog/rules';
import type { Product } from '../lib/data';
import {
  MODE_LABEL,
  euro,
  formatDate,
  kgEquivalent,
  kgText,
  lineTotalText,
  maxQty,
  minQty,
  nameWithMode,
  priceText,
  proRulesText,
  qtyFull,
  qtyLabel,
  requestLineText,
  unitTiny,
} from '../lib/format';
import type { Nav } from '../lib/navigation';
import { ProRequest, requestView, useStore } from '../lib/store';
import { C, F, PAD, R } from '../lib/theme';
import { useToast } from '../lib/toast';
import { useFrame } from '../lib/useFrame';
import { tick } from '../lib/haptics';

type Row =
  | { kind: 'line'; key: string; id: string; qty: number }
  | { kind: 'request'; key: string; request: ProRequest };

/**
 * Ligne de la demande en cours. La quantité se règle par paliers ou par saisie directe : en
 * kilos (avion, offre sans mode) ou en conteneurs (bateau), selon l'offre.
 */
function DraftLine({
  product: p,
  qty,
  onChange,
  onRemove,
  onOpen,
}: {
  product: Product;
  qty: number;
  onChange: (qty: number) => void;
  onRemove: () => void;
  onOpen: () => void;
}) {
  const [text, setText] = useState(String(qty));
  const [note, setNote] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  useEffect(() => setText(String(qty)), [qty]);

  const sea = p.unit !== 'kg';
  const min = minQty(p);
  const max = maxQty(p);
  const kg = kgEquivalent(p, qty);

  const commit = () => {
    // Rien n'a été modifié (ou la saisie vient d'être validée) : le message affiché reste.
    if (text === String(qty)) return;
    const result = checkQuantity(
      {
        unit: p.unit,
        noun: p.noun,
        step: p.step,
        min,
        max,
        strictStep: !!p.strictStep,
        mode: p.mode ?? null,
      },
      text.trim() === '' ? NaN : parseInt(text, 10),
      qty,
    );
    setNote(result.note);
    setText(String(result.qty));
    if (result.qty !== qty) onChange(result.qty);
  };
  const step = (dir: 1 | -1) => {
    tick();
    setNote(null);
    onChange(qty + dir * p.step);
  };
  const atMin = qty <= min;
  const atMax = qty >= max;
  const stepText = qtyLabel(p, p.step);

  return (
    <View style={styles.line}>
      <View style={styles.lineTop}>
        <Pressable
          onPress={onOpen}
          accessibilityRole="button"
          accessibilityLabel={`Voir la fiche ${p.name}`}
          style={({ pressed }) => [styles.art, pressed && { opacity: 0.75 }]}
        >
          <Glow color={p.tint} width={68} opacity={0.6} />
          <Image source={p.image} style={styles.image} contentFit="contain" accessible={false} />
        </Pressable>
        <Pressable
          onPress={onOpen}
          accessibilityRole="button"
          accessibilityLabel={`${nameWithMode(p)}, ${qtyFull(p, qty)}, ${p.noPrice ? 'prix à confirmer' : lineTotalText(p, qty)}. Voir la fiche`}
          style={({ pressed }) => [{ flex: 1 }, pressed && { opacity: 0.7 }]}
        >
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {p.name}
            </Text>
            {p.mode && (
              <View style={styles.modeBadge}>
                <Ionicons name={MODE_ICON[p.mode]} size={13} color={C.leaf} />
                <Text style={styles.modeBadgeText}>{MODE_LABEL[p.mode]}</Text>
              </View>
            )}
          </View>
          <Text style={styles.meta} numberOfLines={1}>
            {p.origin}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {priceText(p)}
            {p.noPrice && (p.shownPrice ?? null) === null ? '' : ` ${unitTiny(p)}`}
          </Text>
          <BumpText
            value={lineTotalText(p, qty)}
            style={[styles.lineTotal, p.noPrice && { color: C.star }]}
          >
            {lineTotalText(p, qty)}
          </BumpText>
        </Pressable>
        <Pressable
          scaleTo={0.88}
          onPress={onRemove}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Retirer ${nameWithMode(p)} de la demande`}
          style={({ pressed }) => [styles.remove, pressed && { opacity: 0.6 }]}
        >
          <Ionicons name="trash-outline" size={17} color={C.danger} />
        </Pressable>
      </View>

      <View style={styles.qtyRow}>
        <Pressable
          scaleTo={0.88}
          onPress={() => step(-1)}
          disabled={atMin}
          accessibilityRole="button"
          accessibilityLabel={`Retirer ${stepText}`}
          accessibilityState={{ disabled: atMin }}
          style={({ pressed }) => [
            styles.qtyBtn,
            pressed && { opacity: 0.55 },
            atMin && { opacity: 0.3 },
          ]}
        >
          <Ionicons name="remove" size={18} color={C.text} />
        </Pressable>
        <KeepsOwnSwipes style={[styles.qtyField, focused && styles.qtyFieldOn]}>
          <TextInput
            focusRing={false}
            onFocus={() => setFocused(true)}
            value={text}
            onChangeText={(t) => setText(t.replace(/\D/g, '').slice(0, 6))}
            onBlur={() => {
              setFocused(false);
              commit();
            }}
            onSubmitEditing={commit}
            keyboardType="number-pad"
            returnKeyType="done"
            selectTextOnFocus
            style={styles.qtyInput}
            accessibilityLabel={
              sea
                ? `Nombre de conteneurs de ${nameWithMode(p)}`
                : `Quantité de ${nameWithMode(p)} en kilos`
            }
          />
          <Text style={styles.qtyUnit}>{sea ? (qty > 1 ? 'conteneurs' : 'conteneur') : 'kg'}</Text>
        </KeepsOwnSwipes>
        <Pressable
          scaleTo={0.88}
          onPress={() => step(1)}
          disabled={atMax}
          accessibilityRole="button"
          accessibilityLabel={`Ajouter ${stepText}`}
          accessibilityState={{ disabled: atMax }}
          style={({ pressed }) => [
            styles.qtyBtn,
            styles.qtyBtnPlus,
            pressed && { opacity: 0.55 },
            atMax && { opacity: 0.3 },
          ]}
        >
          <Ionicons name="add" size={18} color={C.text} />
        </Pressable>
      </View>
      <Text style={styles.rule}>
        {sea && kg ? `Soit ${kgText(kg)}. ` : ''}
        {ruleText(p)}
      </Text>
      {p.noPrice && <Text style={styles.corrected}>{missingPriceText(p)}</Text>}
      {!!note && (
        <Text style={styles.corrected} accessibilityRole="alert" accessibilityLiveRegion="polite">
          {note}
        </Text>
      )}
    </View>
  );
}

export function RequestsScreen() {
  const nav = useNavigation<Nav>();
  const {
    cartLines,
    subtotal,
    unpriced,
    byId,
    baseById,
    rules,
    usesModes,
    requests,
    incoterm,
    setIncoterm,
    setQty,
    setTab,
    reorder,
    cancelRequest,
    advanceRequest,
  } = useStore();
  const toast = useToast();
  const { bottom } = useFrame();

  // Ici, les demandes qui attendent une réponse (ou annulées avant d'être prises en charge).
  const waiting = requests.filter((r) => r.takenAt === null);

  const sections = [
    {
      key: 'draft',
      title: 'Demande en cours',
      data: cartLines.map((l): Row => ({ kind: 'line', key: `l-${l.id}`, ...l })),
    },
    {
      key: 'sent',
      title: 'Demandes envoyées',
      data: waiting.map((request): Row => ({ kind: 'request', key: `r-${request.id}`, request })),
    },
  ];

  // Une ligne « mangue:avion » ouvre la fiche du produit « mangue ».
  const open = (id: string) => {
    const productId = id.split(':')[0];
    if (byId[productId]) nav.navigate('Product', { id: productId });
  };

  const remove = (id: string, qty: number) => {
    setQty(id, 0);
    toast(`${nameWithMode(byId[id])} retiré de la demande`, {
      icon: 'trash-outline',
      tint: C.textDim,
      action: { label: 'Annuler', onPress: () => setQty(id, qty) },
    });
  };

  return (
    <SectionList
      sections={sections}
      style={PAGE_SCROLL}
      keyExtractor={(row) => row.key}
      stickySectionHeadersEnabled={false}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: TAB_BAR_SPACE + bottom + 16 }}
      ListHeaderComponent={
        <TabHeader
          title="Mes"
          accent="demandes"
          subtitle={`${proRulesText(rules, usesModes)} · sans paiement dans l’application`}
        />
      }
      renderSectionHeader={({ section }) => (
        <Text style={styles.sectionTitle} accessibilityRole="header">
          {section.title}
        </Text>
      )}
      renderItem={({ item }) => {
        if (item.kind === 'line') {
          const p = byId[item.id];
          return (
            <DraftLine
              product={p}
              qty={item.qty}
              onChange={(q) => setQty(p.id, q)}
              onRemove={() => remove(p.id, item.qty)}
              onOpen={() => open(p.id)}
            />
          );
        }
        const r = item.request;
        return (
          <TrackCard
            title={r.number}
            date={`Demande du ${formatDate(r.createdAt)}`}
            view={requestView(r)}
            messageLabel="Suivi"
            info={[
              {
                icon: 'pricetag-outline',
                text: `Prix ${r.incoterm}${r.destination ? ` · destination : ${r.destination}` : ''}`,
              },
              r.transmitted
                ? { icon: 'cloud-done-outline', text: 'Transmise à notre équipe' }
                : {
                    icon: 'cloud-offline-outline',
                    text: 'Enregistrée sur cet appareil · transmission à notre équipe pas encore connectée',
                  },
            ]}
            lines={r.lines.map((l) =>
              requestLineText(l, baseById[l.id.split(':')[0]]?.name ?? l.id),
            )}
            lineIds={r.lines.map((l) => l.id)}
            totalOver={`Estimation ${r.incoterm}${r.unpriced ? ` · hors ${r.unpriced} ligne${r.unpriced > 1 ? 's' : ''} sans prix` : ''}\nRien n’est payé`}
            total={euro(r.subtotal)}
            action={{
              label: 'Renouveler',
              icon: 'refresh',
              onPress: () => {
                reorder(r.lines);
                toast('Produits ajoutés à votre demande en cours');
              },
            }}
            onOpenProduct={open}
            onCancel={r.status === 'attente' ? () => cancelRequest(r.id) : undefined}
            onTest={() => {
              if (advanceRequest(r.id) === 'confirmee') {
                toast('Test : confirmée, à suivre dans Commandes', {
                  action: { label: 'Voir', onPress: () => setTab('orders') },
                });
              }
            }}
          />
        );
      }}
      renderSectionFooter={({ section }) =>
        section.key === 'draft' ? (
          cartLines.length > 0 ? (
            <View style={styles.summary}>
              <View style={styles.priceRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.priceLabel}>Prix affichés</Text>
                  <Text style={styles.priceHelp}>{INCOTERM_SHORT[incoterm]}</Text>
                </View>
                <IncotermToggle value={incoterm} onChange={setIncoterm} />
              </View>
              <View style={styles.divider} />
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Estimation {incoterm}</Text>
                <BumpText value={subtotal} style={styles.totalValue}>
                  {euro(subtotal)}
                </BumpText>
              </View>
              {unpriced > 0 && (
                <Text style={styles.priceHelp}>
                  Hors {unpriced} ligne{unpriced > 1 ? 's' : ''} dont le prix reste à confirmer par
                  notre équipe.
                </Text>
              )}
              <PrimaryButton
                label="Finaliser la demande"
                onPress={() => nav.navigate('Request')}
                style={{ marginTop: 4 }}
              />
            </View>
          ) : (
            <View style={styles.hintBox}>
              <Text style={styles.hint}>
                Ajoutez des produits depuis le catalogue pour préparer une demande.{' '}
                {proRulesText(rules, usesModes)}.
              </Text>
              <Pressable
                onPress={() => setTab('home')}
                accessibilityRole="button"
                style={({ pressed }) => [styles.hintLink, pressed && { opacity: 0.6 }]}
              >
                <Text style={styles.hintLinkText}>Parcourir le catalogue</Text>
                <Ionicons name="arrow-forward" size={16} color={C.leaf} />
              </Pressable>
            </View>
          )
        ) : waiting.length === 0 ? (
          <View style={styles.hintBox}>
            <Text style={styles.hint}>
              Aucune demande en attente. Celles que notre équipe a confirmées se suivent dans «
              Commandes ».
            </Text>
          </View>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    marginTop: 8,
    marginBottom: 12,
    paddingHorizontal: PAD,
    color: C.text,
    fontFamily: F.display,
    fontSize: 20,
    lineHeight: 26,
  },

  line: {
    marginHorizontal: PAD,
    marginBottom: 12,
    padding: 12,
    borderRadius: R.lg,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.line,
  },
  lineTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  art: { width: 68, height: 68, alignItems: 'center', justifyContent: 'center' },
  image: { width: 56, height: 56 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flexShrink: 1, color: C.text, fontFamily: F.bold, fontSize: 16, lineHeight: 21 },
  modeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 22,
    paddingHorizontal: 8,
    borderRadius: 11,
    backgroundColor: C.leafWash,
  },
  modeBadgeText: { color: C.leaf, fontFamily: F.bold, fontSize: 11.5 },
  rule: { marginTop: 8, color: C.textFaint, fontFamily: F.medium, fontSize: 12.5, lineHeight: 18 },
  meta: { marginTop: 1, color: C.textFaint, fontFamily: F.medium, fontSize: 12.5, lineHeight: 17 },
  lineTotal: {
    marginTop: 6,
    color: C.text,
    fontFamily: F.heavy,
    fontSize: 16,
    lineHeight: 21,
    fontVariant: ['tabular-nums'],
  },
  remove: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surfaceStrong,
  },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  qtyBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.line,
  },
  qtyBtnPlus: { backgroundColor: C.surfaceStrong },
  qtyField: {
    flex: 1,
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    borderRadius: R.pill,
    borderWidth: 1,
    borderColor: C.lineStrong,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  qtyFieldOn: { borderColor: C.leaf, backgroundColor: 'rgba(255,255,255,0.07)' },
  qtyInput: {
    flex: 1,
    minWidth: 0,
    height: '100%',
    color: C.text,
    fontFamily: F.heavy,
    fontSize: 16,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  qtyUnit: { color: C.textDim, fontFamily: F.semi, fontSize: 14 },
  corrected: { marginTop: 8, color: C.textDim, fontFamily: F.semi, fontSize: 12.5, lineHeight: 18 },

  summary: {
    marginHorizontal: PAD,
    marginBottom: 22,
    padding: 16,
    gap: 12,
    borderRadius: R.lg,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.line,
  },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  priceLabel: { color: C.text, fontFamily: F.bold, fontSize: 14.5 },
  priceHelp: {
    marginTop: 2,
    color: C.textDim,
    fontFamily: F.medium,
    fontSize: 12.5,
    lineHeight: 18,
  },
  divider: { height: 1, backgroundColor: C.line },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
  },
  totalLabel: { color: C.textDim, fontFamily: F.semi, fontSize: 15 },
  totalValue: { color: C.text, fontFamily: F.heavy, fontSize: 22, fontVariant: ['tabular-nums'] },

  hintBox: {
    marginHorizontal: PAD,
    marginBottom: 22,
    padding: 16,
    borderRadius: R.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: C.lineStrong,
  },
  hint: { color: C.textDim, fontFamily: F.medium, fontSize: 14, lineHeight: 21 },
  hintLink: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, marginTop: 4 },
  hintLinkText: { color: C.leaf, fontFamily: F.bold, fontSize: 14.5 },
});
