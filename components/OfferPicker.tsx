import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { IncotermToggle } from './IncotermToggle';
import { TextInput } from './Input';
import { BumpText } from './Motion';
import { KeepsOwnSwipes } from './PageSwipe';
import { Pressable } from './Tap';
import { checkQuantity } from '../lib/catalog/rules';
import type { Product } from '../lib/data';
import {
  MODE_LABEL,
  euro,
  kgEquivalent,
  kgText,
  lineTotalText,
  maxQty,
  minQty,
  priceText,
  qtyLabel,
  unitShort,
} from '../lib/format';
import type { Incoterm } from '../lib/store';
import { C, F, R } from '../lib/theme';
import { tick } from '../lib/haptics';

export const MODE_ICON = { avion: 'airplane-outline', bateau: 'boat-outline' } as const;

/** Règle de quantité d'une offre, en une phrase. */
export function ruleText(line: Product) {
  if (line.unit === 'kg') {
    return line.strictStep
      ? `Minimum ${qtyLabel(line, minQty(line))}, puis par paliers de ${qtyLabel(line, line.step)}.`
      : `Minimum ${qtyLabel(line, minQty(line))}.`;
  }
  const weight = line.containerKg
    ? `${kgText(line.containerKg)} par conteneur${line.containerLabel ? ` (référence ${line.containerLabel})` : ''}`
    : 'poids par conteneur non défini';
  return `Minimum ${qtyLabel(line, minQty(line))} · ${weight}.`;
}

/** Ce qu'il faut dire quand le prix d'une offre n'est pas défini. */
export function missingPriceText(line: Product) {
  return line.missing === 'poids'
    ? 'Le poids du conteneur n’est pas défini pour cette offre : le total ne peut pas être calculé. Notre équipe vous le confirmera.'
    : 'Prix non communiqué pour cette offre. Vous pouvez envoyer votre demande : notre équipe vous indiquera le prix.';
}

type Props = {
  /** Produit du catalogue professionnel. */
  product: Product;
  /** Offre sélectionnée (avion, bateau, ou l'offre unique du produit). */
  line: Product;
  onSelectLine: (id: string) => void;
  qty: number;
  onQty: (qty: number) => void;
  /** Quantité de cette offre déjà dans la demande en cours. */
  inCart: number;
  incoterm: Incoterm;
  onIncoterm: (i: Incoterm) => void;
};

/**
 * Choix d'une offre professionnelle : mode de transport, prix, puis quantité par boutons
 * rapides ou par saisie directe. Minimums, paliers et poids des conteneurs viennent du
 * catalogue ; rien n'est fixé ici.
 */
