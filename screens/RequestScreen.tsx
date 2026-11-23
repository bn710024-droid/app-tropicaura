import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BumpText, ErrorText } from '../components/Motion';
import { TextInput } from '../components/Input';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Backdrop } from '../components/Backdrop';
import { PrimaryButton, RoundButton } from '../components/Buttons';
import { EmptyState } from '../components/EmptyState';
import { INCOTERM_HELP, IncotermToggle } from '../components/IncotermToggle';
import { euro, lineTotalText, nameWithMode, proRulesText, qtyFull } from '../lib/format';
import { isEmail, isPhone } from '../lib/identity';
import type { Nav } from '../lib/navigation';
import { useStore } from '../lib/store';
import { C, F, PAD, R } from '../lib/theme';
import { useFrame } from '../lib/useFrame';
import { success, warn } from '../lib/haptics';

const NOTE_MAX = 300;

type Errors = { phone?: string; email?: string; whatsapp?: string; name?: string };

/** Finalisation d'une demande professionnelle : prix EXW ou FOB, coordonnées, aucun paiement. */
export function RequestScreen() {
  const nav = useNavigation<Nav>();
  const {
    account,
    cartLines,
    subtotal,
    byId,
    incoterm,
    setIncoterm,
    placeRequest,
    updateAccount,
    setTab,
    unpriced,
    rules,
    usesModes,
  } = useStore();
  const { top, bottom } = useFrame();
  const [name, setName] = useState(account?.name ?? '');
  const [company, setCompany] = useState(account?.company ?? '');
  const [phone, setPhone] = useState(account?.phone ?? '');
  const [email, setEmail] = useState(account?.email ?? '');
  const [whatsapp, setWhatsapp] = useState(account?.whatsapp ?? '');
  const [destination, setDestination] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Errors>({});
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

  const send = () => {
    if (sending.current) return;
    const next: Errors = {};
    if (name.trim().length < 2) next.name = 'Indiquez le nom de la personne à contacter.';
    if (!isPhone(phone)) next.phone = 'Indiquez un numéro de téléphone avec l’indicatif du pays.';
    if (!isEmail(email))
      next.email = 'Indiquez une adresse e-mail valide, par exemple nom@exemple.com.';
    if (whatsapp.trim() && !isPhone(whatsapp)) {
      next.whatsapp = 'Ce numéro WhatsApp semble incomplet. Corrigez-le ou laissez le champ vide.';
    }
    setErrors(next);
    if (Object.keys(next).length > 0) {
      warn();
      scrollRef.current?.scrollTo({ y: Math.max(0, contactY.current - 12), animated: true });
      return;
    }
    sending.current = true;
    setBusy(true);
    setTimeout(() => {
      if (!alive.current) return;
      // Les coordonnées corrigées ici sont reportées dans le profil.
      updateAccount({ name: name.trim(), company: company.trim(), phone, email, whatsapp });
      const request = placeRequest({
        company: company.trim(),
        contactName: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        whatsapp: whatsapp.trim(),
        destination: destination.trim(),
        note: note.trim(),
      });
      success();
      nav.replace('Success', { requestId: request.id });
    }, 450);
  };

  const header = (
    <View style={[styles.header, { paddingTop: top + 4 }]}>
      <RoundButton icon="close" label="Fermer" onPress={() => nav.goBack()} />
      <Text style={styles.headerTitle} accessibilityRole="header">
        Votre demande
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
          title="Aucun produit dans la demande"
          body={`Ajoutez des produits depuis le catalogue avant de l’envoyer. ${proRulesText(rules, usesModes)}.`}
          cta="Parcourir le catalogue"
          onPress={() => {
            setTab('home');
            nav.popToTop();
          }}
        />
      </View>
    );
  }

  const field = (
    label: string,
    value: string,
    onChange: (t: string) => void,
    error: string | undefined,
    props: React.ComponentProps<typeof TextInput> & { optional?: boolean },
  ) => (
    <View>
      <Text style={styles.fieldLabel}>
        {label}
        {props.optional ? <Text style={styles.optional}> · facultatif</Text> : null}
      </Text>
      <TextInput
        value={value}
        onChangeText={(t) => {
          onChange(t);
          setErrors({});
        }}
        placeholderTextColor={C.textFaint}
        style={[styles.input, !!error && { borderColor: C.danger }]}
        returnKeyType="next"
        accessibilityLabel={props.optional ? `${label}, facultatif` : label}
        {...props}
      />
      {!!error && <ErrorText style={styles.error}>{error}</ErrorText>}
    </View>
  );

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
            Prix
          </Text>
          <View style={styles.card}>
            <View style={styles.priceRow}>
              <Text style={styles.priceHelp}>{INCOTERM_HELP[incoterm]}</Text>
              <IncotermToggle value={incoterm} onChange={setIncoterm} />
            </View>
          </View>

          <Text style={styles.section} accessibilityRole="header">
            Produits
          </Text>
          <View style={[styles.card, { gap: 12 }]}>
            {cartLines.map((l) => {
              const p = byId[l.id];
              return (
                <View key={l.id} style={styles.sumRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.lineName} numberOfLines={1}>
                      {nameWithMode(p)} · {p.origin}
                    </Text>
                    <Text style={styles.lineMeta}>
                      {qtyFull(p, l.qty)}
                      {p.noPrice
                        ? ' · prix à confirmer'
                        : ` × ${euro(p.price)}${p.unit === 'unit' ? ' le conteneur' : ''}`}
                    </Text>
                  </View>
                  <Text style={[styles.sumValue, p.noPrice && { color: C.star }]}>
                    {lineTotalText(p, l.qty)}
                  </Text>
                </View>
              );
            })}
            <View style={styles.divider} />
            <View style={styles.sumRow}>
              <Text style={styles.totalLabel}>Estimation {incoterm}</Text>
              <BumpText value={subtotal} style={styles.totalValue}>
                {euro(subtotal)}
              </BumpText>
            </View>
            <Text style={styles.sumNote}>
              {unpriced > 0
                ? `Hors ${unpriced} ligne${unpriced > 1 ? 's' : ''} dont le prix reste à confirmer. `
                : ''}
              Montant indicatif, à confirmer avec notre équipe. Rien n’est payé dans l’application.
            </Text>
          </View>

          <View
            onLayout={(e) => {
              contactY.current = e.nativeEvent.layout.y;
            }}
          >
            <Text style={styles.section} accessibilityRole="header">
              Pour vous recontacter
            </Text>
            {field('Personne à contacter', name, setName, errors.name, {
              autoComplete: 'name',
              textContentType: 'name',
              autoCapitalize: 'words',
              maxLength: 60,
            })}
            {field('Société', company, setCompany, undefined, {
              optional: true,
              autoCapitalize: 'words',
              maxLength: 60,
            })}
            {field('Téléphone', phone, setPhone, errors.phone, {
              placeholder: 'Avec l’indicatif du pays',
              keyboardType: 'phone-pad',
              autoComplete: 'tel',
              textContentType: 'telephoneNumber',
              maxLength: 24,
            })}
            {field('E-mail', email, setEmail, errors.email, {
              placeholder: 'nom@exemple.com',
              keyboardType: 'email-address',
              autoCapitalize: 'none',
              autoCorrect: false,
              autoComplete: 'email',
              textContentType: 'emailAddress',
              maxLength: 80,
            })}
            {field('WhatsApp', whatsapp, setWhatsapp, errors.whatsapp, {
              optional: true,
              placeholder: 'Si différent du téléphone',
              keyboardType: 'phone-pad',
              maxLength: 24,
            })}
          </View>

          <Text style={styles.section} accessibilityRole="header">
            Votre besoin
          </Text>
          {field('Pays ou port de destination', destination, setDestination, undefined, {
            optional: true,
            placeholder: 'Ex. Rotterdam, Pays-Bas',
            autoCapitalize: 'words',
            maxLength: 60,
          })}
          <View style={styles.noteHead}>
            <Text style={[styles.fieldLabel, { marginTop: 0, marginBottom: 0 }]}>
              Précisions<Text style={styles.optional}> · facultatif</Text>
            </Text>
            <Text style={styles.counter}>
              {note.length}/{NOTE_MAX}
            </Text>
          </View>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Calibres, conditionnement, date souhaitée…"
            placeholderTextColor={C.textFaint}
            style={styles.note}
            multiline
            maxLength={NOTE_MAX}
            textAlignVertical="top"
            accessibilityLabel="Précisions pour notre équipe, facultatif"
          />

          <View style={styles.notice}>
            <Ionicons name="call-outline" size={18} color={C.leaf} style={{ marginTop: 1 }} />
            <Text style={styles.noticeText}>
              Vous ne payez rien ici. Notre équipe vous contacte pour confirmer les détails et
              organiser le paiement.
            </Text>
          </View>
          <View style={styles.demo}>
            <Ionicons name="information-circle-outline" size={17} color={C.textDim} />
            <Text style={styles.demoText}>
              Prototype : le logiciel de notre équipe n’est pas encore connecté. Votre demande est
              enregistrée sur cet appareil et partira dès que la liaison sera en place.
            </Text>
          </View>
        </ScrollView>

        <View style={[styles.bar, { paddingBottom: bottom + 4 }]}>
          <PrimaryButton
            label="Envoyer la demande"
            icon="send-outline"
            onPress={send}
            loading={busy}
            loadingLabel="Enregistrement…"
          />
        </View>
      </KeyboardAvoidingView>
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
  card: {
    padding: 16,
    borderRadius: R.lg,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.line,
  },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  priceHelp: { flex: 1, color: C.textDim, fontFamily: F.medium, fontSize: 13.5, lineHeight: 19 },
  sumRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
  },
  lineName: { color: C.text, fontFamily: F.bold, fontSize: 14.5, lineHeight: 20 },
  lineMeta: { marginTop: 1, color: C.textDim, fontFamily: F.medium, fontSize: 13, lineHeight: 18 },
  sumValue: { color: C.text, fontFamily: F.bold, fontSize: 15, fontVariant: ['tabular-nums'] },
  divider: { height: 1, backgroundColor: C.line },
  totalLabel: { color: C.text, fontFamily: F.display, fontSize: 19 },
  totalValue: { color: C.text, fontFamily: F.heavy, fontSize: 23, fontVariant: ['tabular-nums'] },
  sumNote: { color: C.textFaint, fontFamily: F.medium, fontSize: 13, lineHeight: 19 },

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
  error: {
    marginTop: 8,
    paddingHorizontal: 4,
    color: C.danger,
    fontFamily: F.semi,
    fontSize: 13.5,
    lineHeight: 19,
  },
  noteHead: {
    marginTop: 14,
    marginBottom: 7,
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
  notice: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 22,
    padding: 14,
    borderRadius: R.lg,
    backgroundColor: C.leafWash,
    borderWidth: 1,
    borderColor: 'rgba(168,213,79,0.3)',
  },
  noticeText: { flex: 1, color: C.text, fontFamily: F.semi, fontSize: 14, lineHeight: 20 },
  demo: { flexDirection: 'row', gap: 9, marginTop: 14, paddingHorizontal: 4 },
  demoText: { flex: 1, color: C.textFaint, fontFamily: F.medium, fontSize: 13, lineHeight: 19 },
  bar: {
    paddingHorizontal: PAD,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.line,
    backgroundColor: 'rgba(11,14,9,0.92)',
  },
});
