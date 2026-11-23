import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ErrorText } from './Motion';
import { Pressable } from './Tap';
import { TextInput } from './Input';
import Animated, { SlideInDown } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { PrimaryButton } from './Buttons';
import { COUNTRIES, countryName } from '../lib/countries';
import { formatAddress, normalize } from '../lib/format';
import { LocateError, deviceCountry, locate } from '../lib/locate';
import { useStore } from '../lib/store';
import { C, F, MAX_WIDTH, R } from '../lib/theme';
import { useFrame } from '../lib/useFrame';
import { tick } from '../lib/haptics';

type Mode = 'list' | 'form' | 'country';

const EMPTY = { name: '', line: '', line2: '', postal: '', city: '', region: '' };

const LOCATE_ERRORS = {
  denied:
    'La localisation est refusée ou bloquée sur cet appareil. Vérifiez le pays ci-dessous et saisissez votre adresse.',
  unavailable:
    'Impossible d’obtenir votre position pour le moment. Vérifiez le pays ci-dessous et saisissez votre adresse.',
  timeout:
    'La localisation met trop de temps à répondre. Vérifiez le pays ci-dessous et saisissez votre adresse.',
};

function Field({
  label,
  optional,
  style,
  ...input
}: React.ComponentProps<typeof TextInput> & { label: string; optional?: boolean }) {
  return (
    <View style={style}>
      <Text style={styles.fieldLabel}>
        {label}
        {optional ? <Text style={styles.optional}> · facultatif</Text> : null}
      </Text>
      <TextInput
        placeholderTextColor={C.textFaint}
        style={styles.input}
        returnKeyType="next"
        accessibilityLabel={optional ? `${label}, facultatif` : label}
        {...input}
      />
    </View>
  );
}

