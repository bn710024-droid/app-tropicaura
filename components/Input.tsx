import React, { forwardRef, useState } from 'react';
import { Platform, TextInput as RNTextInput, StyleSheet, TextInputProps } from 'react-native';
import { C } from '../lib/theme';

type FocusEvent = Parameters<NonNullable<TextInputProps['onFocus']>>[0];
type BlurEvent = Parameters<NonNullable<TextInputProps['onBlur']>>[0];

type Props = TextInputProps & {
  /** `false` quand le cadre du champ est dessiné par son conteneur (recherche, quantité). */
  focusRing?: boolean;
};

/**
 * Remplace `TextInput` : même utilisation, avec un cadre qui s'éclaire dès que le champ est
 * touché. Un champ en erreur garde sa couleur d'erreur.
 */
export const TextInput = forwardRef<RNTextInput, Props>(function TextInput(
  { style, onFocus, onBlur, focusRing = true, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const inError = focused && StyleSheet.flatten(style)?.borderColor === C.danger;
  return (
    <RNTextInput
      ref={ref}
      {...rest}
      onFocus={(e: FocusEvent) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e: BlurEvent) => {
        setFocused(false);
        onBlur?.(e);
      }}
      style={[
        focusRing && styles.base,
        style,
        focusRing && focused && styles.focused,
        focusRing && focused && !inError && styles.focusedBorder,
      ]}
    />
  );
});

const styles = StyleSheet.create({
  base:
    Platform.OS === 'web'
      ? ({
          outlineStyle: 'none',
          transitionProperty: 'border-color, box-shadow, background-color',
          transitionDuration: '140ms',
        } as object)
      : {},
  focused: {
    backgroundColor: 'rgba(255,255,255,0.085)',
    boxShadow: '0px 0px 0px 3px rgba(168,213,79,0.22)',
  },
  focusedBorder: { borderColor: C.leaf },
});
