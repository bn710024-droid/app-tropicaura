/**
 * Format du catalogue — la source de données commune aux deux applications (particuliers et
 * professionnels) et au futur logiciel de contrôle sur ordinateur.
 *
 * Un seul document décrit les produits, leurs photos, leurs descriptions, leur disponibilité,
 * leurs prix, leurs unités et leurs offres. Il ne contient que des données simples (texte,
 * nombres, listes) : il peut donc être enregistré tel quel dans une base, envoyé par un serveur
 * ou modifié dans un tableur, sans toucher aux écrans.
 *
 * Aujourd'hui, l'application lit un document d'exemple embarqué (voir `embedded.ts`). Le logiciel
 * de contrôle n'existe pas encore : quand il publiera un document à ce format, les écrans
 * suivront sans modification (voir `source.ts`).
 */
export const SCHEMA_VERSION = 1;

export type Mode = 'avion' | 'bateau';
export type Incoterm = 'EXW' | 'FOB';
/** Unité sur laquelle porte un prix de gros. */
export type PriceUnit = 'kg' | 'conteneur';

/** Photo d'un produit : image embarquée dans l'application, ou adresse d'une image publiée. */
export type Photo = { asset: string } | { url: string };

/** Offre aux particuliers (B2C). `null` sur un produit : il n'est pas vendu aux particuliers. */
export type RetailOffer = {
  /** Prix particulier en euros ; `null` s'il n'est pas fixé (le produit n'est alors pas proposé). */
  price: number | null;
  /** 'kg' : vendu au poids. 'unit' : vendu à la pièce, à la botte, à la barquette… */
  unit: 'kg' | 'unit';
  /** Libellé de l'unité : « le kg », « la pièce », « la barquette de 250 g »… */
  unitLabel: string;
  /** Nom de l'unité au singulier et au pluriel : ['pièce', 'pièces']. */
  noun: [string, string];
  /** Palier de quantité (0,5 kg, 1 pièce…). */
  step: number;
  min?: number;
  max?: number;
};

/** Offre aux professionnels (B2B). Un produit peut en avoir zéro, une ou plusieurs. */
export type WholesaleOffer = {
  /** Mode de transport de l'offre ; `null` pour une offre sans distinction avion / bateau. */
  mode: Mode | null;
  /** `false` : l'offre existe mais n'est pas commandable pour le moment. */
  available: boolean;
  /** Prix en euros par incoterm ; `null` tant que le prix n'est pas communiqué. Pas de CIF. */
  prices: Record<Incoterm, number | null>;
  /** Unité du prix : au kilo, ou au conteneur (bateau uniquement). */
  priceUnit: PriceUnit;
  /** Règles propres à cette offre. Absentes : celles du catalogue (`rules`) s'appliquent. */
  minQty?: number;
  stepQty?: number;
  maxQty?: number;
  /**
   * Bateau : kilos par conteneur pour cette offre. Absent : la référence du catalogue
   * s'applique. `null` : poids non défini (seul le nombre de conteneurs est alors affiché).
   */
  containerKg?: number | null;
};

/** Règles de quantité des professionnels, modifiables sans refaire les écrans. */
export type QuantityRules = {
  /** Offres sans mode de transport (et profil « autre professionnel »). */
  standard: { minKg: number; stepKg: number; maxKg: number };
  /** Avion : minimum et paliers en kilos. */
  avion: { minKg: number; stepKg: number; maxKg: number };
  /** Bateau : en conteneurs entiers ; `containerKg` est le poids de référence d'un conteneur. */
  bateau: {
    minContainers: number;
    stepContainers: number;
    maxContainers: number;
    containerKg: number | null;
    /** Précision affichée à côté du poids de référence : « Europe ». */
    containerLabel: string;
  };
};

export type CatalogProduct = {
  id: string;
  name: string;
  variety: string;
  category: string;
  origin: string;
  description: string;
  photo: Photo;
  /** Couleur d'ambiance de la fiche, au format #RRGGBB. */
  tint: string;
  /** Mois de disponibilité (1 = janvier … 12 = décembre). */
  months: number[];
  /** `false` : le produit est masqué partout, sans être supprimé. */
  available: boolean;
  bio: boolean;
  /** Note et nombre d'avis affichés aux particuliers (0 avis : rien n'est affiché). */
  rating: number;
  reviews: number;
  retail: RetailOffer | null;
  wholesale: WholesaleOffer[];
};

export type CatalogDocument = {
  schema: typeof SCHEMA_VERSION;
  /** Date de dernière mise à jour, au format ISO. */
  updatedAt: string;
  /** `true` : données d'exemple, à remplacer par le catalogue réel. */
  example: boolean;
  rules: QuantityRules;
  products: CatalogProduct[];
};

/** Valeurs de départ des règles (demandées pour les grossistes et importateurs). */
export const DEFAULT_RULES: QuantityRules = {
  standard: { minKg: 500, stepKg: 100, maxKg: 100000 },
  avion: { minKg: 500, stepKg: 500, maxKg: 100000 },
  bateau: {
    minContainers: 1,
    stepContainers: 1,
    maxContainers: 99,
    containerKg: 22000,
    containerLabel: 'Europe',
  },
};

// ───────────── Lecture d'un document reçu

const text = (v: unknown, fallback = '') => (typeof v === 'string' ? v : fallback);
const positive = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null;
const numberOr = (v: unknown, fallback: number) => positive(v) ?? fallback;

