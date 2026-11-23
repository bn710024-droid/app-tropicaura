import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ErrorText } from '../components/Motion';
import { Pressable } from '../components/Tap';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AddressSheet } from '../components/AddressSheet';
import { GhostButton, PrimaryButton } from '../components/Buttons';
import { Field } from '../components/Field';
import { PAGE_SCROLL } from '../components/PageSwipe';
import { TAB_BAR_SPACE } from '../components/TabBar';
import { TabHeader } from '../components/TabHeader';
import { formatAddress, kgText } from '../lib/format';
import { initials, isEmail, isPhone } from '../lib/identity';
import type { Nav } from '../lib/navigation';
import { ACTIVITY_LABEL, useStore } from '../lib/store';
import { C, F, PAD, R } from '../lib/theme';
import { useToast } from '../lib/toast';
import { useFrame } from '../lib/useFrame';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
type Errors = Partial<Record<'name' | 'email' | 'phone' | 'whatsapp' | 'form', string>>;

function Row({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`${label} : ${value || 'non renseigné'}`}
    >
      <Ionicons name={icon} size={18} color={C.textDim} />
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={[styles.rowValue, !value && { color: C.textFaint }]} numberOfLines={1}>
          {value || 'Non renseigné'}
        </Text>
      </View>
    </View>
  );
}

