import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { C, F } from '../lib/theme';
import { MONTH_INITIALS, MONTHS, currentMonth } from '../lib/format';

/** Calendrier de saison : douze mois, ceux de récolte teintés, le mois courant cerclé. */
export function SeasonStrip({ season, tint }: { season: number[]; tint: string }) {
  const now = currentMonth();
  const inSeason = season.map((m) => MONTHS[m - 1]).join(', ');
  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`Mois de saison : ${season.length === 12 ? 'toute l’année' : inSeason}`}
    >
      {MONTH_INITIALS.map((letter, i) => {
        const month = i + 1;
        const on = season.includes(month);
        const current = month === now;
        return (
          <View key={month} style={styles.cell}>
            <View
              style={[
                styles.bar,
                on ? { backgroundColor: tint } : styles.barOff,
                current && styles.barCurrent,
                current && { borderColor: C.text },
              ]}
            />
            <Text style={[styles.letter, on && styles.letterOn, current && styles.letterCurrent]}>
              {letter}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 5 },
  cell: { flex: 1, alignItems: 'center', gap: 7 },
  bar: { alignSelf: 'stretch', height: 30, borderRadius: 8 },
  barOff: { backgroundColor: 'rgba(255,255,255,0.07)' },
  barCurrent: { borderWidth: 2 },
  letter: { color: C.textFaint, fontFamily: F.semi, fontSize: 11.5 },
  letterOn: { color: C.textDim },
  letterCurrent: { color: C.text, fontFamily: F.heavy },
});
