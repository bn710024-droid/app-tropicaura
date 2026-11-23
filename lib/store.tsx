import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Space, allProducts, retailSpace, wholesaleSpace } from './catalog/build';
import type { CatalogDocument, QuantityRules } from './catalog/schema';
import { CatalogOrigin, START_CATALOG, loadCatalog } from './catalog/source';
import { countryName, isCountry, transportFee } from './countries';
import type { Product } from './data';
import { euro, formatAddress, kgEquivalent, maxQty, minQty, round2 } from './format';
import { isEmail, normEmail, phoneDigits, tidyPhone } from './identity';
import { buildRequestPayload, transmit } from './transmission';
import {
  DEMO_VIDEOS,
  TeamVideo,
  fetchTeamVideos,
  reportComment,
  reportLike,
  reportView,
  videosFor,
} from './videos';

// ───────────── Stockage
// Tout est enregistré sur l'appareil (pas de serveur) : la liste des comptes et la session
// d'un côté, les données de chaque compte de l'autre.
const AUTH_KEY = 'primeur:auth:v1';
const dataKey = (accountId: string) => `primeur:data:v1:${accountId}`;
/** Données d'avant la création des comptes : reprises par le premier compte créé. */
const LEGACY_KEY = 'primeur:v1';

export type TabId = 'home' | 'favorites' | 'cart' | 'requests' | 'orders' | 'profile';

// ───────────── Comptes
export type AccountType = 'particulier' | 'pro';
export type Activity = 'grossiste' | 'importateur' | 'autre';

export type Account = {
  id: string;
  type: AccountType;
  name: string;
  email: string;
  phone: string;
  whatsapp: string;
  company: string;
  activity: Activity | null;
  createdAt: number;
};

export type NewAccount = Omit<Account, 'id' | 'createdAt'>;

type Auth = { accounts: Account[]; sessionId: string | null };

export const ACTIVITY_LABEL: Record<Activity, string> = {
  grossiste: 'Grossiste',
  importateur: 'Importateur',
  autre: 'Autre professionnel',
};

// ───────────── Commandes
export type Address = {
  id: string;
  /** Nom du destinataire. */
  name: string;
  line: string;
  line2: string;
  postal: string;
  city: string;
  region: string;
  /** Code ISO 3166-1 à deux lettres. */
  country: string;
};

export type NewAddress = Omit<Address, 'id'>;

/** Où écrire au client : confirmation, validation, suivi. */
export type Contact = { email: string; phone: string };

export type OrderLine = {
  id: string;
  qty: number;
  /** Prix d'une unité commandée au moment de la commande (0 si `priced` est faux). */
  price: number;
  // ── Demandes professionnelles : ce qui a été demandé, figé au moment de l'envoi.
  name?: string;
  mode?: 'avion' | 'bateau' | null;
  /** Unité de `qty` : kilos, ou conteneurs. */
  unit?: 'kg' | 'conteneur';
  /** Équivalent en kilos, quand il est connu. */
  kg?: number | null;
  /** Faux : le prix n'était pas défini, la ligne n'entre pas dans l'estimation. */
  priced?: boolean;
};

export type StatusId = 'attente' | 'confirmee' | 'preparation' | 'expediee' | 'livree' | 'annulee';

const FLOW: StatusId[] = ['attente', 'confirmee', 'preparation', 'expediee', 'livree'];

/** Commande d'un particulier, payée à la confirmation. */
export type Order = {
  id: string;
  number: string;
  createdAt: number;
  lines: OrderLine[];
  subtotal: number;
  /** Vrai : nous expédions. Faux : le client organise lui-même son transport. */
  transport: boolean;
  transportCost: number;
  total: number;
  recipient: string;
  address: string;
  country: string;
  email: string;
  phone: string;
  payment: string;
  note: string;
  status: StatusId;
  statusAt: number;
};

export type Incoterm = 'EXW' | 'FOB';

/** Demande d'un professionnel : aucune somme n'est payée dans l'application. */
export type ProRequest = {
  id: string;
  number: string;
  createdAt: number;
  /** Quantités en kilos, prix au kilo selon l'incoterm choisi. */
  lines: OrderLine[];
  incoterm: Incoterm;
  /** Estimation : somme des lignes dont le prix est défini. */
  subtotal: number;
  /** Nombre de lignes sans prix défini, donc hors estimation. */
  unpriced?: number;
  company: string;
  contactName: string;
  email: string;
  phone: string;
  whatsapp: string;
  destination: string;
  note: string;
  status: StatusId;
  statusAt: number;
  /** Date de prise en charge par l'équipe : la demande passe alors dans « Commandes ». */
  takenAt: number | null;
  /** Vrai une fois la demande reçue par le logiciel de l'équipe (pas encore connecté). */
  transmitted: boolean;
};

