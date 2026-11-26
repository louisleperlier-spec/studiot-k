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
| Stats : courbe des abonnés TikTok, audience (genre, pays), heures actives, revenus saisis à la main | ✅ |
| Concurrents | étape 3 |
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

## Stats

Une page par personnage (St Tarbanouche, Kevun) :

- **Import TikTok** : dans TikTok Studio, Analyses → Abonnés → Exporter. Dépose le zip tel quel (ou les CSV) : `FollowerHistory` (abonnés par jour), `FollowerActivity` (moyenne des abonnés actifs par heure), `FollowerGender`, `FollowerTopTerritories`. Un jour déjà présent est remplacé, rien n'est compté deux fois. TikTok n'écrit pas l'année : on prend le jour le plus récent qui n'est pas dans le futur.
- **Saisie manuelle** d'un relevé d'abonnés, et des revenus (montant, devise, source, date, personnage, note). Les totaux restent par devise, sans conversion.
- **Chiffres de départ** : sur une base vide, un bouton charge l'export du 19 au 25 nov. 2026 de Saint Tabarnouche et les 97 USD de cadeaux TikTok.

### Synchro Process

Process parle à Claude, pas à ce site. Pour que Claude y lise tes stats TikTok et tes ventes (une fois TikTok connecté dans Process) puis les envoie ici, ajoute `STATS_API_TOKEN` (une longue chaîne au hasard) dans les variables Vercel. Ensuite :

```bash
curl -X POST https://<ton-site>/api/stats \
  -H "Authorization: Bearer $STATS_API_TOKEN" -H "Content-Type: application/json" \
  -d '{"characterId":"tarbanouche",
       "followers":[{"date":"2026-11-26","followers":9100}],
       "audience":{"gender":{"male":0.69,"female":0.31,"other":0},"territories":[{"cc":"CA","share":0.89}],"hours":[...24 valeurs],"hoursDays":7},
       "revenues":[{"date":"2026-11-26","amount":12,"currency":"USD","source":"whop","ref":"whop_123"}]}'
```

`ref` évite de compter deux fois la même vente si la synchro repasse. Sans `STATS_API_TOKEN`, la route répond 503 et reste fermée.

## Données de la planète

`lib/geo/land.json` est généré par `node scripts/build-land.mjs` (contours Natural Earth via `world-atlas`).
