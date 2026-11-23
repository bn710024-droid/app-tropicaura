import type { Incoterm, Mode, QuantityRules, WholesaleOffer } from './schema';

/**
 * Règles de quantité et de prix des offres professionnelles. Fonctions pures : elles ne
 * dépendent ni des écrans ni des images, et se testent seules.
 */

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Ce qu'il faut savoir d'une offre pour la commander : unité, bornes, prix. */
export type Orderable = {
  /** 'kg' : quantité en kilos. 'unit' : quantité en unités entières (conteneurs). */
  unit: 'kg' | 'unit';
  noun: [string, string];
  step: number;
  min: number;
  max: number;
  /** Vrai : seules les quantités multiples du palier sont acceptées. */
  strictStep: boolean;
  mode: Mode | null;
  /** Prix d'une unité commandée (un kilo, ou un conteneur). 0 si `noPrice`. */
  price: number;
  /** Vrai : le prix (ou ce qui permet de le calculer) n'est pas défini pour cette offre. */
  noPrice: boolean;
  /** Ce qui manque quand `noPrice` est vrai. */
  missing: 'prix' | 'poids' | null;
  /** Prix tel qu'il est configuré, et son unité : « 0,70 € le kg ». */
  shownPrice: number | null;
  shownUnit: string;
  /** Bateau : kilos par conteneur, ou `null` s'il n'est pas défini. */
  containerKg: number | null;
};

/**
 * Traduit une offre du catalogue en règles applicables, pour un incoterm donné.
 * Aucun prix n'est inventé : s'il manque, `noPrice` est vrai et aucun total n'est calculé.
 */
export function resolveOffer(
  offer: WholesaleOffer,
  rules: QuantityRules,
  incoterm: Incoterm,
): Orderable {
  const configured = offer.prices[incoterm];
  const raw = typeof configured === 'number' && configured > 0 ? configured : null;

  if (offer.mode === 'bateau') {
    const r = rules.bateau;
    const containerKg = offer.containerKg === undefined ? r.containerKg : offer.containerKg;
    const perContainer = offer.priceUnit === 'conteneur';
    // Prix au kilo : il faut connaître le poids du conteneur pour chiffrer un conteneur.
    const price = raw === null ? null : perContainer ? raw : containerKg ? raw * containerKg : null;
    return {
      unit: 'unit',
      noun: ['conteneur', 'conteneurs'],
      step: Math.max(1, Math.round(offer.stepQty ?? r.stepContainers)),
      min: Math.max(1, Math.round(offer.minQty ?? r.minContainers)),
      max: Math.max(1, Math.round(offer.maxQty ?? r.maxContainers)),
      strictStep: true,
      mode: 'bateau',
      price: price === null ? 0 : round2(price),
      noPrice: price === null,
      missing: price !== null ? null : raw === null ? 'prix' : 'poids',
      shownPrice: raw,
      shownUnit: perContainer ? 'le conteneur' : 'le kg',
      containerKg: containerKg ?? null,
    };
  }

  const r = offer.mode === 'avion' ? rules.avion : rules.standard;
  // Par avion ou sans mode, le prix est au kilo : un prix « au conteneur » n'est pas retenu.
  const price = offer.priceUnit === 'kg' ? raw : null;
  return {
    unit: 'kg',
    noun: ['kg', 'kg'],
    step: offer.stepQty ?? r.stepKg,
    min: offer.minQty ?? r.minKg,
    max: offer.maxQty ?? r.maxKg,
    strictStep: offer.mode === 'avion',
    mode: offer.mode,
    price: price ?? 0,
    noPrice: price === null,
    missing: price === null ? 'prix' : null,
    shownPrice: price,
    shownUnit: 'le kg',
    containerKg: null,
  };
}

const thousands = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '\u202F');

/** « 1 500 kg », « 2 conteneurs ». */
export function quantityText(line: Pick<Orderable, 'unit' | 'noun'>, qty: number) {
  return line.unit === 'kg'
    ? `${thousands(qty)}\u00A0kg`
    : `${thousands(qty)}\u00A0${qty > 1 ? line.noun[1] : line.noun[0]}`;
}

/** Équivalent en kilos d'une quantité : pour un bateau, conteneurs × poids du conteneur. */
export function kgEquivalent(line: Pick<Orderable, 'unit' | 'containerKg'>, qty: number) {
  if (line.unit === 'kg') return qty;
  return line.containerKg ? qty * line.containerKg : null;
}

/** Total d'une ligne, ou `null` si le prix n'est pas défini. */
export function lineTotal(line: Pick<Orderable, 'price' | 'noPrice'>, qty: number) {
  return line.noPrice ? null : round2(line.price * qty);
}

/** Quantité valide la plus proche : au moins le minimum, au plus le maximum, sur un palier. */
export function nearestValid(
  line: Pick<Orderable, 'step' | 'min' | 'max' | 'strictStep'>,
  qty: number,
) {
  let q = Math.round(qty);
  if (line.strictStep) q = Math.round(q / line.step) * line.step;
  return Math.max(line.min, Math.min(q, line.max));
}

/**
 * Contrôle une quantité saisie à la main. Renvoie la quantité retenue et, si la saisie a dû
 * être corrigée ou refusée, une phrase qui explique pourquoi.
 */
export function checkQuantity(
  line: Pick<Orderable, 'unit' | 'noun' | 'step' | 'min' | 'max' | 'strictStep' | 'mode'>,
  typed: number,
  current: number,
): { qty: number; note: string | null } {
  const say = (n: number) => quantityText(line, n);
  const what = line.unit === 'kg' ? 'de kilos' : 'de conteneurs';
  if (!Number.isFinite(typed) || typed <= 0) {
    return {
      qty: current,
      note: `Saisissez un nombre ${what} supérieur à zéro. La quantité reste à ${say(current)}.`,
    };
  }
  const by = line.mode ? ` par ${line.mode}` : '';
  if (typed < line.min) {
    return {
      qty: line.min,
      note: `Le minimum${by} est de ${say(line.min)} : quantité portée à ${say(line.min)}.`,
    };
  }
  if (typed > line.max) {
    return {
      qty: line.max,
      note: `L’application accepte jusqu’à ${say(line.max)} par ligne : quantité ramenée à ${say(line.max)}. Pour davantage, indiquez-le dans les précisions de votre demande.`,
    };
  }
  const qty = nearestValid(line, typed);
  if (qty !== typed) {
    return {
      qty,
      note:
        line.unit === 'kg'
          ? `${say(typed)} n’est pas un palier de ${say(line.step)} : quantité arrondie à ${say(qty)}.`
          : `Un conteneur ne se divise pas : quantité arrondie à ${say(qty)}.`,
    };
  }
  return { qty, note: null };
}
