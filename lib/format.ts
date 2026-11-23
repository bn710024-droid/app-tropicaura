import { countryName } from './countries';
import { MAX_STEPS } from './data';
import type { Product } from './data';
import type { QuantityRules } from './catalog/schema';
import type { Address, OrderLine } from './store';

/** Séparateur de milliers (espace fine insécable) sur la partie entière. */
const group = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, '\u202F');

export const euro = (n: number) => {
  const [whole, cents] = n.toFixed(2).split('.');
  return `${group(whole)},${cents}\u00A0€`;
};

export const round2 = (n: number) => Math.round(n * 100) / 100;

export const MONTHS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

export const MONTH_INITIALS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

export const currentMonth = () => new Date().getMonth() + 1;

/** « en novembre », « en août », « en avril » */
export const inMonth = (m: number) => `en ${MONTHS[m - 1]}`;

/** « dès mai », « dès octobre » : mois d'ouverture de la prochaine saison. */
export const fromMonth = (m: number) => `dès ${MONTHS[m - 1]}`;

export function qtyLabel(p: Product, q: number) {
  if (p.unit === 'kg') {
    if (q < 1) return `${Math.round(q * 1000)}\u00A0g`;
    const [whole, rest] = String(round2(q)).split('.');
    return `${group(whole)}${rest ? `,${rest}` : ''}\u00A0kg`;
  }
  return `${group(String(q))}\u00A0${q > 1 ? p.noun[1] : p.noun[0]}`;
}

/** Kilos sans décimales, avec séparateur de milliers : « 44 000 kg ». */
export const kgText = (kg: number) => `${group(String(Math.round(kg)))}\u00A0kg`;

/** Équivalent en kilos d'une quantité de conteneurs, quand le poids du conteneur est défini. */
export const kgEquivalent = (p: Product, q: number) =>
  p.unit === 'unit' && p.containerKg ? q * p.containerKg : null;

/** « 1 000 kg », ou « 2 conteneurs (44 000 kg) » quand l'équivalent est connu. */
export function qtyFull(p: Product, q: number) {
  const kg = kgEquivalent(p, q);
  return kg ? `${qtyLabel(p, q)} (${kgText(kg)})` : qtyLabel(p, q);
}

export const MODE_LABEL = { avion: 'Avion', bateau: 'Bateau' } as const;

/** Nom d'un produit suivi de son mode de transport : « Mangue · avion ». */
export const nameWithMode = (p: Product) => (p.mode ? `${p.name} · ${p.mode}` : p.name);

/** Quantité minimale et maximale d'un produit dans une commande. */
export const minQty = (p: Product) => p.min ?? p.step;
export const maxQty = (p: Product) => p.max ?? p.step * MAX_STEPS;

/** Unité du prix affiché, suivie de l'incoterm dans l'espace professionnel : « le kg · FOB ». */
const withTag = (p: Product, unit: string) => (p.priceTag ? `${unit} · ${p.priceTag}` : unit);

export const unitShort = (p: Product) =>
  withTag(p, p.shownUnit ?? (p.unit === 'kg' ? 'le kg' : p.unitLabel));

/** « la barquette de 250 g » → « la barquette » */
export const unitTiny = (p: Product) =>
  withTag(
    p,
    p.shownUnit ?? (p.unit === 'kg' ? 'le kg' : p.unitLabel.split(' ').slice(0, 2).join(' ')),
  );

/**
 * Prix affiché d'un produit ou d'une offre. Quand le prix n'est pas défini, on le dit : aucun
 * montant n'est inventé.
 */
export const priceText = (p: Product) =>
  p.noPrice && (p.shownPrice ?? null) === null ? 'Prix à confirmer' : euro(p.shownPrice ?? p.price);

/** Libellé court pour les sélecteurs de quantité. */
export const stepperLabel = (p: Product, q: number) =>
  p.unit === 'kg' ? qtyLabel(p, q) : String(q);

/** Total d'une ligne. Vaut 0 quand le prix n'est pas défini : voir `lineTotalText`. */
export const linePrice = (p: Product, q: number) => (p.noPrice ? 0 : round2(p.price * q));

