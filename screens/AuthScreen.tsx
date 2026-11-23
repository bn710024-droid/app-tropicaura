import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ErrorText } from '../components/Motion';
import { Pressable } from '../components/Tap';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Backdrop } from '../components/Backdrop';
import { GhostButton, PrimaryButton, RoundButton } from '../components/Buttons';
import { Field } from '../components/Field';
import { WelcomeStory } from '../components/WelcomeStory';
import { isEmail, isPhone } from '../lib/identity';
import { ACTIVITY_LABEL, AccountType, Activity, useStore } from '../lib/store';
import { C, F, PAD, R } from '../lib/theme';
import { useFrame } from '../lib/useFrame';
import { success, tick } from '../lib/haptics';

type Mode = 'welcome' | 'signup' | 'signin';
type Errors = Partial<
  Record<'name' | 'identifier' | 'phone' | 'email' | 'whatsapp' | 'form', string>
>;

const ACTIVITIES: Activity[] = ['grossiste', 'importateur', 'autre'];

function TypeCard({
  title,
  detail,
  icon,
  selected,
  onPress,
}: {
  title: string;
  detail: string;
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
      accessibilityLabel={`${title}. ${detail}`}
      style={({ pressed }) => [styles.type, selected && styles.typeOn, pressed && { opacity: 0.7 }]}
    >
      <View style={[styles.typeIcon, selected && { backgroundColor: C.leaf }]}>
        <Ionicons name={icon} size={19} color={selected ? C.onLeaf : C.textDim} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.typeTitle}>{title}</Text>
        <Text style={styles.typeDetail}>{detail}</Text>
      </View>
      <Ionicons
        name={selected ? 'radio-button-on' : 'radio-button-off'}
        size={22}
        color={selected ? C.leaf : C.textFaint}
      />
    </Pressable>
  );
}