export type VideoComment = { id: string; text: string; at: number };

type Persisted = {
  favorites: string[];
  cart: Record<string, number>;
  orders: Order[];
  requests: ProRequest[];
  addresses: Address[];
  addressId: string;
  contact: Contact;
  incoterm: Incoterm;
  /** Vidéos de l'équipe déjà regardées par ce compte. */
  watched: string[];
  /** Vidéos aimées, et commentaires écrits par ce compte (enregistrés sur l'appareil). */
  likes: string[];
  comments: Record<string, VideoComment[]>;
};

const EMPTY: Persisted = {
  favorites: [],
  cart: {},
  orders: [],
  requests: [],
  addresses: [],
  addressId: '',
  contact: { email: '', phone: '' },
  incoterm: 'EXW',
  watched: [],
  likes: [],
  comments: {},
};

// ───────────── Catalogue selon l'espace

/** Grossistes et importateurs commandent par avion ou par bateau, avec les règles de ces modes. */
const usesModesFor = (account: Pick<Account, 'type' | 'activity'>) =>
  account.type === 'pro' &&
  (account.activity === 'grossiste' || account.activity === 'importateur');

function spaceFor(
  doc: CatalogDocument,
  account: Pick<Account, 'type' | 'activity'> | null,
  incoterm: Incoterm,
): Space {
  if (account?.type !== 'pro') return retailSpace(doc);
  return wholesaleSpace(doc, incoterm, usesModesFor(account));
}

/** Ramène une quantité dans les bornes de la ligne (minimum, maximum, palier). */
function clampQty(p: Product | undefined, qty: number) {
  if (!p || p.offers || !(qty > 0)) return 0;
  let q = p.pro ? Math.round(qty) : round2(qty);
  if (p.strictStep) q = Math.round(q / p.step) * p.step;
  return Math.max(p.min ?? 0, Math.min(q, maxQty(p)));
}

const isStatus = (s: unknown): s is StatusId =>
  typeof s === 'string' && (FLOW as string[]).concat('annulee').includes(s);

/** Remet d'équerre des données lues sur l'appareil (y compris celles d'anciennes versions). */
function sanitize(
  raw: unknown,
  account: Pick<Account, 'type' | 'activity'>,
  doc: CatalogDocument,
): Persisted {
  const saved = (raw && typeof raw === 'object' ? raw : {}) as Partial<Persisted>;
  const incoterm: Incoterm = saved.incoterm === 'FOB' ? 'FOB' : 'EXW';
  const { byId } = spaceFor(doc, account, incoterm);

  const cart: Record<string, number> = {};
  Object.entries(saved.cart ?? {}).forEach(([key, q]) => {
    // Un produit désormais proposé par avion ou par bateau : la ligne rejoint sa première offre.
    const id = byId[key]?.offers?.[0]?.id ?? key;
    const qty = typeof q === 'number' ? clampQty(byId[id], q) : 0;
    if (qty > 0 && !cart[id]) cart[id] = qty;
  });

  const orders = (Array.isArray(saved.orders) ? saved.orders : [])
    .filter((o) => o && o.id)
    .map((o: Order & { delivery?: number }): Order => ({
      id: o.id,
      number: o.number,
      createdAt: o.createdAt,
      lines: o.lines ?? [],
      subtotal: o.subtotal ?? 0,
      transport: typeof o.transport === 'boolean' ? o.transport : true,
      transportCost: o.transportCost ?? o.delivery ?? 0,
      total: o.total ?? 0,
      recipient: o.recipient ?? '',
      address: o.address ?? '',
      country: o.country ?? '',
      email: o.email ?? '',
      phone: o.phone ?? '',
      payment: o.payment ?? '',
      note: o.note ?? '',
      // Les commandes d'avant le suivi par étapes sont considérées comme terminées.
      status: isStatus(o.status) ? o.status : 'livree',
      statusAt: o.statusAt ?? o.createdAt,
    }));

  return {
    favorites: (Array.isArray(saved.favorites) ? saved.favorites : []).filter((id) => byId[id]),
    cart,
    orders,
    requests: (Array.isArray(saved.requests) ? saved.requests : []).filter(
      (r) => r && r.id && isStatus(r.status),
    ),
    // Les adresses d'avant l'ouverture à l'international n'ont pas de pays : on les écarte.
    addresses: (Array.isArray(saved.addresses) ? saved.addresses : []).filter(
      (a) => a && isCountry(a.country) && !!a.line,
    ),
    addressId: typeof saved.addressId === 'string' ? saved.addressId : '',
    contact: { ...EMPTY.contact, ...saved.contact },
    incoterm,
    watched: (Array.isArray(saved.watched) ? saved.watched : []).filter(
      (id) => typeof id === 'string',
    ),
    likes: (Array.isArray(saved.likes) ? saved.likes : []).filter((id) => typeof id === 'string'),
    comments:
      saved.comments && typeof saved.comments === 'object' && !Array.isArray(saved.comments)
        ? Object.fromEntries(
            Object.entries(saved.comments).map(([id, list]) => [
              id,
              (Array.isArray(list) ? list : []).filter((c) => c && typeof c.text === 'string'),
            ]),
          )
        : {},
  };
}