function parseRules(raw: unknown): QuantityRules {
  const r = (raw && typeof raw === 'object' ? raw : {}) as {
    standard?: Record<string, unknown>;
    avion?: Record<string, unknown>;
    bateau?: Record<string, unknown>;
  };
  const d = DEFAULT_RULES;
  const kg = (src: Record<string, unknown> | undefined, base: QuantityRules['avion']) => ({
    minKg: numberOr(src?.minKg, base.minKg),
    stepKg: numberOr(src?.stepKg, base.stepKg),
    maxKg: numberOr(src?.maxKg, base.maxKg),
  });
  return {
    standard: kg(r.standard, d.standard),
    avion: kg(r.avion, d.avion),
    bateau: {
      minContainers: Math.round(numberOr(r.bateau?.minContainers, d.bateau.minContainers)),
      stepContainers: Math.round(numberOr(r.bateau?.stepContainers, d.bateau.stepContainers)),
      maxContainers: Math.round(numberOr(r.bateau?.maxContainers, d.bateau.maxContainers)),
      containerKg:
        r.bateau && 'containerKg' in r.bateau
          ? positive(r.bateau.containerKg)
          : d.bateau.containerKg,
      containerLabel: text(r.bateau?.containerLabel, d.bateau.containerLabel),
    },
  };
}

function parseWholesale(raw: unknown): WholesaleOffer | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  // Mode inconnu : l'offre est écartée plutôt que d'être prise pour une offre sans mode.
  if (o.mode != null && o.mode !== 'avion' && o.mode !== 'bateau') return null;
  const mode = o.mode === 'avion' || o.mode === 'bateau' ? o.mode : null;
  const prices = (o.prices && typeof o.prices === 'object' ? o.prices : {}) as Record<
    string,
    unknown
  >;
  const offer: WholesaleOffer = {
    mode,
    available: o.available !== false,
    prices: { EXW: positive(prices.EXW), FOB: positive(prices.FOB) },
    // Un prix au conteneur n'a de sens que par bateau.
    priceUnit: o.priceUnit === 'conteneur' && mode === 'bateau' ? 'conteneur' : 'kg',
  };
  const min = positive(o.minQty);
  const step = positive(o.stepQty);
  const max = positive(o.maxQty);
  if (min) offer.minQty = min;
  if (step) offer.stepQty = step;
  if (max) offer.maxQty = max;
  if ('containerKg' in o) offer.containerKg = positive(o.containerKg);
  return offer;
}

function parseRetail(raw: unknown): RetailOffer | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const noun = Array.isArray(o.noun) && o.noun.length === 2 ? o.noun.map((n) => text(n)) : null;
  const unit = o.unit === 'unit' ? 'unit' : 'kg';
  const offer: RetailOffer = {
    price: positive(o.price),
    unit,
    unitLabel: text(o.unitLabel, unit === 'kg' ? 'le kg' : 'la pièce'),
    noun: noun ? [noun[0], noun[1]] : unit === 'kg' ? ['kg', 'kg'] : ['pièce', 'pièces'],
    step: numberOr(o.step, unit === 'kg' ? 0.5 : 1),
  };
  const min = positive(o.min);
  const max = positive(o.max);
  if (min) offer.min = min;
  if (max) offer.max = max;
  return offer;
}

function parseProduct(raw: unknown): CatalogProduct | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  if (typeof p.id !== 'string' || !p.id || p.id.includes(':') || typeof p.name !== 'string') {
    return null;
  }
  const photo = (p.photo && typeof p.photo === 'object' ? p.photo : {}) as Record<string, unknown>;
  const months = (Array.isArray(p.months) ? p.months : []).filter(
    (m): m is number => typeof m === 'number' && m >= 1 && m <= 12,
  );
  return {
    id: p.id,
    name: p.name,
    variety: text(p.variety),
    category: text(p.category, 'fruits'),
    origin: text(p.origin),
    description: text(p.description),
    photo:
      typeof photo.url === 'string' && photo.url
        ? { url: photo.url }
        : { asset: text(photo.asset, p.id) },
    tint: /^#[0-9a-fA-F]{6}$/.test(text(p.tint)) ? text(p.tint) : '#7AAA2C',
    months: months.length > 0 ? months : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    available: p.available !== false,
    bio: p.bio === true,
    rating: typeof p.rating === 'number' ? p.rating : 0,
    reviews: typeof p.reviews === 'number' ? p.reviews : 0,
    retail: parseRetail(p.retail),
    wholesale: (Array.isArray(p.wholesale) ? p.wholesale : [])
      .map(parseWholesale)
      .filter((o): o is WholesaleOffer => !!o),
  };
}

/**
 * Vérifie et normalise un document reçu de l'extérieur. Renvoie `null` s'il n'est pas à ce
 * format : l'application garde alors le catalogue qu'elle avait.
 */
export function parseCatalog(raw: unknown): CatalogDocument | null {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Record<string, unknown>;
  if (d.schema !== SCHEMA_VERSION || !Array.isArray(d.products)) return null;
  const seen = new Set<string>();
  const products = d.products
    .map(parseProduct)
    .filter((p): p is CatalogProduct => !!p && !seen.has(p.id) && !!seen.add(p.id));
  if (products.length === 0) return null;
  return {
    schema: SCHEMA_VERSION,
    updatedAt: text(d.updatedAt, new Date().toISOString()),
    example: d.example === true,
    rules: parseRules(d.rules),
    products,
  };
}