export function AddressSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { addresses, addressId, selectAddress, addAddress } = useStore();
  const { bottom, height } = useFrame();
  const [mode, setMode] = useState<Mode>('list');
  const [fields, setFields] = useState(EMPTY);
  const [country, setCountry] = useState('');
  /** D'où vient le pays affiché : réglages de l'appareil, position, ou choix du client. */
  const [countrySource, setCountrySource] = useState<'device' | 'position' | 'manual'>('manual');
  const [query, setQuery] = useState('');
  const [searchOn, setSearchOn] = useState(false);
  const [error, setError] = useState('');
  const [locating, setLocating] = useState(false);
  // La position n'est demandée qu'après un accord explicite, donné ici.
  const [asking, setAsking] = useState(false);
  const [locateNote, setLocateNote] = useState<{ ok: boolean; text: string } | null>(null);

  // À chaque ouverture : liste des adresses s'il y en a, sinon formulaire prérempli avec le
  // pays que suggèrent les réglages de l'appareil.
  useEffect(() => {
    if (!visible) return;
    const guess = deviceCountry();
    setMode(addresses.length > 0 ? 'list' : 'form');
    setFields(EMPTY);
    setCountry(guess ?? '');
    setCountrySource(guess ? 'device' : 'manual');
    setQuery('');
    setError('');
    setLocating(false);
    setAsking(false);
    setLocateNote(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const set = (key: keyof typeof EMPTY) => (value: string) => {
    setFields((f) => ({ ...f, [key]: value }));
    setError('');
  };

  const results = useMemo(() => {
    const q = normalize(query);
    return q ? COUNTRIES.filter((c) => normalize(c.name).includes(q)) : COUNTRIES;
  }, [query]);

  const fillFromPosition = async () => {
    if (locating) return;
    tick();
    setAsking(false);
    setLocating(true);
    setLocateNote(null);
    setError('');
    try {
      const found = await locate();
      if (found.country) {
        setCountry(found.country);
        setCountrySource('position');
      }
      if (found.detailed) {
        setFields((f) => ({
          ...f,
          line: found.line || f.line,
          postal: found.postal || f.postal,
          city: found.city || f.city,
          region: found.region || f.region,
        }));
        setLocateNote({
          ok: true,
          text: 'Adresse proposée d’après votre position. Vérifiez-la avant de l’enregistrer.',
        });
      } else if (found.country) {
        setLocateNote({
          ok: true,
          text: `Pays détecté : ${countryName(found.country)}. Complétez l’adresse ci-dessous.`,
        });
      } else {
        setLocateNote({
          ok: false,
          text: 'Votre position ne correspond à aucun pays connu. Vérifiez le pays ci-dessous.',
        });
      }
    } catch (e) {
      setLocateNote({
        ok: false,
        text: LOCATE_ERRORS[e instanceof LocateError ? e.reason : 'unavailable'],
      });
    } finally {
      setLocating(false);
    }
  };

  const save = () => {
    const name = fields.name.trim();
    const line = fields.line.trim();
    const city = fields.city.trim();
    if (name.length < 2) return setError('Indiquez le nom du destinataire.');
    if (!country) return setError('Choisissez le pays.');
    if (line.length < 4) return setError('Indiquez le numéro et le nom de la rue.');
    if (city.length < 2) return setError('Indiquez la ville.');
    addAddress({
      name,
      line,
      line2: fields.line2.trim(),
      postal: fields.postal.trim(),
      city,
      region: fields.region.trim(),
      country,
    });
    onClose();
  };

  const title = mode === 'country' ? 'Pays' : mode === 'form' ? 'Nouvelle adresse' : 'Vos adresses';
  const canGoBack = mode === 'country' || (mode === 'form' && addresses.length > 0);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.root}
      >
        <Pressable
          feedback="none"
          style={[StyleSheet.absoluteFill, styles.scrim]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Fermer"
        />
        <Animated.View
          entering={SlideInDown.duration(280)}
          style={[styles.sheet, { paddingBottom: bottom + 10, maxHeight: height * 0.9 }]}
        >
          <View style={styles.handle} />
          <View style={styles.head}>
            {canGoBack && (
              <Pressable
                onPress={() => setMode(mode === 'country' ? 'form' : 'list')}
                hitSlop={10}
                scaleTo={0.9}
                accessibilityRole="button"
                accessibilityLabel="Revenir en arrière"
                style={styles.round}
              >
                <Ionicons name="chevron-back" size={20} color={C.text} />
              </Pressable>
            )}
            <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>
              {title}
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              scaleTo={0.9}
              accessibilityRole="button"
              accessibilityLabel="Fermer"
              style={styles.round}
            >
              <Ionicons name="close" size={20} color={C.text} />
            </Pressable>
          </View>

          {mode === 'country' ? (
            <View>
              <View style={[styles.search, searchOn && styles.searchOn]}>
                <Ionicons name="search" size={18} color={C.textFaint} />
                <TextInput
                  focusRing={false}
                  onFocus={() => setSearchOn(true)}
                  onBlur={() => setSearchOn(false)}
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Rechercher un pays"
                  placeholderTextColor={C.textFaint}
                  style={styles.searchInput}
                  autoCorrect={false}
                  returnKeyType="search"
                  accessibilityLabel="Rechercher un pays"
                />
              </View>
              <FlatList
                data={results}
                keyExtractor={(c) => c.code}
                style={{ height: Math.min(height * 0.5, 420) }}
                keyboardShouldPersistTaps="handled"
                initialNumToRender={14}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => {
                  const on = item.code === country;
                  return (
                    <Pressable
                      onPress={() => {
                        tick();
                        setCountry(item.code);
                        setCountrySource('manual');
                        setError('');
                        setQuery('');
                        setMode('form');
                      }}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={item.name}
                      style={({ pressed }) => [styles.countryRow, pressed && { opacity: 0.6 }]}
                    >
                      <Text style={[styles.countryName, on && styles.countryNameOn]}>
                        {item.name}
                      </Text>
                      {on && <Ionicons name="checkmark" size={20} color={C.leaf} />}
                    </Pressable>
                  );
                }}
                ListEmptyComponent={
                  <Text style={styles.noResult}>
                    Aucun pays ne correspond à « {query.trim()} ».
                  </Text>
                }
              />
            </View>
          ) : mode === 'form' ? (
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {asking ? (
                <View style={styles.consent}>
                  <Text style={styles.consentTitle}>Utiliser votre position ?</Text>
                  <Text style={styles.consentText}>
                    Elle sert uniquement à proposer votre pays et, si possible, votre adresse. Elle
                    n’est ni enregistrée ni partagée. Votre appareil vous demandera ensuite de
                    confirmer.
                  </Text>
                  <View style={styles.consentRow}>
                    <Pressable
                      onPress={fillFromPosition}
                      accessibilityRole="button"
                      style={({ pressed }) => [styles.consentYes, pressed && { opacity: 0.7 }]}
                    >
                      <Text style={styles.consentYesText}>Autoriser</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setAsking(false)}
                      accessibilityRole="button"
                      style={({ pressed }) => [styles.consentNo, pressed && { opacity: 0.7 }]}
                    >
                      <Text style={styles.consentNoText}>Non merci</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Pressable
                  onPress={() => {
                    tick();
                    setLocateNote(null);
                    setAsking(true);
                  }}
                  disabled={locating}
                  accessibilityRole="button"
                  accessibilityState={{ busy: locating }}
                  accessibilityLabel="Utiliser ma position pour préremplir l’adresse"
                  style={({ pressed }) => [styles.locate, pressed && { opacity: 0.7 }]}
                >
                  {locating ? (
                    <ActivityIndicator size="small" color={C.leaf} />
                  ) : (
                    <Ionicons name="navigate-outline" size={18} color={C.leaf} />
                  )}
                  <Text style={styles.locateText}>
                    {locating ? 'Localisation en cours…' : 'Utiliser ma position'}
                  </Text>
                </Pressable>
              )}
              {locateNote && (
                <Text
                  style={[styles.note, !locateNote.ok && { color: C.danger }]}
                  accessibilityLiveRegion="polite"
                >
                  {locateNote.text}
                </Text>
              )}

              <Field
                label="Nom du destinataire"
                value={fields.name}
                onChangeText={set('name')}
                placeholder="Prénom et nom, ou société"
                autoComplete="name"
                textContentType="name"
                autoCapitalize="words"
                maxLength={60}
              />

              <Text style={styles.fieldLabel}>Pays</Text>
              <Pressable
                onPress={() => setMode('country')}
                accessibilityRole="button"
                accessibilityLabel={
                  country ? `Pays : ${countryName(country)}. Modifier` : 'Choisir le pays'
                }
                style={({ pressed }) => [styles.input, styles.picker, pressed && { opacity: 0.7 }]}
              >
                <Text style={[styles.pickerText, !country && { color: C.textFaint }]}>
                  {country ? countryName(country) : 'Choisir le pays'}
                </Text>
                <Ionicons name="chevron-forward" size={18} color={C.textDim} />
              </Pressable>
              {!!country && countrySource !== 'manual' && (
                <Text style={styles.hint}>
                  {countrySource === 'position'
                    ? 'Détecté d’après votre position.'
                    : 'Proposé d’après les réglages de votre appareil.'}
                </Text>
              )}

              <Field
                label="Adresse"
                value={fields.line}
                onChangeText={set('line')}
                placeholder="Numéro et rue"
                autoComplete="street-address"
                textContentType="streetAddressLine1"
                maxLength={80}
              />
              <Field
                label="Complément"
                optional
                value={fields.line2}
                onChangeText={set('line2')}
                placeholder="Bâtiment, étage, boîte postale…"
                textContentType="streetAddressLine2"
                maxLength={80}
              />
              <View style={styles.row2}>
                <Field
                  label="Code postal"
                  optional
                  style={{ flex: 2 }}
                  value={fields.postal}
                  onChangeText={set('postal')}
                  autoComplete="postal-code"
                  textContentType="postalCode"
                  autoCapitalize="characters"
                  maxLength={12}
                />
                <Field
                  label="Ville"
                  style={{ flex: 3 }}
                  value={fields.city}
                  onChangeText={set('city')}
                  textContentType="addressCity"
                  autoCapitalize="words"
                  maxLength={50}
                />
              </View>
              <Field
                label="Région, État ou province"
                optional
                value={fields.region}
                onChangeText={set('region')}
                textContentType="addressState"
                autoCapitalize="words"
                returnKeyType="done"
                onSubmitEditing={save}
                maxLength={50}
              />

              {!!error && <ErrorText style={styles.error}>{error}</ErrorText>}
              <PrimaryButton
                label="Enregistrer l’adresse"
                onPress={save}
                style={{ marginTop: 18, marginBottom: 6 }}
              />
            </ScrollView>
          ) : (
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {addresses.map((a) => {
                const on = a.id === addressId;
                return (
                  <Pressable
                    key={a.id}
                    onPress={() => {
                      tick();
                      selectAddress(a.id);
                      onClose();
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={`${a.name}, ${formatAddress(a)}`}
                    style={({ pressed }) => [
                      styles.addressRow,
                      on && styles.addressRowOn,
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <View style={[styles.pin, on && { backgroundColor: C.leaf }]}>
                      <Ionicons
                        name="location-outline"
                        size={18}
                        color={on ? C.onLeaf : C.textDim}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {a.name}
                      </Text>
                      <Text style={styles.rowSub} numberOfLines={2}>
                        {formatAddress(a)}
                      </Text>
                    </View>
                    <Ionicons
                      name={on ? 'radio-button-on' : 'radio-button-off'}
                      size={22}
                      color={on ? C.leaf : C.textFaint}
                    />
                  </Pressable>
                );
              })}
              <Pressable
                onPress={() => setMode('form')}
                accessibilityRole="button"
                style={({ pressed }) => [styles.addRow, pressed && { opacity: 0.6 }]}
              >
                <Ionicons name="add" size={20} color={C.leaf} />
                <Text style={styles.addText}>Ajouter une adresse</Text>
              </Pressable>
            </ScrollView>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  scrim: { backgroundColor: 'rgba(0,0,0,0.66)' },
  sheet: {
    width: '100%',
    maxWidth: MAX_WIDTH,
    backgroundColor: C.sheet,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: C.line,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.lineStrong,
    marginBottom: 14,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  title: { flex: 1, color: C.text, fontFamily: F.display, fontSize: 24 },
  round: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surfaceStrong,
  },

  locate: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    borderRadius: R.pill,
    borderWidth: 1,
    borderColor: 'rgba(168,213,79,0.5)',
    backgroundColor: C.leafWash,
  },
  locateText: { color: C.text, fontFamily: F.bold, fontSize: 15 },
  consent: {
    padding: 14,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: 'rgba(168,213,79,0.5)',
    backgroundColor: C.leafWash,
  },
  consentTitle: { color: C.text, fontFamily: F.bold, fontSize: 15, lineHeight: 21 },
  consentText: {
    marginTop: 4,
    color: C.textDim,
    fontFamily: F.medium,
    fontSize: 13.5,
    lineHeight: 20,
  },
  consentRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  consentYes: {
    flex: 1,
    minHeight: 46,
    borderRadius: R.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.leaf,
  },
  consentYesText: { color: C.onLeaf, fontFamily: F.heavy, fontSize: 14.5 },
  consentNo: {
    flex: 1,
    minHeight: 46,
    borderRadius: R.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.lineStrong,
  },
  consentNoText: { color: C.text, fontFamily: F.bold, fontSize: 14.5 },
  note: {
    marginTop: 10,
    color: C.textDim,
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
  picker: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  pickerText: { flex: 1, color: C.text, fontFamily: F.semi, fontSize: 16 },
  hint: { marginTop: 7, color: C.textFaint, fontFamily: F.medium, fontSize: 12.5, lineHeight: 17 },
  row2: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  error: { marginTop: 12, color: C.danger, fontFamily: F.semi, fontSize: 13.5, lineHeight: 19 },

  search: {
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 16,
    marginBottom: 6,
    borderRadius: R.pill,
    borderWidth: 1,
    borderColor: C.lineStrong,
    backgroundColor: C.surface,
  },
  searchOn: { borderColor: C.leaf, backgroundColor: 'rgba(255,255,255,0.085)' },
  searchInput: {
    flex: 1,
    minWidth: 0,
    height: '100%',
    color: C.text,
    fontFamily: F.semi,
    fontSize: 16,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
  },
  countryRow: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  countryName: { flex: 1, color: C.text, fontFamily: F.semi, fontSize: 15.5 },
  countryNameOn: { color: C.leaf, fontFamily: F.bold },
  noResult: {
    paddingVertical: 24,
    color: C.textDim,
    fontFamily: F.medium,
    fontSize: 14.5,
    textAlign: 'center',
  },

  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: C.line,
    marginBottom: 10,
  },
  addressRowOn: { borderColor: 'rgba(168,213,79,0.5)', backgroundColor: C.leafWash },
  pin: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surfaceStrong,
  },
  rowTitle: { color: C.text, fontFamily: F.bold, fontSize: 15 },
  rowSub: { marginTop: 2, color: C.textDim, fontFamily: F.medium, fontSize: 13.5, lineHeight: 19 },
  addRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: R.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: C.lineStrong,
    marginBottom: 8,
  },
  addText: { color: C.leaf, fontFamily: F.bold, fontSize: 15 },
});
