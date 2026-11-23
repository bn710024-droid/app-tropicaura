/**
 * Réglages du prototype.
 *
 * TEAM_ENDPOINT : adresse du futur logiciel interne de l'équipe, qui recevra les demandes
 * professionnelles. Tant qu'elle vaut `null`, rien n'est transmis : les demandes restent
 * enregistrées sur l'appareil, marquées « en attente de transmission ».
 */
export const TEAM_ENDPOINT: string | null = null;

/**
 * Outils de test : affiche les boutons « Mode test » qui simulent les réponses de l'équipe
 * (validation, préparation, expédition, livraison). À passer à `false` dès que le suivi réel
 * est branché.
 */
export const TEST_TOOLS = true;

/** Commandes professionnelles : quantités en kilos, par produit. */
export const PRO_MIN_KG = 500;
export const PRO_STEP_KG = 100;
export const PRO_MAX_KG = 100000;

/**
 * Vidéos de l'équipe (espace « Découvrir »).
 *
 * VIDEOS_ENDPOINT : adresse du futur outil de publication. Tant qu'elle vaut `null`, l'application
 * montre les vidéos de démonstration embarquées et les vues ne sont comptées que sur l'appareil.
 */
export const VIDEOS_ENDPOINT: string | null = null;

/** Une vidéo compte comme regardée après ce temps de lecture (ou à sa fin, si elle est plus courte). */
export const WATCHED_AFTER_SEC = 3;

/**
 * Sens du geste entre les pages principales.
 * -1 : glisser le doigt vers la gauche avance (Accueil → Favoris → Panier → Commandes → Profil),
 *      vers la droite revient à la page précédente. C'est le sens retenu.
 *  1 : sens inverse.
 */
export const SWIPE_FORWARD: 1 | -1 = -1;

/**
 * Catalogue (produits, photos, prix, offres, règles de quantité).
 *
 * CATALOG_ENDPOINT : adresse à laquelle le futur logiciel de contrôle publiera le catalogue, au
 * format décrit dans `lib/catalog/schema.ts`. Tant qu'elle vaut `null`, rien n'est connecté :
 * l'application affiche le catalogue d'exemple embarqué.
 */
export const CATALOG_ENDPOINT: string | null = null;

/**
 * Mise en page « ordinateur » de la version web (barre de navigation en haut, pages pleine
 * largeur). Chantier commencé mais pas terminé ni vérifié : laisser à `false`. Sur grand écran,
 * l'application s'affiche alors dans sa colonne « téléphone », centrée.
 */
export const DESKTOP_WEB = false;
