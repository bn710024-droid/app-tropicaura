import { PRODUCTS, WHOLESALE_EXAMPLE } from '../data';
import type { Photo as LocalPhoto } from '../data';
import { CatalogDocument, DEFAULT_RULES, SCHEMA_VERSION } from './schema';

/**
 * Photos embarquées dans l'application, par clé. Un document publié peut y faire référence
 * (`photo: { asset: 'mangue' }`) ou fournir l'adresse d'une nouvelle image (`photo: { url }`).
 */
export const PHOTO_ASSETS: Record<string, LocalPhoto> = Object.fromEntries(
  PRODUCTS.map((p) => [p.id, p.image]),
);

const offersById = new Map(WHOLESALE_EXAMPLE.map((w) => [w.id, w.offers]));

/**
 * CATALOGUE D'EXEMPLE embarqué, au format du futur logiciel de contrôle.
 *
 * Tout ce qu'il contient est une donnée d'exemple (`example: true`) : la liste des produits, les
 * prix particuliers, les offres professionnelles et leurs prix. Il sert à faire fonctionner et à
 * tester l'application en attendant le catalogue réel.
 */
export const EMBEDDED_CATALOG: CatalogDocument = {
  schema: SCHEMA_VERSION,
  updatedAt: '2026-11-22T00:00:00.000Z',
  example: true,
  rules: DEFAULT_RULES,
  products: PRODUCTS.map((p) => ({
    id: p.id,
    name: p.name,
    variety: p.variety,
    category: p.category,
    origin: p.origin,
    description: p.description,
    photo: { asset: p.id },
    tint: p.tint,
    months: p.season,
    available: true,
    bio: p.bio,
    rating: p.rating,
    reviews: p.reviews,
    retail: {
      price: p.price,
      unit: p.unit,
      unitLabel: p.unitLabel,
      noun: p.noun,
      step: p.step,
      ...(p.min ? { min: p.min } : null),
      ...(p.max ? { max: p.max } : null),
    },
    wholesale: (offersById.get(p.id) ?? []).map((o) => ({
      mode: o.mode,
      available: true,
      prices: { EXW: o.exw, FOB: o.fob },
      priceUnit: 'kg' as const,
    })),
  })),
};