export function ProfileScreen() {
  const nav = useNavigation<Nav>();
  const {
    account,
    isPro,
    address,
    addresses,
    updateAccount,
    signOut,
    deleteAccount,
    usesModes,
    rules,
    catalogOrigin,
    catalogExample,
  } = useStore();
  const toast = useToast();
  const { bottom } = useFrame();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [sheet, setSheet] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!account) return null;

  const startEdit = () => {
    setName(account.name);
    setCompany(account.company);
    setEmail(account.email);
    setPhone(account.phone);
    setWhatsapp(account.whatsapp);
    setErrors({});
    setEditing(true);
  };
  const edit = (setter: (t: string) => void) => (t: string) => {
    setter(t);
    setErrors({});
  };

  const save = () => {
    const next: Errors = {};
    const mail = email.trim();
    const tel = phone.trim();
    if (name.trim().length < 2) next.name = 'Indiquez votre nom.';
    if (mail && !isEmail(mail)) next.email = 'Cette adresse e-mail semble incomplète.';
    if (tel && !isPhone(tel))
      next.phone = 'Ce numéro semble incomplet. Ajoutez l’indicatif du pays.';
    if (isPro) {
      if (!mail) next.email = 'L’e-mail est nécessaire pour vous recontacter.';
      if (!tel) next.phone = 'Le téléphone est nécessaire pour vous recontacter.';
      if (whatsapp.trim() && !isPhone(whatsapp)) next.whatsapp = 'Ce numéro semble incomplet.';
    } else if (!mail && !tel) {
      next.form = 'Gardez au moins un e-mail ou un numéro : il sert à retrouver votre compte.';
    }
    if (Object.keys(next).length > 0) return setErrors(next);
    const result = updateAccount({
      name: name.trim(),
      company: company.trim(),
      email: mail,
      phone: tel,
      whatsapp: isPro ? whatsapp : '',
    });
    if (!result.ok) return setErrors({ form: result.error });
    setEditing(false);
    toast('Profil mis à jour');
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={PAGE_SCROLL}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: TAB_BAR_SPACE + bottom + 16 }}
      >
        <TabHeader title="Mon" accent="profil" />

        <View style={[styles.card, styles.identity]}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(account.name)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>
              {account.name}
            </Text>
            <View style={styles.badge}>
              <Ionicons
                name={isPro ? 'briefcase-outline' : 'person-outline'}
                size={13}
                color={C.leaf}
              />
              <Text style={styles.badgeText} numberOfLines={1}>
                {isPro
                  ? `Professionnel · ${ACTIVITY_LABEL[account.activity ?? 'autre']}`
                  : 'Particulier'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle} accessibilityRole="header">
              Coordonnées
            </Text>
            {!editing && (
              <Pressable
                onPress={startEdit}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Modifier mes coordonnées"
                style={({ pressed }) => [styles.linkHit, pressed && { opacity: 0.6 }]}
              >
                <Text style={styles.link}>Modifier</Text>
              </Pressable>
            )}
          </View>

          {editing ? (
            <View>
              <Field
                label="Votre nom"
                value={name}
                onChangeText={edit(setName)}
                error={errors.name}
                autoCapitalize="words"
                maxLength={60}
                containerStyle={{ marginTop: -14 }}
              />
              {isPro && (
                <Field
                  label="Société"
                  optional
                  value={company}
                  onChangeText={edit(setCompany)}
                  autoCapitalize="words"
                  maxLength={60}
                />
              )}
              <Field
                label="E-mail"
                optional={!isPro}
                value={email}
                onChangeText={edit(setEmail)}
                error={errors.email}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={80}
              />
              <Field
                label="Téléphone"
                optional={!isPro}
                value={phone}
                onChangeText={edit(setPhone)}
                error={errors.phone}
                placeholder="Avec l’indicatif du pays"
                keyboardType="phone-pad"
                maxLength={24}
              />
              {isPro && (
                <Field
                  label="WhatsApp"
                  optional
                  value={whatsapp}
                  onChangeText={edit(setWhatsapp)}
                  error={errors.whatsapp}
                  placeholder="Si différent du téléphone"
                  keyboardType="phone-pad"
                  maxLength={24}
                />
              )}
              {!!errors.form && <ErrorText style={styles.error}>{errors.form}</ErrorText>}
              <PrimaryButton label="Enregistrer" onPress={save} style={{ marginTop: 18 }} />
              <GhostButton
                label="Annuler"
                onPress={() => setEditing(false)}
                style={{ marginTop: 10 }}
              />
            </View>
          ) : (
            <View style={{ gap: 14 }}>
              {isPro && <Row icon="business-outline" label="Société" value={account.company} />}
              <Row icon="mail-outline" label="E-mail" value={account.email} />
              <Row icon="call-outline" label="Téléphone" value={account.phone} />
              {isPro && (
                <Row
                  icon="logo-whatsapp"
                  label="WhatsApp"
                  value={account.whatsapp || (account.phone ? 'Même numéro que le téléphone' : '')}
                />
              )}
            </View>
          )}
        </View>

        {isPro ? (
          <View style={styles.card}>
            <Text style={[styles.cardTitle, { marginBottom: 12 }]} accessibilityRole="header">
              Espace professionnel
            </Text>
            {usesModes ? (
              <>
                <Text style={styles.bullet}>
                  • Avion : minimum {kgText(rules.avion.minKg)}, par paliers de{' '}
                  {kgText(rules.avion.stepKg)}.
                </Text>
                <Text style={styles.bullet}>
                  • Bateau : par conteneur entier, minimum {rules.bateau.minContainers}
                  {rules.bateau.containerKg
                    ? ` (référence ${rules.bateau.containerLabel} : ${kgText(rules.bateau.containerKg)} par conteneur)`
                    : ''}
                  .
                </Text>
              </>
            ) : (
              <Text style={styles.bullet}>
                • Minimum {kgText(rules.standard.minKg)} par produit.
              </Text>
            )}
            <Text style={styles.bullet}>• Prix EXW ou FOB, au choix (pas de prix CIF).</Text>
            <Text style={styles.bullet}>
              • Aucun paiement dans l’application : notre équipe vous contacte après chaque demande.
            </Text>
          </View>
        ) : (
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={styles.cardTitle} accessibilityRole="header">
                Adresse de livraison
              </Text>
              <Pressable
                onPress={() => setSheet(true)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={address ? 'Gérer mes adresses' : 'Ajouter une adresse'}
                style={({ pressed }) => [styles.linkHit, pressed && { opacity: 0.6 }]}
              >
                <Text style={styles.link}>{address ? 'Gérer' : 'Ajouter'}</Text>
              </Pressable>
            </View>
            {address ? (
              <>
                <Text style={styles.rowValue}>{address.name}</Text>
                <Text style={styles.addressText}>{formatAddress(address)}</Text>
                {addresses.length > 1 && (
                  <Text style={styles.small}>
                    + {addresses.length - 1} autre{addresses.length > 2 ? 's' : ''} adresse
                    {addresses.length > 2 ? 's' : ''}
                  </Text>
                )}
              </>
            ) : (
              <Text style={styles.addressText}>
                Aucune adresse pour l’instant. Vous pourrez aussi l’ajouter au moment de commander.
              </Text>
            )}
          </View>
        )}

        <View style={styles.card}>
          <Text style={[styles.cardTitle, { marginBottom: 10 }]} accessibilityRole="header">
            Vos données
          </Text>
          <Text style={styles.addressText}>
            Prototype sans serveur : votre compte, vos favoris et vos{' '}
            {isPro ? 'demandes' : 'commandes'} sont enregistrés sur cet appareil uniquement. Pour
            les retrouver après une déconnexion, reconnectez-vous ici avec votre e-mail ou votre
            numéro.
          </Text>
          <Text style={[styles.addressText, { marginTop: 10 }]}>
            {catalogOrigin === 'exemple'
              ? 'Catalogue : données d’exemple embarquées dans l’application. La base de contrôle de notre équipe n’est pas encore connectée ; les produits, prix et offres affichés sont à remplacer par les données réelles.'
              : catalogOrigin === 'base'
                ? `Catalogue : reçu de la base de contrôle${catalogExample ? ' (données d’exemple)' : ''}.`
                : 'Catalogue : dernière copie reçue, conservée sur cet appareil (réseau indisponible).'}
          </Text>
        </View>

        <View style={styles.actions}>
          <GhostButton label="Me déconnecter" icon="log-out-outline" onPress={signOut} />
          {deleting ? (
            <View style={styles.deleteBox}>
              <Text style={styles.deleteText}>
                Supprimer ce compte et toutes ses données de cet appareil ? C’est définitif.
              </Text>
              <View style={styles.deleteRow}>
                <Pressable
                  onPress={deleteAccount}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.linkHit, pressed && { opacity: 0.6 }]}
                >
                  <Text style={[styles.link, { color: C.danger }]}>Oui, supprimer</Text>
                </Pressable>
                <Pressable
                  onPress={() => setDeleting(false)}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.linkHit, pressed && { opacity: 0.6 }]}
                >
                  <Text style={styles.link}>Non, garder mon compte</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable
              onPress={() => setDeleting(true)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.center, pressed && { opacity: 0.6 }]}
            >
              <Text style={styles.muted}>Supprimer ce compte de l’appareil</Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => nav.navigate('Credits')}
            accessibilityRole="button"
            style={({ pressed }) => [styles.center, pressed && { opacity: 0.6 }]}
          >
            <Text style={styles.muted}>Crédits photo et licences</Text>
          </Pressable>
        </View>
      </ScrollView>
      {!isPro && <AddressSheet visible={sheet} onClose={() => setSheet(false)} />}
    </KeyboardAvoidingView>
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
  identity: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.leaf,
  },
  avatarText: { color: C.onLeaf, fontFamily: F.heavy, fontSize: 20 },
  name: { color: C.text, fontFamily: F.display, fontSize: 22, lineHeight: 28 },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    height: 28,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: C.leafWash,
    maxWidth: '100%',
  },
  badgeText: { flexShrink: 1, color: C.leaf, fontFamily: F.bold, fontSize: 12.5 },

  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
  },
  cardTitle: { color: C.text, fontFamily: F.display, fontSize: 19, lineHeight: 24 },
  linkHit: { minHeight: 44, justifyContent: 'center' },
  link: { color: C.leaf, fontFamily: F.bold, fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowLabel: { color: C.textFaint, fontFamily: F.semi, fontSize: 12, lineHeight: 16 },
  rowValue: { color: C.text, fontFamily: F.bold, fontSize: 15, lineHeight: 21 },
  addressText: { color: C.textDim, fontFamily: F.medium, fontSize: 14, lineHeight: 21 },
  small: { marginTop: 8, color: C.textFaint, fontFamily: F.semi, fontSize: 12.5 },
  bullet: { color: C.textDim, fontFamily: F.medium, fontSize: 14, lineHeight: 22 },
  error: { marginTop: 12, color: C.danger, fontFamily: F.semi, fontSize: 13.5, lineHeight: 19 },

  actions: { paddingHorizontal: PAD, marginTop: 6, gap: 4 },
  center: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 },
  muted: {
    color: C.textDim,
    fontFamily: F.semi,
    fontSize: 13.5,
    textDecorationLine: 'underline',
  },
  deleteBox: {
    marginTop: 10,
    padding: 14,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,132,117,0.4)',
  },
  deleteText: { color: C.text, fontFamily: F.semi, fontSize: 14, lineHeight: 20 },
  deleteRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 20, marginTop: 4 },
});
