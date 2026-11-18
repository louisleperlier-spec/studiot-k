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
| Générateur de concepts : personnage(s) + tendance + format → idées prêtes à tourner, envoi en brouillon dans le calendrier | ✅ |
| Concurrents : comptes suivis, vidéos repérées (format, vues, accroche), formats qui marchent, « En faire un concept » | ✅ |
| Publication automatique sur TikTok, Instagram, Facebook, YouTube | étape 4 |

## Lancer en local

```bash
npm install
npm run dev
npm test   # tests du générateur
```

Sans configuration, les données vont dans `.data/db.json` et les fichiers dans `.data/uploads/`. Pas de mot de passe.

## Mettre en ligne sur Vercel

1. Importer ce dépôt sur [vercel.com/new](https://vercel.com/new).
2. Dans l'onglet **Storage** du projet Vercel, ajouter **Neon** (Postgres) et **Blob**. Vercel crée `DATABASE_URL` et `BLOB_READ_WRITE_TOKEN` tout seul.
3. Dans **Settings → Environment Variables**, ajouter `APP_PASSWORD` avec ton mot de passe.
4. Redéployer. Les tables sont créées au premier chargement.

Variables : voir `.env.example`.

## Générateur de concepts

Sans clé, les idées viennent d'un mixeur intégré (gratuit, hors ligne). Avec `ANTHROPIC_API_KEY` (clé sur [platform.claude.com](https://platform.claude.com)), c'est Claude qui les écrit, à partir des fiches personnages (univers, ton, répliques) : mieux tu remplis les fiches, meilleures sont les idées. Si Claude ne répond pas, le mixeur prend le relais.

« Envoyer au calendrier » crée un brouillon sur le prochain créneau libre à partir de demain (18:00, puis 12:00 et 09:00 selon ton palier de 1, 2 ou 3 posts par jour).

## Données de la planète

`lib/geo/land.json` est généré par `node scripts/build-land.mjs` (contours Natural Earth via `world-atlas`).
