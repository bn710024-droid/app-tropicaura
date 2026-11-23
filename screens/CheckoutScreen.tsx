import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BumpText, ErrorText } from '../components/Motion';
import { Pressable } from '../components/Tap';
import { TextInput } from '../components/Input';
import { useNavigation } from '@react-navigation/native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AddressSheet } from '../components/AddressSheet';
import { Backdrop } from '../components/Backdrop';
import { PrimaryButton, RoundButton } from '../components/Buttons';
import { EmptyState } from '../components/EmptyState';
import { countryName, transportFee } from '../lib/countries';
import { PAYMENTS } from '../lib/data';
import { euro, formatAddress, round2 } from '../lib/format';
import { isPhone } from '../lib/identity';
import type { Nav } from '../lib/navigation';
import { useStore } from '../lib/store';
import { C, F, PAD, R } from '../lib/theme';
import { useFrame } from '../lib/useFrame';
import { success, tick, warn } from '../lib/haptics';

const NOTE_MAX = 140;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function Option({
  title,
  detail,
  price,
  icon,
  selected,
  onPress,
}: {
  title: string;
  detail: string;
  /** Ligne de prix, sous le détail. */
  price?: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={() => {
        tick();
        onPress();
      }}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={[title, detail, price].filter(Boolean).join(', ')}
      style={({ pressed }) => [
        styles.option,
        selected && styles.optionOn,
        pressed && { opacity: 0.7 },
      ]}
    >
      <View style={[styles.optionIcon, selected && { backgroundColor: C.leaf }]}>
        <Ionicons name={icon} size={18} color={selected ? C.onLeaf : C.textDim} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.optionTitle}>{title}</Text>
        <Text style={styles.optionDetail}>{detail}</Text>
        {!!price && <Text style={styles.optionPrice}>{price}</Text>}
      </View>
      <Ionicons
        name={selected ? 'radio-button-on' : 'radio-button-off'}
        size={22}
        color={selected ? C.leaf : C.textFaint}
      />
    </Pressable>
  );
}

