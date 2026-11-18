# Studio T&K

Le studio privé de contenu de **St Tarbanouche** et **Kevun** : fiches personnages, bibliothèque de visuels et de voix, calendrier de publication, revenus.
Interface en verre liquide, construite avec les designs web du catalogue Process (`components/process/`).

## Écrans

| Écran | État |
| --- | --- |
| Accueil : file de publication, jours couverts, montée 1 → 2 → 3 posts par jour | ✅ |
| Personnages : dossiers 3D, fiche éditable, visuels, vidéos et extraits de voix | ✅ |
| Calendrier : créer, modifier, supprimer, glisser un post sur un autre jour | ✅ |
| Revenus : planète des ventes (données d'exemple tant que Whop et Shopify ne sont pas branchés) | 🟡 |
| Générateur de concepts, Concurrents | étape 3 |
| Publication automatique sur TikTok, Instagram, Facebook, YouTube | étape 4 |

## Lancer en local

```bash
npm install
npm run dev
```

Sans configuration, les données vont dans `.data/db.json` et les fichiers dans `.data/uploads/`. Pas de mot de passe.

## Mettre en ligne sur Vercel

1. Importer ce dépôt sur [vercel.com/new](https://vercel.com/new).
2. Dans l'onglet **Storage** du projet Vercel, ajouter **Neon** (Postgres) et **Blob**. Vercel crée `DATABASE_URL` et `BLOB_READ_WRITE_TOKEN` tout seul.
3. Dans **Settings → Environment Variables**, ajouter `APP_PASSWORD` avec ton mot de passe.
4. Redéployer. Les tables sont créées au premier chargement.

Variables : voir `.env.example`.

## Données de la planète

`lib/geo/land.json` est généré par `node scripts/build-land.mjs` (contours Natural Earth via `world-atlas`).
