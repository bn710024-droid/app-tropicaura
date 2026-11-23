import AsyncStorage from '@react-native-async-storage/async-storage';
import { CATALOG_ENDPOINT } from '../config';
import { EMBEDDED_CATALOG } from './embedded';
import { CatalogDocument, parseCatalog } from './schema';

/**
 * D'où vient le catalogue affiché.
 * - 'exemple' : le catalogue d'exemple embarqué. C'EST LE CAS AUJOURD'HUI : rien n'est connecté.
 * - 'base'    : le catalogue publié par le logiciel de contrôle (à venir).
 * - 'copie'   : la dernière version reçue, conservée sur l'appareil quand le réseau manque.
 */
export type CatalogOrigin = 'exemple' | 'base' | 'copie';
export type CatalogState = { doc: CatalogDocument; origin: CatalogOrigin };

const CACHE_KEY = 'primeur:catalogue:v1';

export const START_CATALOG: CatalogState = { doc: EMBEDDED_CATALOG, origin: 'exemple' };

/** Vrai quand une adresse de catalogue est configurée. Faux aujourd'hui. */
export const catalogConnected = () => !!CATALOG_ENDPOINT;

/**
 * Charge le catalogue publié par le logiciel de contrôle.
 *
 * PRÉPARÉ, PAS ENCORE CONNECTÉ : sans adresse configurée (`CATALOG_ENDPOINT` dans
 * `lib/config.ts`), cette fonction renvoie `null` sans rien demander au réseau, et l'application
 * garde le catalogue d'exemple. Ce chemin n'a donc jamais été exercé contre un vrai serveur.
 *
 * Une fois l'adresse renseignée : le document est téléchargé, vérifié (`parseCatalog`), conservé
 * sur l'appareil, puis affiché. Si le réseau manque, la dernière copie conservée est utilisée.
 */
export async function loadCatalog(): Promise<CatalogState | null> {
  if (!CATALOG_ENDPOINT) return null;
  try {
    const response = await fetch(CATALOG_ENDPOINT, { headers: { Accept: 'application/json' } });
    if (response.ok) {
      const doc = parseCatalog(await response.json());
      if (doc) {
        AsyncStorage.setItem(CACHE_KEY, JSON.stringify(doc)).catch(() => {});
        return { doc, origin: 'base' };
      }
    }
  } catch {
    // Réseau indisponible : on essaie la copie conservée.
  }
  try {
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    const doc = cached ? parseCatalog(JSON.parse(cached)) : null;
    return doc ? { doc, origin: 'copie' } : null;
  } catch {
    return null;
  }
}