export function CheckoutScreen() {
  const nav = useNavigation<Nav>();
  const { account, cartLines, subtotal, address, contact, placeOrder, setTab } = useStore();
  const { top, bottom } = useFrame();
  const [transport, setTransport] = useState(true);
  const [paymentId, setPaymentId] = useState<string>(PAYMENTS[0].id);
  const [email, setEmail] = useState(contact.email || account?.email || '');
  const [phone, setPhone] = useState(contact.phone || account?.phone || '');
  const [note, setNote] = useState('');
  const [sheet, setSheet] = useState(false);
  const [errors, setErrors] = useState<{ address?: string; email?: string; phone?: string }>({});
  // Validation en cours : un second appui ne peut pas créer une seconde commande.
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const alive = useRef(true);
  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );
  const scrollRef = useRef<ScrollView>(null);
  const contactY = useRef(0);

  // Le transport est forfaitaire, selon le pays de destination. Sans transport, rien n'est ajouté.
  const fee = address ? transportFee(address.country) : null;
  const transportCost = transport ? (fee ?? 0) : 0;
  const total = round2(subtotal + transportCost);
  const destination = address ? countryName(address.country) : '';

  const confirm = () => {
    if (sending.current) return;
    const mail = email.trim();
    const tel = phone.trim();
    const next: typeof errors = {};
    if (!address) next.address = 'Ajoutez votre adresse pour continuer.';
    if (!EMAIL.test(mail))
      next.email = 'Indiquez une adresse e-mail valide, par exemple nom@exemple.com.';
    if (transport && !tel) {
      next.phone =
        'Le transporteur a besoin d’un numéro pour vous livrer. Ajoutez-le avec l’indicatif du pays.';
    } else if (tel && !isPhone(tel)) {
      next.phone = 'Ce numéro semble incomplet. Ajoutez l’indicatif du pays.';
    }
    setErrors(next);
    if (next.address) {
      warn();
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    if (next.email || next.phone) {
      warn();
      scrollRef.current?.scrollTo({ y: Math.max(0, contactY.current - 12), animated: true });
      return;
    }
    const payment = PAYMENTS.find((p) => p.id === paymentId) ?? PAYMENTS[0];
    sending.current = true;
    setBusy(true);
    // Aucun prestataire de paiement n'est branché : cette courte attente tient lieu de réponse.
    // L'écran de réussite ne s'ouvre qu'une fois la commande réellement enregistrée.
    setTimeout(() => {
      if (!alive.current) return;
      const order = placeOrder({
        transport,
        payment: payment.title,
        note: note.trim(),
        contact: { email: mail, phone: tel },
      });
      success();
      nav.replace('Success', { orderId: order.id });
    }, 600);
  };

  const header = (
    <View style={[styles.header, { paddingTop: top + 4 }]}>
      <RoundButton icon="close" label="Fermer" onPress={() => nav.goBack()} />
      <Text style={styles.headerTitle} accessibilityRole="header">
        Votre commande
      </Text>
      <View style={{ width: 46 }} />
    </View>
  );

  if (cartLines.length === 0) {
    return (
      <View style={styles.root}>
        <Backdrop />
        {header}
        <EmptyState
          title="Rien à commander"
          body="Votre panier est vide. Ajoutez quelques produits avant de passer commande."
          cta="Parcourir l’étal"
          onPress={() => {
            setTab('home');
            nav.popToTop();
          }}
        />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Backdrop />
      {header}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: PAD, paddingBottom: 24 }}
        >
          <Text style={styles.section} accessibilityRole="header">
            Adresse
          </Text>
          {address ? (
            <Pressable
              onPress={() => setSheet(true)}
              accessibilityRole="button"
              accessibilityLabel={`Adresse : ${address.name}, ${formatAddress(address)}. Modifier`}
              style={({ pressed }) => [styles.option, pressed && { opacity: 0.7 }]}
            >
              <View style={[styles.optionIcon, { backgroundColor: C.leafWash }]}>
                <Ionicons name="location-outline" size={18} color={C.leaf} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.optionTitle} numberOfLines={1}>
                  {address.name}
                </Text>
                <Text style={styles.optionDetail} numberOfLines={3}>
                  {formatAddress(address)}
                </Text>
              </View>
              <Text style={styles.edit}>Modifier</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => setSheet(true)}
              accessibilityRole="button"
              accessibilityLabel="Ajouter votre adresse"
              style={({ pressed }) => [
                styles.option,
                styles.addAddress,
                !!errors.address && { borderColor: C.danger },
                pressed && { opacity: 0.7 },
              ]}
            >
              <View style={[styles.optionIcon, { backgroundColor: C.leafWash }]}>
                <Ionicons name="add" size={20} color={C.leaf} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.optionTitle}>Ajouter votre adresse</Text>
                <Text style={styles.optionDetail}>Pays, ville et rue, ou votre position</Text>
              </View>
            </Pressable>
          )}
          {!!errors.address && !address && (
            <ErrorText style={styles.error}>{errors.address}</ErrorText>
          )}

          <Text style={styles.section} accessibilityRole="header">
            Transport
          </Text>
          <View accessibilityRole="radiogroup" style={styles.group}>
            <Option
              title="Avec transport"
              detail={
                destination
                  ? `Nous expédions du Sénégal jusqu’à votre adresse · ${destination}`
                  : 'Nous expédions du Sénégal jusqu’à votre adresse'
              }
              price={fee == null ? 'Tarif selon le pays de destination' : `+ ${euro(fee)}`}
              icon="airplane-outline"
              selected={transport}
              onPress={() => setTransport(true)}
            />
            <Option
              title="Sans transport"
              detail="Vous organisez vous-même l’enlèvement et le transport"
              price="Aucun frais de transport"
              icon="cube-outline"
              selected={!transport}
              onPress={() => setTransport(false)}
            />
          </View>
          {!transport && (
            <Text style={styles.hint}>
              Votre commande sera mise à disposition à notre entrepôt au Sénégal. L’adresse et les
              horaires d’enlèvement vous sont communiqués à la validation de la commande.
            </Text>
          )}

          <View
            onLayout={(e) => {
              contactY.current = e.nativeEvent.layout.y;
            }}
          >
            <Text style={styles.section} accessibilityRole="header">
              Vos coordonnées
            </Text>
            <Text style={styles.sectionHint}>
              Pour la confirmation et le suivi de votre commande
              {transport ? ', et pour le transporteur' : ''}.
            </Text>
            <Text style={styles.fieldLabel}>E-mail</Text>
            <TextInput
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                setErrors((e) => ({ ...e, email: undefined }));
              }}
              placeholder="nom@exemple.com"
              placeholderTextColor={C.textFaint}
              style={[styles.input, !!errors.email && { borderColor: C.danger }]}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="next"
              maxLength={80}
              accessibilityLabel="E-mail"
            />
            {!!errors.email && <ErrorText style={styles.error}>{errors.email}</ErrorText>}
            <Text style={styles.fieldLabel}>
              Téléphone ou WhatsApp
              {transport ? null : <Text style={styles.optional}> · facultatif</Text>}
            </Text>
            <TextInput
              value={phone}
              onChangeText={(t) => {
                setPhone(t);
                setErrors((e) => ({ ...e, phone: undefined }));
              }}
              placeholder="Avec l’indicatif du pays"
              placeholderTextColor={C.textFaint}
              style={[styles.input, !!errors.phone && { borderColor: C.danger }]}
              keyboardType="phone-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
              returnKeyType="done"
              maxLength={24}
              accessibilityLabel={
                transport ? 'Téléphone ou WhatsApp' : 'Téléphone ou WhatsApp, facultatif'
              }
            />
            {!!errors.phone && <ErrorText style={styles.error}>{errors.phone}</ErrorText>}
          </View>

          <Text style={styles.section} accessibilityRole="header">
            Paiement
          </Text>
          <Text style={styles.sectionHint}>
            Vous réglez maintenant, à la confirmation de la commande.
          </Text>
          <View accessibilityRole="radiogroup" style={[styles.group, { marginTop: 12 }]}>
            {PAYMENTS.map((p) => (
              <Option
                key={p.id}
                title={p.title}
                detail={p.detail}
                icon={p.icon}
                selected={paymentId === p.id}
                onPress={() => setPaymentId(p.id)}
              />
            ))}
          </View>

          <View style={styles.noteHead}>
            <Text
              style={[styles.section, { marginTop: 0, marginBottom: 0 }]}
              accessibilityRole="header"
            >
              {transport ? 'Un mot pour le livreur' : 'Un mot pour notre équipe'}
            </Text>
            <Text style={styles.counter}>
              {note.length}/{NOTE_MAX}
            </Text>
          </View>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder={
              transport
                ? 'Code d’entrée, étage, interphone…'
                : 'Nom de votre transporteur, date d’enlèvement souhaitée…'
            }
            placeholderTextColor={C.textFaint}
            style={styles.note}
            multiline
            maxLength={NOTE_MAX}
            textAlignVertical="top"
            accessibilityLabel={
              transport
                ? 'Instructions pour le livreur, facultatif'
                : 'Message pour notre équipe, facultatif'
            }
          />

          <View style={styles.summary}>
            <View style={styles.sumRow}>
              <Text style={styles.sumLabel}>
                Produits · {cartLines.length} article{cartLines.length > 1 ? 's' : ''}
              </Text>
              <Text style={styles.sumValue}>{euro(subtotal)}</Text>
            </View>
            {transport && (
              <Animated.View
                entering={FadeInDown.duration(200)}
                exiting={FadeOut.duration(120)}
                style={styles.sumRow}
              >
                <Text style={styles.sumLabel} numberOfLines={1}>
                  Transport{destination ? ` · ${destination}` : ''}
                </Text>
                <Text style={[styles.sumValue, fee == null && styles.sumMuted]}>
                  {fee == null ? 'Selon le pays' : euro(fee)}
                </Text>
              </Animated.View>
            )}
            <View style={styles.divider} />
            <View style={styles.sumRow}>
              <Text style={styles.totalLabel}>
                {transport ? 'Total à payer' : 'Total sans transport'}
              </Text>
              <BumpText value={total} style={styles.totalValue}>
                {euro(total)}
              </BumpText>
            </View>
            {!transport && (
              <Text style={styles.sumNote}>
                Prix sans transport : vous organisez vous-même l’enlèvement et l’acheminement.
              </Text>
            )}
            {transport && fee == null && (
              <Text style={styles.sumNote}>
                Ajoutez votre adresse : le transport s’ajoutera à ce total.
              </Text>
            )}
          </View>

          <View style={styles.demo}>
            <Ionicons name="information-circle-outline" size={17} color={C.textDim} />
            <Text style={styles.demoText}>
              Application de démonstration : aucun paiement n’est prélevé, aucun message n’est
              réellement envoyé et aucune commande n’est transmise.
            </Text>
          </View>
        </ScrollView>

        <View style={[styles.bar, { paddingBottom: bottom + 4 }]}>
          <PrimaryButton
            label="Payer et confirmer"
            trailing={euro(total)}
            onPress={confirm}
            loading={busy}
            loadingLabel="Paiement simulé…"
          />
        </View>
      </KeyboardAvoidingView>
      <AddressSheet visible={sheet} onClose={() => setSheet(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 10,
  },
  headerTitle: { color: C.text, fontFamily: F.display, fontSize: 20 },
  section: {
    marginTop: 26,
    marginBottom: 12,
    color: C.text,
    fontFamily: F.display,
    fontSize: 19,
    lineHeight: 24,
  },
  sectionHint: {
    marginTop: -6,
    color: C.textDim,
    fontFamily: F.medium,
    fontSize: 13.5,
    lineHeight: 19,
  },
  group: { gap: 10 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    minHeight: 66,
    borderRadius: R.lg,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.line,
  },
  optionOn: { borderColor: 'rgba(168,213,79,0.5)', backgroundColor: C.leafWash },
  addAddress: { borderStyle: 'dashed', borderColor: C.lineStrong },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surfaceStrong,
  },
  optionTitle: { color: C.text, fontFamily: F.bold, fontSize: 15, lineHeight: 20 },
  optionDetail: {
    marginTop: 1,
    color: C.textDim,
    fontFamily: F.medium,
    fontSize: 13.5,
    lineHeight: 19,
  },
  optionPrice: {
    marginTop: 5,
    color: C.text,
    fontFamily: F.heavy,
    fontSize: 14,
    lineHeight: 19,
    fontVariant: ['tabular-nums'],
  },
  edit: { color: C.leaf, fontFamily: F.bold, fontSize: 14, paddingHorizontal: 4 },
  hint: {
    marginTop: 10,
    paddingHorizontal: 4,
    color: C.textDim,
    fontFamily: F.medium,
    fontSize: 13.5,
    lineHeight: 20,
  },
  error: {
    marginTop: 8,
    paddingHorizontal: 4,
    color: C.danger,
    fontFamily: F.semi,
    fontSize: 13.5,
    lineHeight: 19,
  },

  fieldLabel: {
    marginTop: 14,
    marginBottom: 7,
    color: C.textDim,
    fontFamily: F.semi,
    fontSize: 13,
  },
  optional: { color: C.textFaint, fontFamily: F.medium },
  input: {
    height: 52,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.lineStrong,
    backgroundColor: C.surface,
    paddingHorizontal: 16,
    color: C.text,
    fontFamily: F.semi,
    fontSize: 16,
  },

  noteHead: {
    marginTop: 26,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  counter: {
    color: C.textFaint,
    fontFamily: F.semi,
    fontSize: 12.5,
    fontVariant: ['tabular-nums'],
  },
  note: {
    minHeight: 92,
    padding: 16,
    paddingTop: 14,
    borderRadius: R.lg,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.lineStrong,
    color: C.text,
    fontFamily: F.semi,
    fontSize: 16,
    lineHeight: 22,
  },

  summary: {
    marginTop: 26,
    padding: 18,
    gap: 12,
    borderRadius: R.lg,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.line,
  },
  sumRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
  },
  sumLabel: { flexShrink: 1, color: C.textDim, fontFamily: F.semi, fontSize: 15 },
  sumValue: { color: C.text, fontFamily: F.bold, fontSize: 15, fontVariant: ['tabular-nums'] },
  sumMuted: { color: C.textDim },
  divider: { height: 1, backgroundColor: C.line, marginVertical: 2 },
  totalLabel: { color: C.text, fontFamily: F.display, fontSize: 20 },
  totalValue: { color: C.text, fontFamily: F.heavy, fontSize: 24, fontVariant: ['tabular-nums'] },
  sumNote: { color: C.textFaint, fontFamily: F.medium, fontSize: 13, lineHeight: 19 },

  demo: { flexDirection: 'row', gap: 9, marginTop: 16, paddingHorizontal: 4 },
  demoText: { flex: 1, color: C.textFaint, fontFamily: F.medium, fontSize: 13, lineHeight: 19 },

  bar: {
    paddingHorizontal: PAD,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.line,
    backgroundColor: 'rgba(11,14,9,0.92)',
  },
});