/** Total d'une ligne en clair, ou « À confirmer » quand il ne peut pas être calculé. */
export const lineTotalText = (p: Product, q: number) =>
  p.noPrice ? 'À confirmer' : euro(linePrice(p, q));

export const isInSeason = (p: Product, m = currentMonth()) => p.season.includes(m);

export const isAllYear = (p: Product) => p.season.length === 12;

/** Prochain mois d'ouverture de saison, pour un produit hors saison. */
export function nextSeasonStart(p: Product, m = currentMonth()) {
  for (let i = 1; i <= 12; i++) {
    const month = ((m - 1 + i) % 12) + 1;
    if (p.season.includes(month)) return month;
  }
  return m;
}

export const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

export function formatDate(ts: number) {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${MONTHS[d.getMonth()]} · ${hh}h${mm}`;
}

/** Adresse internationale sur une ligne : rue, complément, code postal + ville, région, pays. */
export function formatAddress(a: Address) {
  return [
    a.line,
    a.line2,
    [a.postal, a.city].filter(Boolean).join(' '),
    a.region,
    countryName(a.country),
  ]
    .filter(Boolean)
    .join(', ');
}

/** « 2026-11-18 » → « 18 novembre 2026 ». */
export function formatDay(iso: string) {
  const [y, m, d] = iso.split('-').map((part) => parseInt(part, 10));
  if (!y || !m || !d) return '';
  return `${d === 1 ? '1er' : d} ${MONTHS[m - 1]} ${y}`;
}

/** Durée d'une vidéo : 8 → « 0:08 ». */
export const formatDuration = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`;

const FEMININE = new Set(['pièce', 'botte', 'barquette', 'tête']);

/**
 * Message d'ajout : « Raisin blanc, 500 g ajouté au panier », « Kaki, 2 pièces ajoutées au
 * panier », ou « … à votre demande » pour un professionnel.
 */
export function addedMessage(p: Product, qty: number, pro: boolean) {
  let done = 'ajouté';
  if (p.unit !== 'kg') {
    if (FEMININE.has(p.noun[0])) done += 'e';
    if (qty > 1) done += 's';
  }
  return `${nameWithMode(p)}, ${qtyLabel(p, qty)} ${done} ${pro ? 'à votre demande' : 'au panier'}`;
}

/** Ligne d'une demande professionnelle, telle qu'elle a été envoyée : « Mangue · avion — 1 000 kg ». */
export function requestLineText(l: OrderLine, fallbackName: string) {
  const name = l.name ?? fallbackName;
  const head = l.mode ? `${name} · ${l.mode}` : name;
  const quantity =
    l.unit === 'conteneur'
      ? `${l.qty}\u00A0conteneur${l.qty > 1 ? 's' : ''}${l.kg ? ` (${kgText(l.kg)})` : ''}`
      : kgText(l.qty);
  return `${head} — ${quantity}${l.priced === false ? ' · prix à confirmer' : ''}`;
}

/** Règles de quantité des professionnels, en une ligne, d'après le catalogue. */
export function proRulesText(rules: QuantityRules, modes: boolean) {
  if (!modes) return `Minimum ${kgText(rules.standard.minKg)} par produit`;
  const n = rules.bateau.minContainers;
  return `Avion dès ${kgText(rules.avion.minKg)} · bateau dès ${n}\u00A0conteneur${n > 1 ? 's' : ''}`;
}

/** Ce qui est déjà dans le panier (ou la demande) pour un produit : libellé de sa carte. */
export function inCartLabel(p: Product, cart: Record<string, number>) {
  const lines = (p.offers ?? [p]).filter((l) => (cart[l.id] ?? 0) > 0);
  if (lines.length === 0) return null;
  const head = p.pro ? 'Demande' : 'Au panier';
  if (lines.length > 1) return `${head} · ${lines.length} offres`;
  const l = lines[0];
  return `${head} · ${qtyLabel(l, cart[l.id])}${l.mode ? ` ${l.mode}` : ''}`;
}
