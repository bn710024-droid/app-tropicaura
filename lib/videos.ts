import { VIDEOS_ENDPOINT } from './config';

/**
 * Vidéos publiées par l'équipe, visibles dans Favoris › Découvrir.
 * Seule l'équipe publie : il n'y a aucune fonction d'envoi côté utilisateur.
 */
/**
 * Fichier embarqué (ce que renvoie `require` : un identifiant sur iOS et Android, un objet sur
 * le web) ou adresse d'un fichier publié.
 */
export type Media = number | string | { uri: string };

/** Source utilisable telle quelle par expo-image et expo-video. */
export const mediaSource = (media: Media) =>
  typeof media === 'string' ? (media ? { uri: media } : null) : media;

export type TeamVideo = {
  id: string;
  title: string;
  description: string;
  /** Date de publication, au format AAAA-MM-JJ. */
  publishedAt: string;
  durationSec: number;
  source: Media;
  poster: Media;
  audience: 'tous' | 'particulier' | 'pro';
  /** Vrai pour les exemples embarqués, montés à partir des photos du catalogue. */
  demo: boolean;
};

/** Exemples embarqués : ils tiennent lieu de publications tant que l'outil de l'équipe n'existe pas. */
export const DEMO_VIDEOS: TeamVideo[] = [
  {
    id: 'mangue-campagne',
    title: 'Mangue du Sénégal : la campagne arrive',
    description: 'Kent et Keitt, récoltées de mai à octobre. Rendez-vous dès mai.',
    publishedAt: '2026-11-18',
    durationSec: 8,
    source: require('../assets/videos/mangue-campagne.mp4'),
    poster: require('../assets/videos/mangue-campagne.webp'),
    audience: 'tous',
    demo: true,
  },
  {
    id: 'commander',
    title: 'Commander en trois temps',
    description: 'Choisir ses produits, décider du transport, suivre sa commande.',
    publishedAt: '2026-11-12',
    durationSec: 8,
    source: require('../assets/videos/commander.mp4'),
    poster: require('../assets/videos/commander.webp'),
    audience: 'particulier',
    demo: true,
  },
  {
    id: 'pro-exw-fob',
    title: 'EXW ou FOB : à vous de choisir',
    description: 'Les deux prix de l’espace professionnel, dès 500 kg par produit.',
    publishedAt: '2026-11-12',
    durationSec: 8,
    source: require('../assets/videos/pro-exw-fob.mp4'),
    poster: require('../assets/videos/pro-exw-fob.webp'),
    audience: 'pro',
    demo: true,
  },
  {
    id: 'melon-campagne',
    title: 'Melon du Sénégal : pleine récolte dès février',
    description: 'La campagne du melon s’étend de février à mai.',
    publishedAt: '2026-10-30',
    durationSec: 8,
    source: require('../assets/videos/melon-campagne.mp4'),
    poster: require('../assets/videos/melon-campagne.webp'),
    audience: 'tous',
    demo: true,
  },
];

/** Vidéos visibles pour un type de compte, de la plus récente à la plus ancienne. */
export function videosFor(list: TeamVideo[], pro: boolean) {
  const mine = pro ? 'pro' : 'particulier';
  return list
    .filter((v) => v.audience === 'tous' || v.audience === mine)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

/**
 * Format attendu du futur outil de publication : `GET VIDEOS_ENDPOINT` renvoie un tableau de
 * `{ id, title, description, publishedAt, durationSec, videoUrl, posterUrl, audience? }`.
 */
type Published = {
  id?: unknown;
  title?: unknown;
  description?: unknown;
  publishedAt?: unknown;
  durationSec?: unknown;
  videoUrl?: unknown;
  posterUrl?: unknown;
  audience?: unknown;
};

/**
 * Publications de l'équipe. Renvoie `null` tant que l'outil n'est pas connecté (ou injoignable) :
 * l'application garde alors les vidéos de démonstration.
 */
export async function fetchTeamVideos(): Promise<TeamVideo[] | null> {
  if (!VIDEOS_ENDPOINT) return null;
  try {
    const response = await fetch(VIDEOS_ENDPOINT);
    if (!response.ok) return null;
    const raw: unknown = await response.json();
    if (!Array.isArray(raw)) return null;
    return (raw as Published[])
      .filter((v) => typeof v.id === 'string' && typeof v.videoUrl === 'string')
      .map((v) => ({
        id: v.id as string,
        title: typeof v.title === 'string' ? v.title : 'Vidéo',
        description: typeof v.description === 'string' ? v.description : '',
        publishedAt: typeof v.publishedAt === 'string' ? v.publishedAt.slice(0, 10) : '',
        durationSec: typeof v.durationSec === 'number' ? v.durationSec : 0,
        source: v.videoUrl as string,
        poster: typeof v.posterUrl === 'string' ? v.posterUrl : '',
        audience: v.audience === 'pro' || v.audience === 'particulier' ? v.audience : 'tous',
        demo: false,
      }));
  } catch {
    return null;
  }
}

type Sent = 'sent' | 'not_connected' | 'failed';

/** Envoi d'un événement à l'outil de l'équipe. Sans adresse configurée, rien ne part. */
async function post(path: string, body: Record<string, unknown>): Promise<Sent> {
  if (!VIDEOS_ENDPOINT) return 'not_connected';
  try {
    const response = await fetch(`${VIDEOS_ENDPOINT}/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, at: new Date().toISOString() }),
    });
    return response.ok ? 'sent' : 'failed';
  } catch {
    return 'failed';
  }
}

/**
 * Vues, J'aime et commentaires. Rien de tout cela n'est connecté pour l'instant : ces appels
 * répondent « not_connected » et les données restent sur l'appareil. Les commentaires devront
 * passer par une modération côté équipe avant d'être visibles par d'autres.
 */
export const reportView = (videoId: string, accountId: string | null) =>
  post('views', { videoId, accountId });

export const reportLike = (videoId: string, liked: boolean, accountId: string | null) =>
  post('likes', { videoId, liked, accountId });

export const reportComment = (videoId: string, text: string, accountId: string | null) =>
  post('comments', { videoId, text, accountId });