export function OfferPicker({
  product,
  line,
  onSelectLine,
  qty,
  onQty,
  inCart,
  incoterm,
  onIncoterm,
}: Props) {
  const offers = product.offers ?? [];
  const [typed, setTyped] = useState('');
  const [note, setNote] = useState<string | null>(null);

  // En changeant d'offre, la saisie et son message repartent de zéro.
  useEffect(() => {
    setTyped('');
    setNote(null);
  }, [line.id]);

  const min = minQty(line);
  const max = maxQty(line);
  const quick = [1, 2, 3, 4].map((k) => min * k).filter((q) => q <= max);
  const sea = line.unit !== 'kg';
  const kg = kgEquivalent(line, qty);

  const commit = () => {
    if (typed.trim() === '') return;
    const result = checkQuantity(
      {
        unit: line.unit,
        noun: line.noun,
        step: line.step,
        min,
        max,
        strictStep: !!line.strictStep,
        mode: line.mode ?? null,
      },
      parseInt(typed, 10),
      qty,
    );
    setNote(result.note);
    setTyped('');
    if (result.qty !== qty) onQty(result.qty);
  };

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title} accessibilityRole="header">
          Offre professionnelle
        </Text>
        <IncotermToggle value={incoterm} onChange={onIncoterm} />
      </View>

      {offers.length > 0 && (
        <View style={styles.modes} accessibilityRole="radiogroup">
          {offers.map((o) => {
            const on = o.id === line.id;
            const mode = o.mode ?? null;
            return (
              <Pressable
                key={o.id}
                onPress={() => {
                  if (on) return;
                  tick();
                  onSelectLine(o.id);
                }}
                disabled={offers.length === 1}
                scaleTo={0.95}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                aria-checked={on}
                accessibilityLabel={`Transport par ${mode ?? 'défaut'}${o.noPrice ? ', prix à confirmer' : ''}`}
                style={[styles.mode, on && styles.modeOn]}
              >
                {mode && (
                  <Ionicons name={MODE_ICON[mode]} size={18} color={on ? C.onLeaf : C.textDim} />
                )}
                <Text style={[styles.modeText, on && styles.modeTextOn]}>
                  {mode ? MODE_LABEL[mode] : 'Standard'}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <View style={styles.priceRow}>
        <Text style={[styles.price, line.noPrice && styles.priceMissing]}>{priceText(line)}</Text>
        {!(line.noPrice && (line.shownPrice ?? null) === null) && (
          <Text style={styles.priceUnit}>{unitShort(line)}</Text>
        )}
      </View>
      {sea && !line.noPrice && line.shownUnit === 'le kg' && !!line.containerKg && (
        <Text style={styles.sub}>
          Soit {euro(line.price)} le conteneur de {kgText(line.containerKg)}.
        </Text>
      )}
      {line.noPrice && (
        <Text style={styles.missing} accessibilityRole="alert">
          {missingPriceText(line)}
        </Text>
      )}
      <Text style={styles.sub}>{ruleText(line)}</Text>

      <Text style={styles.label}>{sea ? 'Nombre de conteneurs' : 'Quantité'}</Text>
      <View style={styles.quick}>
        {quick.map((q) => {
          const on = q === qty;
          return (
            <Pressable
              key={q}
              onPress={() => {
                tick();
                setNote(null);
                onQty(q);
              }}
              scaleTo={0.93}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              aria-pressed={on}
              accessibilityLabel={`Choisir ${qtyLabel(line, q)}`}
              style={[styles.chip, on && styles.chipOn]}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>
                {sea ? String(q) : qtyLabel(line, q)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <KeepsOwnSwipes style={styles.inputRow}>
        <TextInput
          value={typed}
          onChangeText={(t) => setTyped(t.replace(/\D/g, '').slice(0, 6))}
          onBlur={commit}
          onSubmitEditing={commit}
          placeholder={sea ? 'Autre nombre' : 'Autre quantité'}
          placeholderTextColor={C.textFaint}
          keyboardType="number-pad"
          returnKeyType="done"
          style={styles.input}
          accessibilityLabel={
            sea ? 'Saisir un autre nombre de conteneurs' : 'Saisir une autre quantité en kilos'
          }
        />
        <Text style={styles.inputUnit}>{sea ? 'conteneurs' : 'kg'}</Text>
        <Pressable
          onPress={commit}
          disabled={typed.trim() === ''}
          scaleTo={0.92}
          accessibilityRole="button"
          accessibilityLabel="Valider la quantité saisie"
          accessibilityState={{ disabled: typed.trim() === '' }}
          style={[styles.ok, typed.trim() === '' && { opacity: 0.4 }]}
        >
          <Text style={styles.okText}>OK</Text>
        </Pressable>
      </KeepsOwnSwipes>
      {!!note && (
        <Text style={styles.note} accessibilityRole="alert" accessibilityLiveRegion="polite">
          {note}
        </Text>
      )}

      <View style={styles.result}>
        <View style={{ flex: 1 }}>
          <Text style={styles.resultOver}>Votre choix</Text>
          <BumpText value={qty} amount={1.05} style={styles.resultQty}>
            {qtyLabel(line, qty)}
            {sea && kg ? ` · ${kgText(kg)}` : ''}
          </BumpText>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.resultOver}>Total {incoterm}</Text>
          <BumpText
            value={lineTotalText(line, qty)}
            amount={1.05}
            style={[styles.resultTotal, line.noPrice && styles.priceMissing]}
          >
            {lineTotalText(line, qty)}
          </BumpText>
        </View>
      </View>
      {inCart > 0 && (
        <Text style={styles.sub}>Déjà dans votre demande : {qtyLabel(line, inCart)}.</Text>
      )}
      <Text style={styles.foot}>
        Aucun paiement dans l’application : notre équipe vous contacte après votre demande.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 16,
    padding: 16,
    borderRadius: R.lg,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.line,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  title: { flexShrink: 1, color: C.text, fontFamily: F.display, fontSize: 19, lineHeight: 24 },
  modes: { flexDirection: 'row', gap: 8, marginTop: 14 },
  mode: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: R.pill,
    borderWidth: 1,
    borderColor: C.lineStrong,
  },
  modeOn: { backgroundColor: C.leaf, borderColor: C.leaf },
  modeText: { color: C.textDim, fontFamily: F.bold, fontSize: 15 },
  modeTextOn: { color: C.onLeaf, fontFamily: F.heavy },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 14,
  },
  price: { color: C.text, fontFamily: F.heavy, fontSize: 22, fontVariant: ['tabular-nums'] },
  priceMissing: { color: C.star },
  priceUnit: { color: C.textDim, fontFamily: F.medium, fontSize: 14 },
  sub: { marginTop: 6, color: C.textDim, fontFamily: F.medium, fontSize: 13.5, lineHeight: 20 },
  missing: { marginTop: 6, color: C.text, fontFamily: F.semi, fontSize: 13.5, lineHeight: 20 },
  label: { marginTop: 16, marginBottom: 8, color: C.textDim, fontFamily: F.semi, fontSize: 13 },
  quick: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minWidth: 52,
    minHeight: 44,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: R.pill,
    borderWidth: 1,
    borderColor: C.lineStrong,
  },
  chipOn: { backgroundColor: C.leafWash, borderColor: C.leaf },
  chipText: { color: C.text, fontFamily: F.bold, fontSize: 14, fontVariant: ['tabular-nums'] },
  chipTextOn: { color: C.leaf, fontFamily: F.heavy },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  input: {
    flex: 1,
    minWidth: 0,
    height: 48,
    borderRadius: R.pill,
    borderWidth: 1,
    borderColor: C.lineStrong,
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingHorizontal: 18,
    color: C.text,
    fontFamily: F.bold,
    fontSize: 16,
    fontVariant: ['tabular-nums'],
  },
  inputUnit: { color: C.textDim, fontFamily: F.semi, fontSize: 14 },
  ok: {
    minWidth: 56,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: R.pill,
    backgroundColor: C.surfaceStrong,
  },
  okText: { color: C.text, fontFamily: F.heavy, fontSize: 14 },
  note: { marginTop: 8, color: C.star, fontFamily: F.semi, fontSize: 13.5, lineHeight: 19 },
  result: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: C.line,
  },
  resultOver: { color: C.textFaint, fontFamily: F.semi, fontSize: 12, lineHeight: 16 },
  resultQty: { marginTop: 2, color: C.text, fontFamily: F.bold, fontSize: 15.5, lineHeight: 21 },
  resultTotal: {
    marginTop: 2,
    color: C.text,
    fontFamily: F.heavy,
    fontSize: 19,
    lineHeight: 24,
    fontVariant: ['tabular-nums'],
  },
  foot: { marginTop: 12, color: C.textFaint, fontFamily: F.medium, fontSize: 12.5, lineHeight: 18 },
});