const matches = (a: Account, identifier: string) => {
  const id = identifier.trim();
  if (!id) return false;
  if (isEmail(id)) return !!a.email && a.email === normEmail(id);
  const digits = phoneDigits(id);
  return digits.length >= 8 && !!a.phone && phoneDigits(a.phone) === digits;
};

type Result = { ok: true } | { ok: false; error: string };

type Store = Persisted & {
  hydrated: boolean;
  /** Compte connecté, ou null : l'application affiche alors l'inscription. */
  account: Account | null;
  isPro: boolean;
  signUp: (input: NewAccount) => Result;
  signIn: (identifier: string) => Promise<Result>;
  signOut: () => void;
  deleteAccount: () => void;
  updateAccount: (patch: Partial<NewAccount>) => Result;

  tab: TabId;
  setTab: (t: TabId) => void;

  /** Produits visibles dans l'espace du compte : prix particuliers, ou prix de gros. */
  catalog: Product[];
  /** Produits et lignes commandables de l'espace, par identifiant. */
  byId: Record<string, Product>;
  /** Tous les produits du catalogue, pour afficher un nom ou une photo quel que soit l'espace. */
  baseById: Record<string, Product>;
  /** Vrai pour les grossistes et importateurs : offres par avion et par bateau. */
  usesModes: boolean;
  /** D'où vient le catalogue : exemple embarqué (aujourd'hui), base de contrôle, ou copie. */
  catalogOrigin: CatalogOrigin;
  /** Vrai tant que le catalogue affiché est fait de données d'exemple. */
  catalogExample: boolean;
  /** Règles de quantité des professionnels, lues dans le catalogue. */
  rules: QuantityRules;
  setIncoterm: (i: Incoterm) => void;

  toggleFavorite: (id: string) => boolean;
  setQty: (id: string, qty: number) => void;
  addToCart: (id: string, qty: number) => void;
  /** Ajoute la quantité de départ (ou un palier de plus) ; renvoie ce qui a été ajouté. */
  addStep: (id: string) => { product: Product; qty: number } | null;
  cartLines: { id: string; qty: number }[];
  cartCount: number;
  /** Somme des lignes dont le prix est défini. */
  subtotal: number;
  /** Nombre de lignes dont le prix n'est pas défini (elles n'entrent pas dans `subtotal`). */
  unpriced: number;

  /** Adresse sélectionnée, ou undefined tant que le client n'en a saisi aucune. */
  address: Address | undefined;
  selectAddress: (id: string) => void;
  addAddress: (address: NewAddress) => void;

  placeOrder: (o: { transport: boolean; payment: string; note: string; contact: Contact }) => Order;
  placeRequest: (r: {
    company: string;
    contactName: string;
    email: string;
    phone: string;
    whatsapp: string;
    destination: string;
    note: string;
  }) => ProRequest;
  cancelRequest: (id: string) => void;
  /** Outils de test : simulent l'étape suivante, à la place de l'équipe. */
  advanceOrder: (id: string) => StatusId | null;
  advanceRequest: (id: string) => StatusId | null;
  reorder: (lines: OrderLine[]) => void;

  /** Vidéos de l'équipe visibles par ce compte, de la plus récente à la plus ancienne. */
  videos: TeamVideo[];
  /** Nombre de vidéos pas encore regardées : c'est le compteur de l'onglet Favoris. */
  newVideoCount: number;
  markWatched: (id: string) => void;
  /** J'aime et commentaires : enregistrés sur l'appareil, pas encore transmis à l'équipe. */
  toggleLike: (id: string) => boolean;
  addComment: (videoId: string, text: string) => void;
  removeComment: (videoId: string, commentId: string) => void;
};

const Ctx = createContext<Store | null>(null);