/** Inscription et connexion : la porte d'entrée de l'application. */
export function AuthScreen() {
  const { signUp, signIn } = useStore();
  const { top, bottom, width, height } = useFrame();
  // Écran peu haut : l'histoire se resserre pour que les deux boutons restent visibles.
  const compact = height < 720;
  const [mode, setMode] = useState<Mode>('welcome');
  const [type, setType] = useState<AccountType>('particulier');
  const [activity, setActivity] = useState<Activity>('grossiste');
  const [name, setName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  const go = (next: Mode) => {
    setErrors({});
    setMode(next);
  };
  const edit = (setter: (t: string) => void) => (t: string) => {
    setter(t);
    setErrors({});
  };

  const create = () => {
    const next: Errors = {};
    if (name.trim().length < 2) next.name = 'Indiquez votre nom.';
    if (type === 'pro') {
      if (!isPhone(phone))
        next.phone = 'Indiquez un numéro avec l’indicatif du pays, par exemple +221 77 123 45 67.';
      if (!isEmail(email))
        next.email = 'Indiquez une adresse e-mail valide, par exemple nom@exemple.com.';
      if (whatsapp.trim() && !isPhone(whatsapp)) {
        next.whatsapp = 'Ce numéro semble incomplet. Corrigez-le ou laissez le champ vide.';
      }
    } else if (!isEmail(identifier) && !isPhone(identifier)) {
      next.identifier =
        'Indiquez une adresse e-mail (nom@exemple.com) ou un numéro de téléphone avec l’indicatif du pays.';
    }
    if (Object.keys(next).length > 0) return setErrors(next);

    const pro = type === 'pro';
    const result = signUp({
      type,
      name,
      email: pro ? email : isEmail(identifier) ? identifier : '',
      phone: pro ? phone : isEmail(identifier) ? '' : identifier,
      whatsapp: pro ? whatsapp : '',
      company: pro ? company : '',
      activity: pro ? activity : null,
    });
    if (!result.ok) return setErrors({ form: result.error });
    success();
  };

  const connect = async () => {
    if (busy) return;
    if (!isEmail(identifier) && !isPhone(identifier)) {
      return setErrors({
        identifier: 'Indiquez l’adresse e-mail ou le numéro de téléphone de votre compte.',
      });
    }
    setBusy(true);
    const result = await signIn(identifier);
    setBusy(false);
    if (!result.ok) setErrors({ form: result.error });
    else success();
  };

  if (mode === 'welcome') {
    return (
      <View style={styles.root}>
        <Backdrop />
        {/* L'histoire défile si l'écran est très petit ; les deux accès restent fixes en bas. */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.welcome, { paddingTop: top + (compact ? 6 : 16) }]}
        >
          <WelcomeStory width={width} compact={compact} tall={height >= 800} />
        </ScrollView>
        <Animated.View
          entering={FadeInDown.delay(150).duration(420)}
          style={[styles.actions, { paddingBottom: bottom + 12 }]}
        >
          <PrimaryButton label="Créer mon compte" onPress={() => go('signup')} />
          <GhostButton label="J’ai déjà un compte" onPress={() => go('signin')} />
        </Animated.View>
      </View>
    );
  }

  const signup = mode === 'signup';

  return (
    <View style={styles.root}>
      <Backdrop />
      <View style={[styles.header, { paddingTop: top + 4 }]}>
        <RoundButton icon="chevron-back" label="Retour" onPress={() => go('welcome')} />
        <Text style={styles.headerTitle} accessibilityRole="header">
          {signup ? 'Créer mon compte' : 'Me connecter'}
        </Text>
        <View style={{ width: 46 }} />
      </View>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: PAD, paddingBottom: 24 }}
        >
          {signup ? (
            <>
              <Text style={styles.section}>Vous êtes</Text>
              <View accessibilityRole="radiogroup" style={{ gap: 10 }}>
                <TypeCard
                  title="Particulier"
                  detail="Vous commandez pour vous ou vos proches, au prix particulier."
                  icon="person-outline"
                  selected={type === 'particulier'}
                  onPress={() => setType('particulier')}
                />
                <TypeCard
                  title="Professionnel"
                  detail="Grossiste, importateur… Achat en gros par avion ou par bateau, prix EXW ou FOB."
                  icon="briefcase-outline"
                  selected={type === 'pro'}
                  onPress={() => setType('pro')}
                />
              </View>

              {type === 'pro' && (
                <>
                  <Text style={styles.section}>Votre activité</Text>
                  <View accessibilityRole="radiogroup" style={styles.chips}>
                    {ACTIVITIES.map((a) => {
                      const on = a === activity;
                      return (
                        <Pressable
                          key={a}
                          onPress={() => {
                            tick();
                            setActivity(a);
                          }}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: on }}
                          style={({ pressed }) => [
                            styles.chip,
                            on && styles.chipOn,
                            pressed && { opacity: 0.7 },
                          ]}
                        >
                          <Text style={[styles.chipText, on && styles.chipTextOn]}>
                            {ACTIVITY_LABEL[a]}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              )}

              <Text style={styles.section}>
                {type === 'pro' ? 'Pour vous recontacter' : 'Vos informations'}
              </Text>
              <Field
                label="Votre nom"
                value={name}
                onChangeText={edit(setName)}
                error={errors.name}
                autoComplete="name"
                textContentType="name"
                autoCapitalize="words"
                maxLength={60}
                containerStyle={{ marginTop: -14 }}
              />
              {type === 'pro' ? (
                <>
                  <Field
                    label="Société"
                    optional
                    value={company}
                    onChangeText={edit(setCompany)}
                    autoCapitalize="words"
                    maxLength={60}
                  />
                  <Field
                    label="Téléphone"
                    value={phone}
                    onChangeText={edit(setPhone)}
                    error={errors.phone}
                    placeholder="+221 77 123 45 67"
                    keyboardType="phone-pad"
                    autoComplete="tel"
                    textContentType="telephoneNumber"
                    maxLength={24}
                  />
                  <Field
                    label="E-mail"
                    value={email}
                    onChangeText={edit(setEmail)}
                    error={errors.email}
                    placeholder="nom@exemple.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    textContentType="emailAddress"
                    maxLength={80}
                  />
                  <Field
                    label="WhatsApp"
                    optional
                    value={whatsapp}
                    onChangeText={edit(setWhatsapp)}
                    error={errors.whatsapp}
                    placeholder="Si différent du téléphone"
                    keyboardType="phone-pad"
                    maxLength={24}
                    returnKeyType="done"
                    onSubmitEditing={create}
                  />
                </>
              ) : (
                <Field
                  label="E-mail ou numéro de téléphone"
                  value={identifier}
                  onChangeText={edit(setIdentifier)}
                  error={errors.identifier}
                  hint="Il vous servira à retrouver votre compte."
                  placeholder="nom@exemple.com ou +221 77 123 45 67"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={80}
                  returnKeyType="done"
                  onSubmitEditing={create}
                />
              )}
            </>
          ) : (
            <>
              <Text style={styles.lead}>
                Retrouvez vos favoris, votre panier et vos commandes avec l’identifiant de votre
                compte.
              </Text>
              <Field
                label="E-mail ou numéro de téléphone"
                value={identifier}
                onChangeText={edit(setIdentifier)}
                error={errors.identifier}
                placeholder="nom@exemple.com ou +221 77 123 45 67"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={80}
                returnKeyType="done"
                onSubmitEditing={connect}
              />
            </>
          )}

          {!!errors.form && <ErrorText style={styles.formError}>{errors.form}</ErrorText>}

          <View style={styles.notice}>
            <Ionicons name="phone-portrait-outline" size={17} color={C.textDim} />
            <Text style={styles.noticeText}>
              Prototype sans serveur : votre compte et vos données sont enregistrés sur cet appareil
              uniquement, sans mot de passe ni code de vérification pour l’instant.
            </Text>
          </View>

          <Pressable
            onPress={() => go(signup ? 'signin' : 'signup')}
            accessibilityRole="button"
            style={({ pressed }) => [styles.switch, pressed && { opacity: 0.6 }]}
          >
            <Text style={styles.switchText}>
              {signup ? 'J’ai déjà un compte : me connecter' : 'Pas encore de compte : m’inscrire'}
            </Text>
          </Pressable>
        </ScrollView>

        <View style={[styles.bar, { paddingBottom: bottom + 4 }]}>
          <PrimaryButton
            label={signup ? 'Créer mon compte' : 'Me connecter'}
            onPress={signup ? create : connect}
            disabled={busy}
          />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  welcome: { flexGrow: 1, justifyContent: 'center', paddingBottom: 14 },
  actions: { gap: 10, paddingHorizontal: PAD, paddingTop: 6 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 10,
  },
  headerTitle: { color: C.text, fontFamily: F.display, fontSize: 20 },
  section: {
    marginTop: 24,
    marginBottom: 12,
    color: C.text,
    fontFamily: F.display,
    fontSize: 19,
    lineHeight: 24,
  },
  lead: {
    marginTop: 14,
    color: C.textDim,
    fontFamily: F.medium,
    fontSize: 15,
    lineHeight: 23,
  },
  type: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: R.lg,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.line,
  },
  typeOn: { borderColor: 'rgba(168,213,79,0.5)', backgroundColor: C.leafWash },
  typeIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surfaceStrong,
  },
  typeTitle: { color: C.text, fontFamily: F.bold, fontSize: 15.5, lineHeight: 21 },
  typeDetail: {
    marginTop: 2,
    color: C.textDim,
    fontFamily: F.medium,
    fontSize: 13.5,
    lineHeight: 19,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: R.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.line,
  },
  chipOn: { backgroundColor: C.leafWash, borderColor: 'rgba(168,213,79,0.5)' },
  chipText: { color: C.textDim, fontFamily: F.semi, fontSize: 14 },
  chipTextOn: { color: C.text, fontFamily: F.bold },
  formError: {
    marginTop: 16,
    color: C.danger,
    fontFamily: F.semi,
    fontSize: 14,
    lineHeight: 20,
  },
  notice: { flexDirection: 'row', gap: 9, marginTop: 22, paddingHorizontal: 4 },
  noticeText: { flex: 1, color: C.textFaint, fontFamily: F.medium, fontSize: 13, lineHeight: 19 },
  switch: { alignSelf: 'center', minHeight: 48, justifyContent: 'center', marginTop: 10 },
  switchText: {
    color: C.textDim,
    fontFamily: F.semi,
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  bar: {
    paddingHorizontal: PAD,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.line,
    backgroundColor: 'rgba(11,14,9,0.92)',
  },
});
