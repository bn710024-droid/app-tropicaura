import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { ErrorText } from './Motion';
import { TextInput } from './Input';
import { KeepsOwnSwipes } from './PageSwipe';
import { C, F, R } from '../lib/theme';

type Props = React.ComponentProps<typeof TextInput> & {
  label: string;
  optional?: boolean;
  error?: string;
  hint?: string;
  containerStyle?: StyleProp<ViewStyle>;
};

/** Champ de formulaire : libellé visible, aide éventuelle, erreur sous le champ. */
export function Field({ label, optional, error, hint, containerStyle, ...input }: Props) {
  return (
    <View style={containerStyle}>
      <Text style={styles.label}>
        {label}
        {optional ? <Text style={styles.optional}> · facultatif</Text> : null}
      </Text>
      <KeepsOwnSwipes>
        <TextInput
          placeholderTextColor={C.textFaint}
          style={[styles.input, !!error && { borderColor: C.danger }]}
          returnKeyType="next"
          accessibilityLabel={optional ? `${label}, facultatif` : label}
          {...input}
        />
      </KeepsOwnSwipes>
      {!!error && <ErrorText style={styles.error}>{error}</ErrorText>}
      {!error && !!hint && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
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
  hint: {
    marginTop: 7,
    paddingHorizontal: 4,
    color: C.textFaint,
    fontFamily: F.medium,
    fontSize: 12.5,
    lineHeight: 18,
  },
});