const nextStatus = (s: StatusId): StatusId | null => {
  const i = FLOW.indexOf(s);
  return i >= 0 && i < FLOW.length - 1 ? FLOW[i + 1] : null;
};

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<Auth>({ accounts: [], sessionId: null });
  // Les données et le compte auquel elles appartiennent changent toujours ensemble.
  const [box, setBox] = useState<{ id: string; data: Persisted } | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [tab, setTabState] = useState<TabId>('home');
  const legacy = useRef<unknown>(null);
  // Publications de l'équipe : exemples embarqués, remplacés par les vraies dès que l'outil
  // de publication est connecté.
  const [published, setPublished] = useState<TeamVideo[]>(DEMO_VIDEOS);
  useEffect(() => {
    let alive = true;
    fetchTeamVideos().then((list) => {
      if (alive && list) setPublished(list);
    });
    return () => {
      alive = false;
    };
  }, []);

  const account = useMemo(
    () => (box ? (auth.accounts.find((a) => a.id === box.id) ?? null) : null),
    [auth.accounts, box],
  );
  const isPro = account?.type === 'pro';
  const data = box?.data ?? EMPTY;

  // Catalogue : l'exemple embarqué, remplacé par celui du logiciel de contrôle le jour où une
  // adresse sera configurée (voir lib/catalog/source.ts). Rien n'est connecté aujourd'hui.
  const [cat, setCat] = useState(START_CATALOG);
  const catRef = useRef(cat);
  catRef.current = cat;
  useEffect(() => {
    let alive = true;
    loadCatalog().then((next) => {
      if (alive && next) setCat(next);
    });
    return () => {
      alive = false;
    };
  }, []);

  const accountType = account?.type ?? null;
  const activity = account?.activity ?? null;
  const usesModes = !!account && usesModesFor(account);
  const space = useMemo(
    () => spaceFor(cat.doc, accountType ? { type: accountType, activity } : null, data.incoterm),
    [cat.doc, accountType, activity, data.incoterm],
  );
  const catalog = space.catalog;
  const byId = space.byId;
  const baseById = useMemo(() => allProducts(cat.doc), [cat.doc]);

  // Valeurs courantes, pour les actions qui ne doivent pas être recréées à chaque rendu.
  const live = useRef({ auth, data, byId, account, isPro });
  live.current = { auth, data, byId, account, isPro };

  const setData = useCallback((fn: (d: Persisted) => Persisted) => {
    setBox((b) => (b ? { ...b, data: fn(b.data) } : b));
  }, []);

  // ───── Lecture au démarrage
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [rawAuth, rawLegacy] = await Promise.all([
          AsyncStorage.getItem(AUTH_KEY),
          AsyncStorage.getItem(LEGACY_KEY),
        ]);
        if (rawLegacy) legacy.current = JSON.parse(rawLegacy);
        const saved = rawAuth ? (JSON.parse(rawAuth) as Partial<Auth>) : null;
        const accounts = (saved?.accounts ?? []).filter((a) => a && a.id && a.type);
        const session = accounts.find((a) => a.id === saved?.sessionId);
        let loaded: { id: string; data: Persisted } | null = null;
        if (session) {
          const raw = await AsyncStorage.getItem(dataKey(session.id));
          loaded = {
            id: session.id,
            data: sanitize(raw ? JSON.parse(raw) : null, session, catRef.current.doc),
          };
        }
        if (!alive) return;
        setAuth({ accounts, sessionId: session?.id ?? null });
        setBox(loaded);
      } catch {
        // Stockage illisible : on repart sans compte, rien n'est écrasé tant qu'on ne s'inscrit pas.
      } finally {
        if (alive) setHydrated(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // ───── Écriture à chaque changement
  useEffect(() => {
    if (hydrated) AsyncStorage.setItem(AUTH_KEY, JSON.stringify(auth)).catch(() => {});
  }, [auth, hydrated]);

  useEffect(() => {
    if (hydrated && box) {
      AsyncStorage.setItem(dataKey(box.id), JSON.stringify(box.data)).catch(() => {});
    }
  }, [box, hydrated]);

  // ───── Comptes
  const signUp = useCallback<Store['signUp']>((input) => {
    const email = input.email ? normEmail(input.email) : '';
    const phone = input.phone ? tidyPhone(input.phone) : '';
    const taken = live.current.auth.accounts.some(
      (a) => (email && matches(a, email)) || (phone && matches(a, phone)),
    );
    if (taken) {
      return {
        ok: false,
        error:
          'Un compte existe déjà avec cet e-mail ou ce numéro sur cet appareil. Connectez-vous.',
      };
    }
    const now = Date.now();
    const created: Account = {
      ...input,
      email,
      phone,
      whatsapp: tidyPhone(input.whatsapp),
      name: input.name.trim(),
      company: input.company.trim(),
      id: `c${now.toString(36)}`,
      createdAt: now,
    };
    // Le premier compte reprend ce qui avait été enregistré avant l'arrivée des comptes.
    const first = live.current.auth.accounts.length === 0;
    const start = sanitize(first ? legacy.current : null, created, catRef.current.doc);
    if (first && legacy.current) {
      legacy.current = null;
      AsyncStorage.removeItem(LEGACY_KEY).catch(() => {});
    }
    setAuth((a) => ({ accounts: [...a.accounts, created], sessionId: created.id }));
    setBox({ id: created.id, data: start });
    setTabState('home');
    return { ok: true };
  }, []);

  const signIn = useCallback<Store['signIn']>(async (identifier) => {
    const found = live.current.auth.accounts.find((a) => matches(a, identifier));
    if (!found) {
      return {
        ok: false,
        error:
          'Aucun compte ne correspond sur cet appareil. Vérifiez la saisie, ou créez votre compte.',
      };
    }
    let raw: string | null = null;
    try {
      raw = await AsyncStorage.getItem(dataKey(found.id));
    } catch {
      // Lecture impossible : le compte s'ouvre avec des données vides.
    }
    setBox({
      id: found.id,
      data: sanitize(raw ? JSON.parse(raw) : null, found, catRef.current.doc),
    });
    setAuth((a) => ({ ...a, sessionId: found.id }));
    setTabState('home');
    return { ok: true };
  }, []);

  const signOut = useCallback(() => {
    setAuth((a) => ({ ...a, sessionId: null }));
    setBox(null);
  }, []);

  const deleteAccount = useCallback(() => {
    const id = live.current.account?.id;
    if (!id) return;
    AsyncStorage.removeItem(dataKey(id)).catch(() => {});
    setAuth((a) => ({ accounts: a.accounts.filter((x) => x.id !== id), sessionId: null }));
    setBox(null);
  }, []);

  const updateAccount = useCallback<Store['updateAccount']>((patch) => {
    const me = live.current.account;
    if (!me) return { ok: false, error: 'Aucun compte ouvert.' };
    const next: Account = {
      ...me,
      ...patch,
      email: patch.email !== undefined ? normEmail(patch.email) : me.email,
      phone: patch.phone !== undefined ? tidyPhone(patch.phone) : me.phone,
      whatsapp: patch.whatsapp !== undefined ? tidyPhone(patch.whatsapp) : me.whatsapp,
    };
    const clash = live.current.auth.accounts.some(
      (a) =>
        a.id !== me.id &&
        ((next.email && matches(a, next.email)) || (next.phone && matches(a, next.phone))),
    );
    if (clash) {
      return { ok: false, error: 'Cet e-mail ou ce numéro est déjà utilisé par un autre compte.' };
    }
    setAuth((a) => ({ ...a, accounts: a.accounts.map((x) => (x.id === me.id ? next : x)) }));
    return { ok: true };
  }, []);

  // « Panier » pour un particulier, « Demandes » pour un professionnel : même intention.
  const setTab = useCallback((t: TabId) => {
    const pro = live.current.isPro;
    setTabState(pro && t === 'cart' ? 'requests' : !pro && t === 'requests' ? 'cart' : t);
  }, []);

  // ───── Favoris, panier
  const toggleFavorite = useCallback(
    (id: string) => {
      const was = live.current.data.favorites.includes(id);
      setData((d) => ({
        ...d,
        favorites: d.favorites.includes(id)
          ? d.favorites.filter((f) => f !== id)
          : [id, ...d.favorites],
      }));
      return !was;
    },
    [setData],
  );

  const setQty = useCallback(
    (id: string, qty: number) => {
      setData((d) => {
        const next = { ...d.cart };
        const q = clampQty(live.current.byId[id], qty);
        if (q <= 0) delete next[id];
        else next[id] = q;
        return { ...d, cart: next };
      });
    },
    [setData],
  );

  const addToCart = useCallback(
    (id: string, qty: number) => {
      setData((d) => {
        const q = clampQty(live.current.byId[id], (d.cart[id] ?? 0) + qty);
        return q > 0 ? { ...d, cart: { ...d.cart, [id]: q } } : d;
      });
    },
    [setData],
  );

  const addStep = useCallback<Store['addStep']>(
    (id) => {
      const found = live.current.byId[id];
      // Produit à plusieurs offres : le choix (avion ou bateau) se fait sur la fiche.
      const product = found?.offers ? (found.offers.length === 1 ? found.offers[0] : null) : found;
      if (!product) return null;
      const lineKey = product.id;
      const qty = (live.current.data.cart[lineKey] ?? 0) > 0 ? product.step : minQty(product);
      addToCart(lineKey, qty);
      return { product, qty };
    },
    [addToCart],
  );

  const setIncoterm = useCallback(
    (incoterm: Incoterm) => setData((d) => ({ ...d, incoterm })),
    [setData],
  );

  const selectAddress = useCallback(
    (id: string) => setData((d) => ({ ...d, addressId: id })),
    [setData],
  );

  const addAddress = useCallback(
    (address: NewAddress) => {
      const id = `adr-${Date.now().toString(36)}`;
      setData((d) => ({ ...d, addresses: [...d.addresses, { ...address, id }], addressId: id }));
    },
    [setData],
  );

  const totals = useMemo(() => {
    const cartLines = Object.entries(data.cart)
      .filter(([id]) => byId[id])
      .map(([id, qty]) => ({ id, qty }));
    const priced = cartLines.filter((l) => !byId[l.id].noPrice);
    const subtotal = round2(priced.reduce((sum, l) => sum + byId[l.id].price * l.qty, 0));
    return {
      cartLines,
      cartCount: cartLines.length,
      subtotal,
      unpriced: cartLines.length - priced.length,
    };
  }, [data.cart, byId]);

  const address = useMemo(
    () => data.addresses.find((a) => a.id === data.addressId) ?? data.addresses[0],
    [data.addresses, data.addressId],
  );

  const currentLines = () => {
    const { data: d, byId: products } = live.current;
    return Object.entries(d.cart)
      .filter(([id]) => products[id] && !products[id].offers)
      .map(([id, qty]): OrderLine => {
        const p = products[id];
        if (!p.pro) return { id, qty, price: p.price };
        return {
          id,
          qty,
          price: p.noPrice ? 0 : p.price,
          name: p.name,
          mode: p.mode ?? null,
          unit: p.unit === 'kg' ? 'kg' : 'conteneur',
          kg: p.unit === 'kg' ? qty : kgEquivalent(p, qty),
          priced: !p.noPrice,
        };
      });
  };

  // ───── Commande d'un particulier
  const placeOrder = useCallback<Store['placeOrder']>(
    ({ transport, payment, note, contact }) => {
      const d = live.current.data;
      const lines = currentLines();
      const subtotal = round2(lines.reduce((s, l) => s + l.price * l.qty, 0));
      const adr = d.addresses.find((a) => a.id === d.addressId) ?? d.addresses[0];
      const transportCost = transport && adr ? transportFee(adr.country) : 0;
      const now = Date.now();
      const order: Order = {
        id: now.toString(36),
        number: `PR-${String(now).slice(-5, -1)}`,
        createdAt: now,
        lines,
        subtotal,
        transport,
        transportCost,
        total: round2(subtotal + transportCost),
        recipient: adr?.name ?? '',
        address: adr ? formatAddress(adr) : '',
        country: adr?.country ?? '',
        email: contact.email,
        phone: contact.phone,
        payment,
        note,
        status: 'attente',
        statusAt: now,
      };
      setData((prev) => ({ ...prev, cart: {}, contact, orders: [order, ...prev.orders] }));
      return order;
    },
    [setData],
  );

  // ───── Demande d'un professionnel
  const sendToTeam = useCallback(
    (request: ProRequest) => {
      transmit(buildRequestPayload(request, live.current.account ?? undefined)).then((result) => {
        if (result !== 'sent') return; // pas connecté, ou échec : la demande reste en attente
        setData((d) => ({
          ...d,
          requests: d.requests.map((r) => (r.id === request.id ? { ...r, transmitted: true } : r)),
        }));
      });
    },
    [setData],
  );

  const placeRequest = useCallback<Store['placeRequest']>(
    (fields) => {
      const lines = currentLines();
      const now = Date.now();
      const request: ProRequest = {
        ...fields,
        id: now.toString(36),
        number: `DP-${String(now).slice(-5, -1)}`,
        createdAt: now,
        lines,
        incoterm: live.current.data.incoterm,
        subtotal: round2(
          lines.filter((l) => l.priced !== false).reduce((sum, l) => sum + l.price * l.qty, 0),
        ),
        unpriced: lines.filter((l) => l.priced === false).length,
        status: 'attente',
        statusAt: now,
        takenAt: null,
        transmitted: false,
      };
      setData((prev) => ({ ...prev, cart: {}, requests: [request, ...prev.requests] }));
      sendToTeam(request);
      return request;
    },
    [setData, sendToTeam],
  );

  // À l'ouverture d'un compte professionnel, on retente les demandes pas encore transmises.
  const boxId = box?.id;
  useEffect(() => {
    if (!boxId || !live.current.isPro) return;
    live.current.data.requests.filter((r) => !r.transmitted).forEach(sendToTeam);
  }, [boxId, sendToTeam]);

  const cancelRequest = useCallback(
    (id: string) => {
      const now = Date.now();
      setData((d) => ({
        ...d,
        requests: d.requests.map((r) =>
          r.id === id && r.status !== 'livree' ? { ...r, status: 'annulee', statusAt: now } : r,
        ),
      }));
    },
    [setData],
  );

  const advanceOrder = useCallback<Store['advanceOrder']>(
    (id) => {
      const order = live.current.data.orders.find((o) => o.id === id);
      const next = order ? nextStatus(order.status) : null;
      if (!next) return null;
      const now = Date.now();
      setData((d) => ({
        ...d,
        orders: d.orders.map((o) => (o.id === id ? { ...o, status: next, statusAt: now } : o)),
      }));
      return next;
    },
    [setData],
  );

  const advanceRequest = useCallback<Store['advanceRequest']>(
    (id) => {
      const request = live.current.data.requests.find((r) => r.id === id);
      const next = request ? nextStatus(request.status) : null;
      if (!next) return null;
      const now = Date.now();
      setData((d) => ({
        ...d,
        requests: d.requests.map((r) =>
          r.id === id ? { ...r, status: next, statusAt: now, takenAt: r.takenAt ?? now } : r,
        ),
      }));
      return next;
    },
    [setData],
  );

  const reorder = useCallback(
    (lines: OrderLine[]) => {
      setData((d) => {
        const cart = { ...d.cart };
        lines.forEach((l) => {
          const products = live.current.byId;
          // Une ancienne ligne sans mode rejoint la première offre du produit.
          const id = products[l.id]?.offers?.[0]?.id ?? l.id;
          const q = clampQty(products[id], (cart[id] ?? 0) + l.qty);
          if (q > 0) cart[id] = q;
        });
        return { ...d, cart };
      });
    },
    [setData],
  );

  const videos = useMemo(() => videosFor(published, isPro), [published, isPro]);
  const newVideoCount = useMemo(
    () => videos.filter((v) => !data.watched.includes(v.id)).length,
    [videos, data.watched],
  );
  const markWatched = useCallback(
    (id: string) => {
      if (live.current.data.watched.includes(id)) return;
      setData((d) => (d.watched.includes(id) ? d : { ...d, watched: [...d.watched, id] }));
      // Pas encore connecté : la vue n'est comptée que sur cet appareil.
      reportView(id, live.current.account?.id ?? null);
    },
    [setData],
  );

  const toggleLike = useCallback(
    (id: string) => {
      const liked = !live.current.data.likes.includes(id);
      setData((d) => ({
        ...d,
        likes: liked ? [...d.likes.filter((x) => x !== id), id] : d.likes.filter((x) => x !== id),
      }));
      reportLike(id, liked, live.current.account?.id ?? null);
      return liked;
    },
    [setData],
  );
  const addComment = useCallback(
    (videoId: string, text: string) => {
      const clean = text.trim().slice(0, 300);
      if (!clean) return;
      const now = Date.now();
      const comment: VideoComment = { id: now.toString(36), text: clean, at: now };
      setData((d) => ({
        ...d,
        comments: { ...d.comments, [videoId]: [...(d.comments[videoId] ?? []), comment] },
      }));
      reportComment(videoId, clean, live.current.account?.id ?? null);
    },
    [setData],
  );
  const removeComment = useCallback(
    (videoId: string, commentId: string) => {
      setData((d) => ({
        ...d,
        comments: {
          ...d.comments,
          [videoId]: (d.comments[videoId] ?? []).filter((c) => c.id !== commentId),
        },
      }));
    },
    [setData],
  );

  const value = useMemo<Store>(
    () => ({
      ...data,
      ...totals,
      hydrated,
      account,
      isPro,
      signUp,
      signIn,
      signOut,
      deleteAccount,
      updateAccount,
      tab,
      setTab,
      catalog,
      byId,
      baseById,
      usesModes,
      catalogOrigin: cat.origin,
      catalogExample: cat.doc.example,
      rules: cat.doc.rules,
      setIncoterm,
      toggleFavorite,
      setQty,
      addToCart,
      addStep,
      address,
      selectAddress,
      addAddress,
      placeOrder,
      placeRequest,
      cancelRequest,
      advanceOrder,
      advanceRequest,
      reorder,
      videos,
      newVideoCount,
      markWatched,
      toggleLike,
      addComment,
      removeComment,
    }),
    [
      data,
      totals,
      hydrated,
      account,
      isPro,
      signUp,
      signIn,
      signOut,
      deleteAccount,
      updateAccount,
      tab,
      setTab,
      catalog,
      byId,
      baseById,
      usesModes,
      cat,
      setIncoterm,
      toggleFavorite,
      setQty,
      addToCart,
      addStep,
      address,
      selectAddress,
      addAddress,
      placeOrder,
      placeRequest,
      cancelRequest,
      advanceOrder,
      advanceRequest,
      reorder,
      videos,
      newVideoCount,
      markWatched,
      toggleLike,
      addComment,
      removeComment,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStore doit être utilisé dans <StoreProvider>');
  return v;
}

// ───────────── Suivi

/** Message de confirmation adressé au client dès le paiement. */
export function confirmationMessage(o: Order) {
  const firstName = o.recipient.trim().split(/\s+/)[0];
  return (
    `${firstName ? `Bonjour ${firstName}, nous` : 'Nous'} avons bien reçu votre commande ${o.number} ` +
    `et votre paiement de ${euro(o.total)}. Notre équipe la vérifie et vous écrit dès qu’elle est validée.`
  );
}

export type TrackView = {
  label: string;
  /** Jalons affichés sous forme de barres, et nombre de jalons franchis. */
  steps: string[];
  done: number;
  active: boolean;
  cancelled: boolean;
  message: string;
  /** Étape suivante, ou null si le suivi est terminé. */
  next: StatusId | null;
};

const view = (
  status: StatusId,
  labels: Record<StatusId, string>,
  steps: string[],
  messages: Record<StatusId, string>,
): TrackView => ({
  label: labels[status],
  steps,
  done: status === 'annulee' ? 0 : FLOW.indexOf(status),
  active: status !== 'livree' && status !== 'annulee',
  cancelled: status === 'annulee',
  message: messages[status],
  next: nextStatus(status),
});

/** Commande d'un particulier : validation par l'équipe, préparation, expédition, livraison. */
export function orderView(o: Order): TrackView {
  const destination = o.country ? ` Destination : ${countryName(o.country)}.` : '';
  return view(
    o.status,
    {
      attente: 'En validation',
      confirmee: 'Validée',
      preparation: 'En préparation',
      expediee: o.transport ? 'Expédiée' : 'Prête à enlever',
      livree: o.transport ? 'Livrée' : 'Enlevée',
      annulee: 'Annulée',
    },
    o.transport
      ? ['Validée', 'Préparation', 'Expédiée', 'Livrée']
      : ['Validée', 'Préparation', 'À enlever', 'Enlevée'],
    {
      attente: confirmationMessage(o),
      confirmee: 'Votre commande est validée par notre équipe.',
      preparation: 'Nous préparons vos produits.',
      expediee: o.transport
        ? `Votre commande a quitté le Sénégal.${destination}`
        : 'Votre commande est prête. Votre transporteur peut l’enlever à notre entrepôt au Sénégal.',
      livree: o.transport
        ? 'Votre commande est livrée. Bonne dégustation !'
        : 'Votre commande a été remise à votre transporteur.',
      annulee: 'Cette commande est annulée.',
    },
  );
}

/** Demande d'un professionnel : réponse de l'équipe, puis commande suivie jusqu'à la livraison. */
export function requestView(r: ProRequest): TrackView {
  return view(
    r.status,
    {
      attente: 'En attente de réponse',
      confirmee: 'Confirmée',
      preparation: 'En préparation',
      expediee: 'Expédiée',
      livree: 'Livrée',
      annulee: 'Annulée',
    },
    ['Confirmée', 'Préparation', 'Expédiée', 'Livrée'],
    {
      attente:
        'Notre équipe vous contacte pour confirmer les détails et organiser le paiement. Rien n’est payé dans l’application.',
      confirmee:
        'Détails et paiement confirmés avec notre équipe. Votre commande est prise en charge.',
      preparation: 'Votre commande est en préparation : calibrage, conditionnement, documents.',
      expediee:
        r.incoterm === 'FOB'
          ? 'Marchandise chargée au port de départ (FOB). La suite du transport est à votre charge.'
          : 'Marchandise mise à votre disposition à notre entrepôt (EXW).',
      livree: 'Commande livrée.',
      annulee: 'Cette demande est annulée.',
    },
  );
}
