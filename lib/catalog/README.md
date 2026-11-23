# Catalogue — source de données des applications

Ce dossier prépare la liaison avec le futur **logiciel de contrôle sur ordinateur**. Ce logiciel
n'existe pas encore et **rien n'est connecté** : l'application affiche un catalogue d'exemple
embarqué.

## Les fichiers

| Fichier | Rôle | État |
|---|---|---|
| `schema.ts` | Format du catalogue : produits, photos, descriptions, disponibilités, prix, unités, offres particuliers et professionnels, modes avion / bateau, règles de quantité. Vérification d'un document reçu (`parseCatalog`). | En service |
| `rules.ts` | Calculs : minimums, paliers, conteneurs, équivalent en kilos, totaux, contrôle des quantités saisies. | En service, testé |
| `build.ts` | Passage du catalogue aux écrans, selon le profil (particulier, grossiste ou importateur, autre professionnel). | En service |
| `embedded.ts` | Catalogue **d'exemple** embarqué (`example: true`). | Données d'exemple |
| `source.ts` | Chargement du catalogue publié, avec copie de secours sur l'appareil. | **Préparé, non connecté** |

## Ce qui se modifie dans les données, sans toucher aux écrans

- Les produits, leurs photos (`photo.asset` pour une image embarquée, `photo.url` pour une image
  publiée), leurs descriptions, leurs mois de disponibilité, leur visibilité (`available`).
- Le prix particulier et son unité (`retail`). Sans prix, le produit n'est pas proposé aux
  particuliers.
- Les offres professionnelles (`wholesale`) : une par mode (`avion`, `bateau`, ou `null` pour une
  offre sans mode), avec ses prix EXW et FOB, l'unité du prix (`kg` ou `conteneur`) et, si besoin,
  ses propres minimum, palier, maximum et poids de conteneur.
- Les règles générales (`rules`) : minimum et palier par avion (500 kg / 500 kg), minimum en
  conteneurs par bateau (1), poids de référence d'un conteneur (22 000 kg, « Europe »).

Un prix absent (`null`) n'est jamais remplacé : l'offre s'affiche « Prix à confirmer » et n'entre
dans aucun total.

## Pour connecter le logiciel de contrôle, plus tard

1. Faire publier par le logiciel un document JSON au format de `schema.ts` (`schema: 1`).
2. Renseigner son adresse dans `lib/config.ts` (`CATALOG_ENDPOINT`).
3. Tester `source.ts` contre ce serveur : ce chemin n'a jamais été exercé en conditions réelles.

Restent à développer côté serveur : l'authentification, la publication des photos, et la
répercussion en temps réel (aujourd'hui, le catalogue serait relu à l'ouverture de l'application).
