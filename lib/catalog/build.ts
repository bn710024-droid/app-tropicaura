import type { CategoryId, Photo, Product } from '../data';
import { PHOTO_ASSETS } from './embedded';
import { resolveOffer } from './rules';
import type { CatalogDocument, CatalogProduct, Incoterm, Mode, WholesaleOffer } from './schema';

/**
 * Du catalogue (données) aux produits affichés (écrans). C'est le seul endroit qui connaît les
 * deux formats : quand le catalogue change, les écrans suivent sans être modifiés.
 */

const CATEGORIES: CategoryId[] = [
  'fruits',
  'rouges',
  'agrumes',
  'exotiques',
  'legumes',
  'aromates',
];

const FALLBACK_PHOTO: Photo = require('../../assets/decor/leaf.webp');

function photoOf(p: CatalogProduct): Photo {
  if ('url' in p.photo) return { uri: p.photo.url };
  return PHOTO_ASSETS[p.photo.asset] ?? FALLBACK_PHOTO;
}

/** Identifiant d'une ligne commandable : le produit, complété du mode s'il y en a un. */
export const lineId = (productId: string, mode: Mode | null) =>
  mode ? `${productId}:${mode}` : productId;

/** Produit d'origine d'une ligne : « mangue:avion » → « mangue ». */
export const productIdOf = (id: string) => id.split(':')[0];

/** Informations communes à tous les espaces. Le prix et l'unité viennent ensuite de l'offre. */
function base(p: CatalogProduct): Product {
  const retail = p.retail;
  return {
    id: p.id,
    name: p.name,
    variety: p.variety,
    category: CATEGORIES.includes(p.category as CategoryId) ? (p.category as CategoryId) : 'fruits',
    origin: p.origin,
    price: retail?.price ?? 0,
    unit: retail?.unit ?? 'kg',
    unitLabel: retail?.unitLabel ?? 'le kg',
    noun: retail?.noun ?? ['kg', 'kg'],
    step: retail?.step ?? 0.5,
    ...(retail?.min ? { min: retail.min } : null),
    ...(retail?.max ? { max: retail.max } : null),
    noPrice: !retail || retail.price === null,
    tint: p.tint,
    season: p.months,
    bio: p.bio,
    rating: p.rating,
    reviews: p.reviews,
    kcal: 0,
    fibres: 0,
    vitC: 0,
    description: p.description,
    tip: '',
    image: photoOf(p),
  };
}

export type Space = {
  /** Produits affichés dans le catalogue, un par produit. */
  catalog: Product[];
  /** Produits et lignes commandables, par identifiant. */
  byId: Record<string, Product>;
};

/** Tous les produits disponibles, pour les affichages qui ne dépendent pas de l'espace. */
export function allProducts(doc: CatalogDocument): Record<string, Product> {
  return Object.fromEntries(doc.products.filter((p) => p.available).map((p) => [p.id, base(p)]));
}

/** Espace des particuliers : les produits qui ont un prix particulier. */
export function retailSpace(doc: CatalogDocument): Space {
  const catalog = doc.products
    .filter((p) => p.available && p.retail && p.retail.price !== null)
    .map(base);
  return { catalog, byId: Object.fromEntries(catalog.map((p) => [p.id, p])) };
}

function line(
  p: CatalogProduct,
  offer: WholesaleOffer,
  doc: CatalogDocument,
  incoterm: Incoterm,
  id: string,
): Product {
  const o = resolveOffer(offer, doc.rules, incoterm);
  return {
    ...base(p),
    id,
    productId: p.id,
    pro: true,
    priceTag: incoterm,
    mode: o.mode,
    unit: o.unit,
    unitLabel: o.unit === 'kg' ? 'le kg' : 'le conteneur',
    noun: o.noun,
    step: o.step,
    min: o.min,
    max: o.max,
    strictStep: o.strictStep,
    price: o.price,
    noPrice: o.noPrice,
    missing: o.missing,
    shownPrice: o.shownPrice,
    shownUnit: o.shownUnit,
    containerKg: o.containerKg,
    containerLabel: doc.rules.bateau.containerLabel,
  };
}

/**
 * Espace des professionnels.
 * - Grossistes et importateurs (`modes` vrai) : chaque offre avion ou bateau configurée devient
 *   une ligne commandable avec ses propres règles ; les offres sans mode gardent la règle
 *   générale.
 * - Autres professionnels : une seule ligne par produit, à la règle générale (kilos, sans mode).
 */
export function wholesaleSpace(doc: CatalogDocument, incoterm: Incoterm, modes: boolean): Space {
  const catalog: Product[] = [];
  const byId: Record<string, Product> = {};

  for (const p of doc.products) {
    if (!p.available) continue;
    const offers = p.wholesale.filter((o) => o.available);
    if (offers.length === 0) continue;

    if (!modes) {
      // Règle générale : au kilo, d'après la première offre chiffrée au kilo.
      const source = offers.find((o) => o.priceUnit === 'kg' && o.prices[incoterm]) ?? offers[0];
      const only = line(
        p,
        { mode: null, available: true, prices: source.prices, priceUnit: source.priceUnit },
        doc,
        incoterm,
        p.id,
      );
      catalog.push(only);
      byId[p.id] = only;
      continue;
    }

    // Une ligne par mode (la première offre de chaque mode est retenue).
    const seen = new Set<string>();
    const lines = offers
      .filter((o) => !seen.has(String(o.mode)) && !!seen.add(String(o.mode)))
      .map((o) => line(p, o, doc, incoterm, lineId(p.id, o.mode)));

    if (lines.length === 1 && lines[0].mode == null) {
      catalog.push(lines[0]);
      byId[p.id] = lines[0];
      continue;
    }
    // Produit à offres : la carte du catalogue présente la première, la fiche les propose toutes.
    const card: Product = { ...lines[0], id: p.id, offers: lines };
    catalog.push(card);
    byId[p.id] = card;
    lines.forEach((l) => {
      byId[l.id] = l;
    });
  }
  return { catalog, byId };
}
