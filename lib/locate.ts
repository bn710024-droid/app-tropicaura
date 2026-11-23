import { Platform } from 'react-native';
import * as Location from 'expo-location';
import { isCountry } from './countries';
import { countryOfTimeZone } from './geo/timeZones';

export type Located = {
  country: string | null;
  line: string;
  postal: string;
  city: string;
  region: string;
  /** Vrai si la rue et la ville ont pu être proposées (géocodeur du téléphone). */
  detailed: boolean;
};

export type LocateFailure = 'denied' | 'unavailable' | 'timeout';

export class LocateError extends Error {
  reason: LocateFailure;
  constructor(reason: LocateFailure) {
    super(reason);
    this.reason = reason;
  }
}

/**
 * Pays probable de l'utilisateur d'après les réglages de l'appareil (fuseau horaire, puis
 * région de la langue). Aucune autorisation n'est nécessaire : sert de proposition par défaut.
 */
export function deviceCountry(): string | null {
  try {
    const options = Intl.DateTimeFormat().resolvedOptions();
    const fromZone = countryOfTimeZone(options.timeZone);
    if (isCountry(fromZone)) return fromZone;
    const region = /[-_]([A-Z]{2})(?:[-_]|$)/.exec(options.locale)?.[1];
    if (isCountry(region)) return region;
  } catch {
    // Intl indisponible : pas de proposition.
  }
  return null;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new LocateError('timeout')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * Position de l'utilisateur → adresse proposée.
 * - iOS / Android : le géocodeur du système donne pays, rue, code postal et ville.
 * - Web : seul le pays est déduit, par un calcul local sur les contours des pays ;
 *   les coordonnées ne sont envoyées à aucun service.
 */
export async function locate(): Promise<Located> {
  let granted = true;
  try {
    granted = (await withTimeout(Location.requestForegroundPermissionsAsync(), 30000)).granted;
  } catch (error) {
    if (error instanceof LocateError) throw error;
    // API de permissions absente (anciens navigateurs) : la demande de position la déclenchera.
  }
  if (!granted) throw new LocateError('denied');

  let coords: { latitude: number; longitude: number };
  try {
    const position = await withTimeout(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      20000,
    );
    coords = position.coords;
  } catch (error) {
    if (error instanceof LocateError) throw error;
    throw new LocateError('unavailable');
  }

  const result: Located = {
    country: null,
    line: '',
    postal: '',
    city: '',
    region: '',
    detailed: false,
  };

  if (Platform.OS !== 'web') {
    try {
      const [place] = await withTimeout(Location.reverseGeocodeAsync(coords), 10000);
      if (place) {
        const code = place.isoCountryCode?.toUpperCase();
        if (isCountry(code)) result.country = code;
        result.line = [place.streetNumber, place.street].filter(Boolean).join(' ');
        result.postal = place.postalCode ?? '';
        result.city = place.city ?? place.district ?? place.subregion ?? '';
        result.region = place.region ?? '';
        result.detailed = !!(result.line || result.city);
      }
    } catch {
      // Géocodeur du téléphone indisponible : on retombe sur le calcul local du pays.
    }
  }

  if (!result.country) {
    const { countryAt } = await import('./geo/countryAt');
    const code = countryAt(coords.latitude, coords.longitude, deviceCountry());
    if (isCountry(code)) result.country = code;
  }

  return result;
}
